import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer-core';
import {
  AmazonScrapeOptions,
  AmazonProduct,
} from './interfaces/amazon.interface';

@Injectable()
export class AmazonService {
  constructor(private readonly configService: ConfigService) {}

  async getProducts(
    keyword: string,
    options: AmazonScrapeOptions = {},
  ): Promise<AmazonProduct[]> {
    const { maxPages = 1, minPrice, maxPrice } = options;

    const browser = await puppeteer.connect({
      browserWSEndpoint: this.configService.getOrThrow('SBR_WS_ENDPOINT'),
    });

    const allProducts: AmazonProduct[] = [];

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(2 * 60 * 1000);

      await Promise.all([
        page.waitForNavigation(),
        page.goto('https://www.amazon.com'),
      ]);

      await page.type('#twotabsearchtextbox', keyword);
      await Promise.all([
        page.waitForNavigation(),
        page.click('#nav-search-submit-button'),
      ]);

      // Apply price filters via URL if provided
      if (minPrice !== undefined || maxPrice !== undefined) {
        const currentUrl = page.url();
        const url = new URL(currentUrl);
        if (minPrice !== undefined)
          url.searchParams.set('low-price', String(minPrice));
        if (maxPrice !== undefined)
          url.searchParams.set('high-price', String(maxPrice));
        await Promise.all([
          page.waitForNavigation(),
          page.goto(url.toString()),
        ]);
      }

      for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
        const products = await page.$$eval(
          '.s-search-results .s-card-container',
          (resultItems) =>
            resultItems.map((item) => ({
              url: (item.querySelector('a') as HTMLAnchorElement)?.href ?? null,
              title:
                item
                  .querySelector('.s-title-instructions-style span')
                  ?.textContent?.trim() ?? null,
              price:
                item
                  .querySelector('.a-price .a-offscreen')
                  ?.textContent?.trim() ?? null,
              rating:
                item.querySelector('.a-icon-alt')?.textContent?.trim() ?? null,
              reviewCount:
                item.querySelector('.s-underline-text')?.textContent?.trim() ??
                null,
              imageUrl:
                (item.querySelector('.s-image') as HTMLImageElement)?.src ??
                null,
              isPrime: !!item.querySelector('.s-prime'),
            })),
        );

        allProducts.push(...products);

        if (currentPage < maxPages) {
          const nextButton = await page.$(
            '.s-pagination-next:not(.s-pagination-disabled)',
          );
          if (!nextButton) break;
          await Promise.all([page.waitForNavigation(), nextButton.click()]);
        }
      }

      return allProducts;
    } finally {
      await browser.close();
    }
  }

  async getProductDetails(
    productUrl: string,
  ): Promise<Record<string, unknown>> {
    const browser = await puppeteer.connect({
      browserWSEndpoint: this.configService.getOrThrow('SBR_WS_ENDPOINT'),
    });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(2 * 60 * 1000);

      await Promise.all([page.waitForNavigation(), page.goto(productUrl)]);

      return await page.evaluate(() => {
        const getText = (selector: string) =>
          document.querySelector(selector)?.textContent?.trim() ?? null;

        return {
          title: getText('#productTitle'),
          price: getText('.a-price .a-offscreen'),
          rating: getText('#acrPopover .a-icon-alt'),
          reviewCount: getText('#acrCustomerReviewText'),
          availability: getText('#availability span'),
          description: getText('#productDescription p'),
          brand: getText('#bylineInfo'),
          imageUrl:
            (document.querySelector('#landingImage') as HTMLImageElement)
              ?.src ?? null,
          features: Array.from(
            document.querySelectorAll('#feature-bullets li span'),
          ).map((el) => el.textContent?.trim()),
        };
      });
    } finally {
      await browser.close();
    }
  }
}
