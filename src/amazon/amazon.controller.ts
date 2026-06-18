import {
  Controller,
  Get,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AmazonService } from './amazon.service';
import { SearchProductsDto } from './dto/search.dto';
import { AmazonProduct } from './interfaces/amazon.interface';


@Controller('amazon')
export class AmazonController {
  constructor(private readonly amazonService: AmazonService) {}

  /**
   * GET /amazon/products?keyword=laptop&maxPages=2&minPrice=100&maxPrice=500
   */
  @Get('products')
  @HttpCode(HttpStatus.OK)
  async searchProducts(@Query() query: SearchProductsDto): Promise<{
    keyword: string;
    count: number;
    products: AmazonProduct[];
  }> {
    if (!query.keyword?.trim()) {
      throw new BadRequestException('keyword query param is required');
    }

    const products = await this.amazonService.getProducts(
      query.keyword.trim(),
      {
        maxPages: query.maxPages,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
      },
    );

    return {
      keyword: query.keyword,
      count: products.length,
      products,
    };
  }

  /**
   * GET /amazon/products/details?url=https://www.amazon.com/dp/...
   */
  @Get('products/details')
  @HttpCode(HttpStatus.OK)
  async getProductDetails(
    @Query('url') url: string,
  ): Promise<Record<string, unknown>> {
    if (!url?.trim()) {
      throw new BadRequestException('url query param is required');
    }

    try {
      new URL(url); // validate it's a real URL
    } catch {
      throw new BadRequestException('url must be a valid URL');
    }

    return this.amazonService.getProductDetails(url.trim());
  }
}
