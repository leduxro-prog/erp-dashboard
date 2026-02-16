export class SmartBillStock {
  constructor(
    public readonly productSku: string,
    public readonly warehouseName: string,
    public quantity: number,
    public readonly lastSynced: Date = new Date(),
  ) {}

  hasChanged(previousQty: number): boolean {
    return this.quantity !== previousQty;
  }

  isLow(threshold: number = 3): boolean {
    return this.quantity <= threshold;
  }

  isOutOfStock(): boolean {
    return this.quantity <= 0;
  }
}
