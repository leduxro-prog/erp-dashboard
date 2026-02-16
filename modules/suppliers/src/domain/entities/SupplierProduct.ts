export interface PriceHistoryEntry {
  price: number;
  date: Date;
}

export interface SupplierProduct {
  id: number;
  supplierId: number;
  productId?: number;
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
  minOrderQuantity?: number;
  leadTimeDays?: number;
  isActive?: boolean;
  lastScraped: Date;
  priceHistory: PriceHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export class SupplierProductEntity implements SupplierProduct {
  id!: number;
  supplierId!: number;
  supplierSku!: string;
  name!: string;
  price!: number;
  currency!: string;
  stockQuantity!: number;
  lastScraped!: Date;
  priceHistory!: PriceHistoryEntry[];
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: SupplierProduct) {
    Object.assign(this, data);
    this.priceHistory = data.priceHistory || [];
  }

  hasPriceChanged(newPrice: number): boolean {
    return this.price !== newPrice;
  }

  priceChangePercentage(newPrice: number): number {
    if (this.price === 0) return 0;
    return ((newPrice - this.price) / this.price) * 100;
  }

  isPriceChangeSignificant(newPrice: number, threshold: number = 10): boolean {
    if (!this.hasPriceChanged(newPrice)) return false;
    const changePercentage = Math.abs(this.priceChangePercentage(newPrice));
    return changePercentage > threshold;
  }

  recordPriceChange(newPrice: number, timestamp: Date = new Date()): void {
    this.priceHistory.push({
      price: newPrice,
      date: timestamp,
    });

    // Keep only last 52 weeks of history (1 year)
    if (this.priceHistory.length > 52) {
      this.priceHistory = this.priceHistory.slice(-52);
    }
  }

  getPriceHistory(weeks: number = 12): PriceHistoryEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);

    return this.priceHistory.filter((entry) => entry.date > cutoffDate);
  }

  getAveragePrice(weeks: number = 12): number {
    const history = this.getPriceHistory(weeks);
    if (history.length === 0) return this.price;

    const sum = history.reduce((acc, entry) => acc + entry.price, 0);
    return sum / history.length;
  }

  isLowStock(threshold: number = 10): boolean {
    return this.stockQuantity <= threshold;
  }

  isOutOfStock(): boolean {
    return this.stockQuantity === 0;
  }
}
