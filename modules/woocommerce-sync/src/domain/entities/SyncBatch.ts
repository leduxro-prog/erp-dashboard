import { SyncItem } from './SyncItem';

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'partial_failure';

export class SyncBatch {
  id: string;
  items: SyncItem[];
  batchSize: number;
  status: BatchStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalItems: number;
  successCount: number;
  failCount: number;
  createdAt: Date;

  constructor(id: string, batchSize: number = 100) {
    this.id = id;
    this.items = [];
    this.batchSize = batchSize;
    this.status = 'pending';
    this.totalItems = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.createdAt = new Date();
  }

  addItem(item: SyncItem): void {
    if (this.items.length < this.batchSize) {
      this.items.push(item);
      this.totalItems++;
    }
  }

  addItems(items: SyncItem[]): void {
    for (const item of items) {
      if (this.items.length >= this.batchSize) break;
      this.addItem(item);
    }
  }

  isFull(): boolean {
    return this.items.length >= this.batchSize;
  }

  isComplete(): boolean {
    return this.status === 'completed' || this.status === 'partial_failure';
  }

  getProgress(): number {
    if (this.totalItems === 0) return 0;
    return ((this.successCount + this.failCount) / this.totalItems) * 100;
  }

  getSummary(): {
    totalItems: number;
    successCount: number;
    failCount: number;
    pendingCount: number;
    progress: number;
    duration?: number;
  } {
    const pendingCount = this.totalItems - this.successCount - this.failCount;
    const duration = this.completedAt && this.startedAt
      ? this.completedAt.getTime() - this.startedAt.getTime()
      : undefined;

    return {
      totalItems: this.totalItems,
      successCount: this.successCount,
      failCount: this.failCount,
      pendingCount,
      progress: this.getProgress(),
      duration,
    };
  }

  start(): void {
    this.status = 'processing';
    this.startedAt = new Date();
  }

  complete(): void {
    this.completedAt = new Date();
    this.status = this.failCount === 0 ? 'completed' : 'partial_failure';
  }

  recordSuccess(): void {
    this.successCount++;
  }

  recordFailure(): void {
    this.failCount++;
  }
}
