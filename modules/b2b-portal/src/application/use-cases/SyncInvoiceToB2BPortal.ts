/**
 * Sync Invoice to B2B Portal Use Case
 *
 * Creates or updates an invoice in the external B2B Portal from internal ERP.
 * Handles idempotency and reference ID storage.
 *
 * @module B2B Portal - Application Use Cases
 */

import { IB2BSyncEventRepository } from '../../domain/repositories/IB2BSyncEventRepository';
import {
  B2BPortalApiClient,
  CreateInvoiceRequest,
} from '../../infrastructure/services/B2BPortalApiClient';
import {
  B2BPortalStatusMapper,
  ErpInvoiceStatus,
} from '../../infrastructure/services/B2BPortalStatusMapper';
import { DataSource } from 'typeorm';

export interface SyncInvoiceToB2BPortalInput {
  /**
   * Internal ERP invoice ID
   */
  erpInvoiceId: string;

  /**
   * Invoice data to sync
   */
  invoiceData: {
    invoiceNumber: string;
    orderId: string;
    customerId: string;
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      taxRate: number;
    }>;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    issueDate: string;
    dueDate: string;
  };

  /**
   * Current invoice status
   */
  status: ErpInvoiceStatus;

  /**
   * Idempotency key for preventing duplicate creates
   */
  idempotencyKey?: string;

  /**
   * Whether to update existing B2B invoice instead of creating new
   */
  update?: boolean;
}

export interface SyncInvoiceToB2BPortalOutput {
  /**
   * Internal ERP invoice ID
   */
  erpInvoiceId: string;

  /**
   * External B2B Portal invoice ID
   */
  b2bInvoiceId: string;

  /**
   * B2B Portal invoice number
   */
  b2bInvoiceNumber: string;

  /**
   * Whether a new invoice was created or existing updated
   */
  action: 'created' | 'updated';

  /**
   * Timestamp of the sync
   */
  syncedAt: Date;
}

export class SyncInvoiceToB2BPortal {
  constructor(
    private readonly syncEventRepository: IB2BSyncEventRepository,
    private readonly apiClient: B2BPortalApiClient,
    private readonly statusMapper: B2BPortalStatusMapper,
    private readonly dataSource: DataSource,
    private readonly publishEvent: (event: string, data: unknown) => Promise<void>,
  ) {}

  /**
   * Execute the invoice sync to B2B Portal
   */
  async execute(input: SyncInvoiceToB2BPortalInput): Promise<SyncInvoiceToB2BPortalOutput> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existingEvent = await this.syncEventRepository.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existingEvent && existingEvent.status === 'success' && existingEvent.b2bEntityId) {
        // Return cached result
        return {
          erpInvoiceId: input.erpInvoiceId,
          b2bInvoiceId: existingEvent.b2bEntityId,
          b2bInvoiceNumber: (existingEvent.payload?.['b2bInvoiceNumber'] as string) || '',
          action: 'created',
          syncedAt: existingEvent.processedAt
            ? new Date(existingEvent.processedAt)
            : new Date(existingEvent.createdAt),
        };
      }
    }

    // Check if invoice already has B2B reference
    const existingB2BInvoiceId = await this.getB2BInvoiceIdFromDB(input.erpInvoiceId);
    const shouldUpdate = input.update || existingB2BInvoiceId !== null;

    let b2bInvoiceResult: { id: string; invoiceNumber: string; status: string };

    if (shouldUpdate && existingB2BInvoiceId) {
      // Update existing invoice status
      const b2bStatus = this.statusMapper.mapInvoiceStatusToB2B(input.status).status;
      b2bInvoiceResult = await this.apiClient.updateInvoiceStatus(
        existingB2BInvoiceId,
        b2bStatus,
        undefined, // No notes for invoice updates
      );
    } else {
      // Create new invoice in B2B Portal
      const createRequest: CreateInvoiceRequest = {
        erpInvoiceId: input.erpInvoiceId,
        orderId: input.invoiceData.orderId,
        invoiceNumber: input.invoiceData.invoiceNumber,
        customerId: input.invoiceData.customerId,
        items: input.invoiceData.items,
        subtotal: input.invoiceData.subtotal,
        taxAmount: input.invoiceData.taxAmount,
        totalAmount: input.invoiceData.totalAmount,
        currency: input.invoiceData.currency,
        issueDate: input.invoiceData.issueDate,
        dueDate: input.invoiceData.dueDate,
      };

      b2bInvoiceResult = await this.apiClient.createInvoice(createRequest, input.idempotencyKey);
    }

    // Create sync event
    const syncEvent = await this.syncEventRepository.create({
      entityType: 'invoice',
      entityId: input.erpInvoiceId,
      b2bEntityId: b2bInvoiceResult.id,
      eventType: shouldUpdate ? 'update' : 'create',
      direction: 'outbound',
      payload: {
        b2bInvoiceNumber: b2bInvoiceResult.invoiceNumber,
        erpStatus: input.status,
        b2bStatus: b2bInvoiceResult.status,
      },
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // Update ERP invoice with B2B reference
      await this.updateErpInvoiceB2BRef(input.erpInvoiceId, b2bInvoiceResult.id, 'synced');

      // Mark sync event as success
      await this.syncEventRepository.markAsSuccess(syncEvent.id, b2bInvoiceResult.id);

      // Emit event for successful sync
      await this.publishEvent('b2b.invoice_synced', {
        erpInvoiceId: input.erpInvoiceId,
        b2bInvoiceId: b2bInvoiceResult.id,
        b2bInvoiceNumber: b2bInvoiceResult.invoiceNumber,
        action: shouldUpdate ? 'updated' : 'created',
        timestamp: new Date().toISOString(),
      });

      return {
        erpInvoiceId: input.erpInvoiceId,
        b2bInvoiceId: b2bInvoiceResult.id,
        b2bInvoiceNumber: b2bInvoiceResult.invoiceNumber,
        action: shouldUpdate ? 'updated' : 'created',
        syncedAt: new Date(),
      };
    } catch (error) {
      // Mark sync event as failed
      await this.syncEventRepository.markAsFailed(
        syncEvent.id,
        error instanceof Error ? error.message : String(error),
      );

      // Update ERP invoice with sync failure
      await this.updateErpInvoiceB2BRef(
        input.erpInvoiceId,
        b2bInvoiceResult.id,
        'failed',
        error instanceof Error ? error.message : String(error),
      );

      throw error;
    }
  }

  /**
   * Get B2B invoice ID from database
   */
  private async getB2BInvoiceIdFromDB(erpInvoiceId: string): Promise<string | null> {
    const result = await this.dataSource.query(
      `SELECT b2b_invoice_id FROM invoices WHERE id = $1 LIMIT 1`,
      [erpInvoiceId],
    );

    return result[0]?.b2b_invoice_id || null;
  }

  /**
   * Update ERP invoice B2B reference
   */
  private async updateErpInvoiceB2BRef(
    erpInvoiceId: string,
    b2bInvoiceId: string,
    syncStatus: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE invoices
       SET b2b_invoice_id = $1,
           b2b_synced_at = NOW(),
           b2b_sync_status = $2,
           b2b_last_error = $3
       WHERE id = $4`,
      [b2bInvoiceId, syncStatus, errorMessage || null, erpInvoiceId],
    );
  }
}
