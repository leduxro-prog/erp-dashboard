export class BnrExchangeRateService {
  constructor(private readonly marginPercent: number = 0) {}

  async getCurrencyToRonRate(currency: string): Promise<number> {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized || normalized === 'RON') {
      return 1;
    }

    const response = await fetch('https://www.bnr.ro/nbrfxrates.xml');
    if (!response.ok) {
      throw new Error(`Failed to load BNR rates: ${response.status}`);
    }

    const xml = await response.text();
    const regex = new RegExp(`<Rate[^>]*currency="${normalized}"[^>]*>([^<]+)</Rate>`, 'i');
    const match = xml.match(regex);
    if (!match?.[1]) {
      throw new Error(`Currency ${normalized} not found in BNR feed`);
    }

    const rate = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Invalid BNR rate for ${normalized}`);
    }

    const margin = 1 + this.marginPercent / 100;
    return Math.round(rate * margin * 10000) / 10000;
  }
}
