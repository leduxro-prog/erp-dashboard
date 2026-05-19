import { DisabledSupplierScraper } from './DisabledSupplierScraper';

export class LedProfilesScraper extends DisabledSupplierScraper {
  constructor(browser?: any) {
    super('ledprofiles', 'LED Profiles scraper has no production implementation yet.', browser);
  }
}
