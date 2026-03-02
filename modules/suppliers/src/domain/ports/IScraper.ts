export interface ScrapedProduct {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
  category?: string;
  imageUrl?: string;
  images?: string[];
  manufacturer?: string;
  brand?: string;
  ean?: string;
  attributes?: Record<string, string | number | boolean>;
  specifications?: Record<string, unknown>;
  sourceUpdatedAt?: Date | string;
}

export interface IScraper {
  scrapeProducts(credentials?: any): Promise<ScrapedProduct[]>;
  scrapeStock(): Promise<{ sku: string; quantity: number }[]>;
}

export interface IScraperFactory {
  getScraper(supplierCode: string): IScraper;
}
