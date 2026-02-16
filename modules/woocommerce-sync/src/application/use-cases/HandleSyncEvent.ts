import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { SyncItem } from '../../domain/entities/SyncItem';
import { v4 as uuidv4 } from 'uuid';

export interface SyncEvent {
  eventName: string;
  productId: string;
  payload: any;
  timestamp: Date;
}

export class HandleSyncEvent {
  constructor(
    private syncRepository: ISyncRepository,
    private queueJob: (jobName: string, data: any) => Promise<void>
  ) {}

  async handle(event: SyncEvent): Promise<void> {
    const { eventName, productId, payload } = event;

    // Map event to sync type and priority
    const syncType = this.mapEventToSyncType(eventName);

    if (!syncType) {
      return; // Unknown event type
    }

    // Create sync item
    const syncItem = new SyncItem(
      uuidv4(),
      productId,
      syncType,
      payload,
      3
    );

    // Save to repository
    await this.syncRepository.saveSyncItem(syncItem);

    // Queue job based on sync type
    await this.queueJob(`sync_${syncType}`, {
      syncItemId: syncItem.id,
      productId,
      syncType,
    });
  }

  private mapEventToSyncType(
    eventName: string
  ): 'price' | 'stock' | 'product' | 'category' | 'image' | null {
    switch (eventName) {
      case 'inventory.stock_changed':
      case 'product.stock_updated':
        return 'stock';

      case 'pricing.price_changed':
      case 'product.price_updated':
        return 'price';

      case 'product.updated':
      case 'product.created':
        return 'product';

      case 'product.category_changed':
      case 'category.created':
      case 'category.updated':
        return 'category';

      case 'product.image_added':
      case 'product.image_updated':
        return 'image';

      default:
        return null;
    }
  }
}
