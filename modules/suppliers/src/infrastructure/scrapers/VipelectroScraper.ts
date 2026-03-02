import { SupplierCredentials } from '../../domain';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

export class VipelectroScraper extends BaseScraper {
  constructor(browser?: any) {
    super('vipelectro', browser);
  }

  async scrapeProducts(_credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    return [];
  }
}
