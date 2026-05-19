export class BnrExchangeRateService {
  constructor(private readonly marginPercent: number = 0) {}

  async getCurrencyToRonRate(currency: string): Promise<number> {
    const normalizedCurrency = currency.trim().toUpperCase();
    if (normalizedCurrency === 'RON') {
      return 1;
    }

    const response = await fetch('https://www.bnr.ro/nbrfxrates.xml');
    if (!response.ok) {
      throw new Error(`BNR rate request failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const rateMatch = xml.match(
      new RegExp(`<Rate[^>]*currency="${normalizedCurrency}"[^>]*>([^<]+)</Rate>`, 'i'),
    );

    if (!rateMatch) {
      throw new Error(`BNR rate not found for ${normalizedCurrency}`);
    }

    const rate = Number(rateMatch[1].replace(',', '.'));
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Invalid BNR rate for ${normalizedCurrency}`);
    }

    return Math.round(rate * (1 + this.marginPercent / 100) * 10000) / 10000;
  }
}
