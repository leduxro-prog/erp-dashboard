import { SupplierCredentials } from '../../domain';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

export class SampleSupplierApiScraper extends BaseScraper {
  constructor(browser?: any) {
    super('example-api', browser);
  }

  async scrapeProducts(_credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    return [];
  }
}
