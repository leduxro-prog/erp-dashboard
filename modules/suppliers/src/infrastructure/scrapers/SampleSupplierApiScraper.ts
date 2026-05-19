import { DisabledSupplierScraper } from './DisabledSupplierScraper';

export class SampleSupplierApiScraper extends DisabledSupplierScraper {
  constructor(browser?: any) {
    super('example-api', 'Sample supplier API scraper is a placeholder and is disabled.', browser);
  }
}
