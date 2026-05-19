import { DisabledSupplierScraper } from './DisabledSupplierScraper';

export class VipelectroScraper extends DisabledSupplierScraper {
  constructor(browser?: any) {
    super('vipelectro', 'Vipelectro scraper has no production implementation yet.', browser);
  }
}
