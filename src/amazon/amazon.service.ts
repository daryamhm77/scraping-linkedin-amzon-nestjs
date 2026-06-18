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

  private normalizeAmazonProductUrl(rawUrl: string): string {
    const asinPattern =
      /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/)([A-Z0-9]{10})/i;

    let candidate = rawUrl;
    try {
      const parsed = new URL(rawUrl);
      const nested = parsed.searchParams.get('url');
      if (nested) {
        candidate = nested.startsWith('http')
          ? nested
          : `https://www.amazon.com${nested.startsWith('/') ? nested : `/${nested}`}`;
      }
    } catch {
      // keep rawUrl
    }

    const match = candidate.match(asinPattern);
    if (match) {
      return `https://www.amazon.com/dp/${match[1].toUpperCase()}`;
    }

    return rawUrl;
  }

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

      const searchUrl = new URL('https://www.amazon.com/s');
      searchUrl.searchParams.set('k', keyword);
      if (minPrice !== undefined) {
        searchUrl.searchParams.set('low-price', String(minPrice));
      }
      if (maxPrice !== undefined) {
        searchUrl.searchParams.set('high-price', String(maxPrice));
      }

      await page.goto(searchUrl.toString(), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.s-search-results', { timeout: 60_000 });

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

        allProducts.push(
          ...products
            .filter((product) => product.url)
            .map((product) => ({
              ...product,
              url: this.normalizeAmazonProductUrl(product.url!),
            })),
        );

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
    const cleanUrl = this.normalizeAmazonProductUrl(productUrl);

    const browser = await puppeteer.connect({
      browserWSEndpoint: this.configService.getOrThrow('SBR_WS_ENDPOINT'),
    });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(2 * 60 * 1000);

      await page.goto(cleanUrl, { waitUntil: 'domcontentloaded' });

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
