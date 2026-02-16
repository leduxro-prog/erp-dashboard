export interface ScrapedProduct {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
  category?: string;
  imageUrl?: string;
}

export interface IScraper {
  scrapeProducts(credentials?: any): Promise<ScrapedProduct[]>;
  scrapeStock(): Promise<{ sku: string; quantity: number }[]>;
}

export interface IScraperFactory {
  getScraper(supplierCode: string): IScraper;
}
