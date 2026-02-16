export type SyncType = 'product' | 'price' | 'stock' | 'category' | 'image';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

export class SyncItem {
  id: string;
  productId: string;
  wooCommerceId?: number;
  syncType: SyncType;
  status: SyncStatus;
  payload: any;
  errorMessage?: string;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  completedAt?: Date;
  createdAt: Date;

  constructor(
    id: string,
    productId: string,
    syncType: SyncType,
    payload: any,
    maxAttempts: number = 3
  ) {
    this.id = id;
    this.productId = productId;
    this.syncType = syncType;
    this.payload = payload;
    this.status = 'pending';
    this.attempts = 0;
    this.maxAttempts = maxAttempts;
    this.createdAt = new Date();
  }

  markSyncing(): void {
    this.status = 'syncing';
    this.lastAttempt = new Date();
  }

  markCompleted(): void {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  markFailed(errorMessage: string): void {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    this.attempts++;
  }

  canRetry(): boolean {
    return this.attempts < this.maxAttempts && this.status === 'failed';
  }

  incrementAttempt(): void {
    this.attempts++;
  }

  reset(): void {
    this.status = 'pending';
    this.attempts = 0;
    this.errorMessage = undefined;
    this.lastAttempt = undefined;
    this.completedAt = undefined;
  }
}
