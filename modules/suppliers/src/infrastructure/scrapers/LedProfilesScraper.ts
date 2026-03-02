import { SupplierCredentials } from '../../domain';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

export class LedProfilesScraper extends BaseScraper {
  constructor(browser?: any) {
    super('ledprofiles', browser);
  }

  async scrapeProducts(_credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    return [];
  }
}
