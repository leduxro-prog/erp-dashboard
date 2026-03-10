import { BaseScraper } from './BaseScraper';
import { InnproScraper } from './InnproScraper';
import { SupplierCode } from '../../domain';

export class ScraperFactory {
  private browser?: any;

  constructor(browser?: any) {
    this.browser = browser;
  }

  getScraper(supplierCode: SupplierCode): BaseScraper {
    switch (supplierCode) {
      case SupplierCode.INNPRO:
        return new InnproScraper(this.browser);

      case SupplierCode.ACA_LIGHTING:
        return new (require('./AcaLightingScraper').AcaLightingScraper)(this.browser);

      case SupplierCode.MASTERLED:
        return new (require('./MasterledScraper').MasterledScraper)(this.browser);

      case SupplierCode.ARELUX:
        return new (require('./AreluxScraper').AreluxScraper)(this.browser);

      case SupplierCode.BRAYTRON:
        return new (require('./BraytronScraper').BraytronScraper)(this.browser);

      case SupplierCode.FSL:
        return new (require('./FslScraper').FslScraper)(this.browser);

      case SupplierCode.MPL_POWER:
        return new (require('./MplPowerScraper').MplPowerScraper)(this.browser);

      case SupplierCode.AZZARDO:
        return new (require('./AzzardoXmlScraper').AzzardoXmlScraper)(this.browser);

      case SupplierCode.LED_PROFILES:
        return new (require('./LedProfilesScraper').LedProfilesScraper)(this.browser);

      case SupplierCode.VIPELECTRO:
        return new (require('./VipelectroScraper').VipelectroScraper)(this.browser);

      case SupplierCode.BUSINESS_CENTRAL:
        return new (require('./BusinessCentralScraper').BusinessCentralScraper)(this.browser);

      case SupplierCode.EXAMPLE_API:
        return new (require('./SampleSupplierApiScraper').SampleSupplierApiScraper)(this.browser);

      default:
        throw new Error(`Unknown supplier code: ${supplierCode}`);
    }
  }

  supportsSupplier(supplierCode: string): boolean {
    return Object.values(SupplierCode).includes(supplierCode as SupplierCode);
  }
}
