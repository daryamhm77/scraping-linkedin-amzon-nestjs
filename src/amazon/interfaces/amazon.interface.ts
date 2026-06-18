export interface AmazonProduct {
  url: string;
  title: string | null;
  price: string | null;
  rating: string | null;
  reviewCount: string | null;
  imageUrl: string | null;
  isPrime: boolean;
}

export interface AmazonScrapeOptions {
  maxPages?: number;
  minPrice?: number;
  maxPrice?: number;
}
