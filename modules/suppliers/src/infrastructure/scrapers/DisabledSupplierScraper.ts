import { SupplierCredentials } from '../../domain';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

export abstract class DisabledSupplierScraper extends BaseScraper {
  protected constructor(
    supplierCode: string,
    private readonly reason: string,
    browser?: any,
  ) {
    super(supplierCode, browser);
  }

  async scrapeProducts(_credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    throw new Error(`${this.supplierCode} scraper not_configured: ${this.reason}`);
  }

  async scrapeStock(): Promise<{ sku: string; quantity: number }[]> {
    throw new Error(`${this.supplierCode} scraper not_configured: ${this.reason}`);
  }
}
