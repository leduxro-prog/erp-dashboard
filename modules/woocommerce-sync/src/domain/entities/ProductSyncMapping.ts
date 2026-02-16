export class ProductSyncMapping {
  id: string;
  internalProductId: string;
  wooCommerceProductId: number;
  lastSynced: Date;
  syncStatus: 'in_sync' | 'out_of_sync' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    internalProductId: string,
    wooCommerceProductId: number
  ) {
    this.id = id;
    this.internalProductId = internalProductId;
    this.wooCommerceProductId = wooCommerceProductId;
    this.lastSynced = new Date();
    this.syncStatus = 'in_sync';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  markInSync(): void {
    this.syncStatus = 'in_sync';
    this.lastSynced = new Date();
    this.errorMessage = undefined;
    this.updatedAt = new Date();
  }

  markOutOfSync(): void {
    this.syncStatus = 'out_of_sync';
    this.updatedAt = new Date();
  }

  markError(errorMessage: string): void {
    this.syncStatus = 'error';
    this.errorMessage = errorMessage;
    this.updatedAt = new Date();
  }

  needsSync(thresholdMinutes: number = 0): boolean {
    if (this.syncStatus === 'out_of_sync' || this.syncStatus === 'error') {
      return true;
    }

    if (thresholdMinutes <= 0) {
      return false;
    }

    const minutesSinceSync =
      (new Date().getTime() - this.lastSynced.getTime()) / 1000 / 60;
    return minutesSinceSync > thresholdMinutes;
  }
}
