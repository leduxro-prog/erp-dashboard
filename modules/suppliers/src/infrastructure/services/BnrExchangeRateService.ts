export class BnrExchangeRateService {
  constructor(private readonly markupPercent: number = 0) {}

  async getCurrencyToRonRate(currency: string): Promise<number> {
    const normalized = String(currency || '').trim().toUpperCase();
    const baseRates: Record<string, number> = {
      RON: 1,
      EUR: 5,
      PLN: 1.2,
    };

    const baseRate = baseRates[normalized];
    if (!baseRate) {
      throw new Error(`Unsupported currency for conversion: ${currency}`);
    }

    return baseRate * (1 + this.markupPercent / 100);
  }
}
