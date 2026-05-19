import { BnrExchangeRateService } from './BnrExchangeRateService';

export interface MplProcessedProduct {
  supplierSku: string;
  name: string;
  priceRon: number;
  stockQuantity: number;
  ean?: string;
  category?: string;
}

export interface MplPowerCredentials {
  username: string;
  password: string;
}

export class MplPowerApiClient {
  constructor(private readonly bnrService: BnrExchangeRateService) {}

  async fetchAndProcessProducts(_credentials: MplPowerCredentials): Promise<MplProcessedProduct[]> {
    await this.bnrService.getCurrencyToRonRate('EUR');
    throw new Error(
      'MPL Power API client is not configured in this build; provide a real implementation before enabling mpl-power sync.',
    );
  }
}
