/**
 * Sync Order to B2B Portal Use Case
 *
 * Creates or updates an order in the external B2B Portal from internal ERP.
 * Handles idempotency and reference ID storage.
 *
 * @module B2B Portal - Application Use Cases
 */

import { IB2BSyncEventRepository } from '../../domain/repositories/IB2BSyncEventRepository';
import {
  B2BPortalApiClient,
  CreateOrderRequest,
} from '../../infrastructure/services/B2BPortalApiClient';
import {
  B2BPortalStatusMapper,
  ErpOrderStatus,
} from '../../infrastructure/services/B2BPortalStatusMapper';
import { DataSource } from 'typeorm';

export interface SyncOrderToB2BPortalInput {
  /**
   * Internal ERP order ID
   */
  erpOrderId: string;

  /**
   * Order data to sync
   */
  orderData: {
    orderNumber: string;
    customerId: string;
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    totalAmount: number;
    currency: string;
    shippingAddress: string;
    billingAddress?: string;
    contactName: string;
    contactPhone?: string;
    notes?: string;
    purchaseOrderNumber?: string;
  };

  /**
   * Current order status
   */
  status: ErpOrderStatus;

  /**
   * Idempotency key for preventing duplicate creates
   */
  idempotencyKey?: string;

  /**
   * Whether to update existing B2B order instead of creating new
   */
  update?: boolean;
}

export interface SyncOrderToB2BPortalOutput {
  /**
   * Internal ERP order ID
   */
  erpOrderId: string;

  /**
   * External B2B Portal order ID
   */
  b2bOrderId: string;

  /**
   * B2B Portal order number
   */
  b2bOrderNumber: string;

  /**
   * Whether a new order was created or existing updated
   */
  action: 'created' | 'updated';

  /**
   * Timestamp of the sync
   */
  syncedAt: Date;
}

export class SyncOrderToB2BPortal {
  constructor(
    private readonly syncEventRepository: IB2BSyncEventRepository,
    private readonly apiClient: B2BPortalApiClient,
    private readonly statusMapper: B2BPortalStatusMapper,
    private readonly dataSource: DataSource,
    private readonly publishEvent: (event: string, data: unknown) => Promise<void>,
  ) {}

  /**
   * Execute the order sync to B2B Portal
   */
  async execute(input: SyncOrderToB2BPortalInput): Promise<SyncOrderToB2BPortalOutput> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existingEvent = await this.syncEventRepository.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existingEvent && existingEvent.status === 'success' && existingEvent.b2bEntityId) {
        // Return cached result
        return {
          erpOrderId: input.erpOrderId,
          b2bOrderId: existingEvent.b2bEntityId,
          b2bOrderNumber: (existingEvent.payload?.['b2bOrderNumber'] as string) || '',
          action: 'created',
          syncedAt: existingEvent.processedAt
            ? new Date(existingEvent.processedAt)
            : new Date(existingEvent.createdAt),
        };
      }
    }

    // Check if order already has B2B reference
    const existingB2BOrderId = await this.getB2BOrderIdFromDB(input.erpOrderId);
    const shouldUpdate = input.update || existingB2BOrderId !== null;

    let b2bOrderResult: { id: string; orderNumber: string; status: string };

    if (shouldUpdate && existingB2BOrderId) {
      // Update existing order status
      const b2bStatus = this.statusMapper.mapOrderStatusToB2B(input.status).status;
      b2bOrderResult = await this.apiClient.updateOrderStatus(
        existingB2BOrderId,
        b2bStatus,
        input.orderData.notes,
      );
    } else {
      // Create new order in B2B Portal
      const createRequest: CreateOrderRequest = {
        erpOrderId: input.erpOrderId,
        orderNumber: input.orderData.orderNumber,
        customerId: input.orderData.customerId,
        items: input.orderData.items,
        totalAmount: input.orderData.totalAmount,
        currency: input.orderData.currency,
        shippingAddress: input.orderData.shippingAddress,
        billingAddress: input.orderData.billingAddress,
        contactName: input.orderData.contactName,
        contactPhone: input.orderData.contactPhone,
        notes: input.orderData.notes,
        purchaseOrderNumber: input.orderData.purchaseOrderNumber,
      };

      b2bOrderResult = await this.apiClient.createOrder(createRequest, input.idempotencyKey);
    }

    // Create sync event
    const syncEvent = await this.syncEventRepository.create({
      entityType: 'order',
      entityId: input.erpOrderId,
      b2bEntityId: b2bOrderResult.id,
      eventType: shouldUpdate ? 'update' : 'create',
      direction: 'outbound',
      payload: {
        b2bOrderNumber: b2bOrderResult.orderNumber,
        erpStatus: input.status,
        b2bStatus: b2bOrderResult.status,
      },
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // Update ERP order with B2B reference
      await this.updateErpOrderB2BRef(input.erpOrderId, b2bOrderResult.id, 'synced');

      // Mark sync event as success
      await this.syncEventRepository.markAsSuccess(syncEvent.id, b2bOrderResult.id);

      // Emit event for successful sync
      await this.publishEvent('b2b.order_synced', {
        erpOrderId: input.erpOrderId,
        b2bOrderId: b2bOrderResult.id,
        b2bOrderNumber: b2bOrderResult.orderNumber,
        action: shouldUpdate ? 'updated' : 'created',
        timestamp: new Date().toISOString(),
      });

      return {
        erpOrderId: input.erpOrderId,
        b2bOrderId: b2bOrderResult.id,
        b2bOrderNumber: b2bOrderResult.orderNumber,
        action: shouldUpdate ? 'updated' : 'created',
        syncedAt: new Date(),
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
        b2bOrderResult.id,
        'failed',
        error instanceof Error ? error.message : String(error),
      );

      throw error;
    }
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
}
