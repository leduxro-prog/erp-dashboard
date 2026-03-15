import { SupplierCode } from '../../domain';

import { AcaLightingScraper } from './AcaLightingScraper';
import { AreluxScraper } from './AreluxScraper';
import { BaseScraper } from './BaseScraper';
import { BraytronScraper } from './BraytronScraper';
import { FslScraper } from './FslScraper';
import { MasterledScraper } from './MasterledScraper';


export class ScraperFactory {
  private browser?: any;

  constructor(browser?: any) {
    this.browser = browser;
  }

  getScraper(supplierCode: string): BaseScraper {
    switch (supplierCode) {
      case SupplierCode.ACA_LIGHTING:
        return new AcaLightingScraper(this.browser);

      case SupplierCode.MASTERLED:
        return new MasterledScraper(this.browser);

      case SupplierCode.ARELUX:
        return new AreluxScraper(this.browser);

      case SupplierCode.BRAYTRON:
        return new BraytronScraper(this.browser);

      case SupplierCode.FSL:
        return new FslScraper(this.browser);

      default:
        throw new Error(`Unknown supplier code: ${supplierCode}`);
    }
  }

  supportsSupplier(supplierCode: string): boolean {
    return Object.values(SupplierCode).includes(supplierCode as SupplierCode);
  }
}
