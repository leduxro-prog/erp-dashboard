/**
 * Sync Order Status from B2B Portal Use Case
 *
 * Synchronizes order status from external B2B Portal to internal ERP.
 * Handles status mapping, idempotency, and event emission.
 *
 * @module B2B Portal - Application Use Cases
 */

import { IB2BSyncEventRepository } from '../../domain/repositories/IB2BSyncEventRepository';
import {
  B2BPortalApiClient,
  B2BPortalOrder,
} from '../../infrastructure/services/B2BPortalApiClient';
import {
  B2BPortalStatusMapper,
  ErpOrderStatus,
} from '../../infrastructure/services/B2BPortalStatusMapper';
import { DataSource } from 'typeorm';

export interface SyncOrderStatusFromB2BInput {
  /**
   * Internal ERP order ID
   */
  erpOrderId: string;

  /**
   * External B2B Portal order ID (optional if stored in DB)
   */
  b2bOrderId?: string;

  /**
   * Idempotency key for preventing duplicate syncs
   */
  idempotencyKey?: string;

  /**
   * Whether to force sync even if status hasn't changed
   */
  force?: boolean;
}

export interface SyncOrderStatusFromB2BOutput {
  /**
   * Internal ERP order ID
   */
  erpOrderId: string;

  /**
   * External B2B Portal order ID
   */
  b2bOrderId: string;

  /**
   * Previous status in ERP
   */
  previousStatus: ErpOrderStatus | null;

  /**
   * New status after sync
   */
  newStatus: ErpOrderStatus;

  /**
   * Whether the status changed
   */
  statusChanged: boolean;

  /**
   * Full order data from B2B Portal
   */
  orderData: B2BPortalOrder;

  /**
   * Timestamp of the sync
   */
  syncedAt: Date;

  /**
   * Event published for the status change (if any)
   */
  event?: string;
}

export class SyncOrderStatusFromB2B {
  constructor(
    private readonly syncEventRepository: IB2BSyncEventRepository,
    private readonly apiClient: B2BPortalApiClient,
    private readonly statusMapper: B2BPortalStatusMapper,
    private readonly dataSource: DataSource,
    private readonly publishEvent: (event: string, data: unknown) => Promise<void>,
  ) {}

