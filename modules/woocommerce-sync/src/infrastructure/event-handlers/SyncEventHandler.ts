import { Redis } from 'ioredis';
import { HandleSyncEvent, SyncEvent } from '../../application/use-cases/HandleSyncEvent';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('sync-event-handler');

export class SyncEventHandler {
  private subscriber: Redis;
  private handleSyncEvent: HandleSyncEvent;

  constructor(
    redisConnection: Redis,
    handleSyncEvent: HandleSyncEvent
  ) {
    this.subscriber = redisConnection.duplicate();
    this.handleSyncEvent = handleSyncEvent;
  }

  async start(): Promise<void> {
    // Subscribe to relevant events
    const eventPatterns = [
      'inventory.stock_changed',
      'inventory.stock_updated',
      'pricing.price_changed',
      'pricing.price_updated',
      'product.updated',
      'product.created',
      'product.category_changed',
      'product.image_added',
      'product.image_updated',
      'category.created',
      'category.updated',
    ];

    for (const pattern of eventPatterns) {
      await this.subscriber.subscribe(pattern, (err, count) => {
        if (err) {
          logger.error(`[WC Sync] Failed to subscribe to ${pattern}:`, { error: err });
        } else {
          logger.info(`[WC Sync] Subscribed to ${pattern} (${count} total)`);
        }
      });
    }

    // Handle incoming messages
    this.subscriber.on('message', async (channel, message) => {
      try {
        const event: SyncEvent = JSON.parse(message);
        event.eventName = channel;

        logger.info('[WC Sync] Handling sync event:', {
          eventName: channel,
          productId: event.productId,
          timestamp: event.timestamp,
        });

        await this.handleSyncEvent.handle(event);
      } catch (error) {
        logger.error(
          `[WC Sync] Error handling event on channel ${channel}:`,
          { error }
        );
      }
    });

    logger.info('[WC Sync] SyncEventHandler started');
  }

  async stop(): Promise<void> {
    await this.subscriber.unsubscribe();
    await this.subscriber.quit();
    logger.info('[WC Sync] SyncEventHandler stopped');
  }
}