  /**
   * Execute the order status sync
   */
  async execute(input: SyncOrderStatusFromB2BInput): Promise<SyncOrderStatusFromB2BOutput> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existingEvent = await this.syncEventRepository.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existingEvent && existingEvent.status === 'success') {
        // Return cached result
        return this.buildOutputFromEvent(existingEvent);
      }
    }

    // Get B2B order ID if not provided
    let b2bOrderId: string | null = input.b2bOrderId ?? null;
    if (!b2bOrderId) {
      b2bOrderId = await this.getB2BOrderIdFromDB(input.erpOrderId);
      if (!b2bOrderId) {
        throw new Error(`No B2B order ID found for ERP order: ${input.erpOrderId}`);
      }
    }

    // Fetch order from B2B Portal
    const orderData = await this.apiClient.getOrder(b2bOrderId);

    // Map status from B2B to ERP
    const statusMapping = this.statusMapper.mapOrderStatusFromB2B(orderData.status);
    const newStatus = statusMapping.status;

    // Get current ERP order status
    const currentOrder = await this.getErpOrder(input.erpOrderId);
    const previousStatus = currentOrder ? (currentOrder.status as ErpOrderStatus) : null;

    // Check if status changed
    const statusChanged = previousStatus !== newStatus || input.force;

    // Create sync event
    const syncEvent = await this.syncEventRepository.create({
      entityType: 'order',
      entityId: input.erpOrderId,
      b2bEntityId: b2bOrderId,
      eventType: 'status_change',
      direction: 'inbound',
      payload: {
        b2bStatus: orderData.status,
        erpStatus: newStatus,
        previousStatus,
        force: input.force,
      },
      idempotencyKey: input.idempotencyKey,
    });

    if (statusChanged) {
      try {
        // Update ERP order status
        await this.updateErpOrderStatus(input.erpOrderId, newStatus);

        // Update B2B reference in ERP order
        await this.updateErpOrderB2BRef(input.erpOrderId, b2bOrderId, 'synced');

        // Mark sync event as success
        await this.syncEventRepository.markAsSuccess(syncEvent.id, b2bOrderId);

        // Emit event for status change
        let publishedEvent: string | undefined;
        if (previousStatus !== newStatus) {
          const eventName = `b2b.order_status_changed`;
          await this.publishEvent(eventName, {
            erpOrderId: input.erpOrderId,
            b2bOrderId: b2bOrderId,
            previousStatus,
            newStatus,
            b2bStatus: orderData.status,
            timestamp: new Date().toISOString(),
          });
          publishedEvent = eventName;
        }

        return {
          erpOrderId: input.erpOrderId,
          b2bOrderId: b2bOrderId,
          previousStatus,
          newStatus,
          statusChanged,
          orderData,
          syncedAt: new Date(),
          event: publishedEvent,
        };
      } catch (error) {
        // Mark sync event as failed
        await this.syncEventRepository.markAsFailed(
          syncEvent.id,
          error instanceof Error ? error.message : String(error),
        );

        // Update ERP order with sync failure
        await this.updateErpOrderB2BRef(
          input.erpOrderId,
          b2bOrderId,
          'failed',
          error instanceof Error ? error.message : String(error),
        );

        throw error;
      }
    } else {
      // Status unchanged - mark as success without updating
      await this.syncEventRepository.markAsSuccess(syncEvent.id, b2bOrderId);

      // Update sync timestamp without changing status
      await this.updateErpOrderB2BRef(input.erpOrderId, b2bOrderId, 'synced');

      return {
        erpOrderId: input.erpOrderId,
        b2bOrderId: b2bOrderId,
        previousStatus,
        newStatus,
        statusChanged: false,
        orderData,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Batch sync multiple orders
   */
  async syncMany(orderIds: string[]): Promise<SyncOrderStatusFromB2BOutput[]> {
    const results: SyncOrderStatusFromB2BOutput[] = [];
    const errors: Array<{ orderId: string; error: Error }> = [];

    for (const orderId of orderIds) {
      try {
        const result = await this.execute({ erpOrderId: orderId });
        results.push(result);
      } catch (error) {
        errors.push({
          orderId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    if (errors.length > 0) {
      console.warn(`Completed sync with ${errors.length} errors:`, errors);
    }

    return results;
  }

  /**
   * Get B2B order ID from database
   */
  private async getB2BOrderIdFromDB(erpOrderId: string): Promise<string | null> {
    const result = await this.dataSource.query(
      `SELECT b2b_order_id FROM b2b_orders WHERE id = $1 LIMIT 1`,
      [erpOrderId],
    );

    return result[0]?.b2b_order_id || null;
  }

  /**
   * Get ERP order from database
   */
  private async getErpOrder(erpOrderId: string): Promise<{ id: string; status: string } | null> {
    const result = await this.dataSource.query(
      `SELECT id, status FROM b2b_orders WHERE id = $1 LIMIT 1`,
      [erpOrderId],
    );

    return result[0] || null;
  }

  /**
   * Update ERP order status
   */
  private async updateErpOrderStatus(erpOrderId: string, status: ErpOrderStatus): Promise<void> {
    await this.dataSource.query(
      `UPDATE b2b_orders
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [status, erpOrderId],
    );
  }

  /**
   * Update ERP order B2B reference
   */
  private async updateErpOrderB2BRef(
    erpOrderId: string,
    b2bOrderId: string,
    syncStatus: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE b2b_orders
       SET b2b_order_id = $1,
           b2b_synced_at = NOW(),
           b2b_sync_status = $2,
           b2b_last_error = $3
       WHERE id = $4`,
      [b2bOrderId, syncStatus, errorMessage || null, erpOrderId],
    );
  }

  /**
   * Build output from existing sync event
   */
  private buildOutputFromEvent(event: any): SyncOrderStatusFromB2BOutput {
    const payload = event.payload as any;
    return {
      erpOrderId: event.entity_id,
      b2bOrderId: event.b2b_entity_id || '',
      previousStatus: payload.previousStatus,
      newStatus: payload.erpStatus,
      statusChanged: false,
      orderData: {} as B2BPortalOrder,
      syncedAt: event.processed_at ? new Date(event.processed_at) : new Date(event.created_at),
    };
  }
}
