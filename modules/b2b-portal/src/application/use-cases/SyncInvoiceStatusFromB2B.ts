/**
 * Sync Invoice Status from B2B Portal Use Case
 *
 * Synchronizes invoice status from external B2B Portal to internal ERP.
 * Handles status mapping, idempotency, and event emission.
 *
 * @module B2B Portal - Application Use Cases
 */

import { IB2BSyncEventRepository } from '../../domain/repositories/IB2BSyncEventRepository';
import {
  B2BPortalApiClient,
  B2BPortalInvoice,
} from '../../infrastructure/services/B2BPortalApiClient';
import {
  B2BPortalStatusMapper,
  ErpInvoiceStatus,
} from '../../infrastructure/services/B2BPortalStatusMapper';
import { DataSource } from 'typeorm';

export interface SyncInvoiceStatusFromB2BInput {
  /**
   * Internal ERP invoice ID
   */
  erpInvoiceId: string;

  /**
   * External B2B Portal invoice ID (optional if stored in DB)
   */
  b2bInvoiceId?: string;

  /**
   * Idempotency key for preventing duplicate syncs
   */
  idempotencyKey?: string;

  /**
   * Whether to force sync even if status hasn't changed
   */
  force?: boolean;
}

export interface SyncInvoiceStatusFromB2BOutput {
  /**
   * Internal ERP invoice ID
   */
  erpInvoiceId: string;

  /**
   * External B2B Portal invoice ID
   */
  b2bInvoiceId: string;

  /**
   * Previous status in ERP
   */
  previousStatus: ErpInvoiceStatus | null;

  /**
   * New status after sync
   */
  newStatus: ErpInvoiceStatus;

  /**
   * Whether the status changed
   */
  statusChanged: boolean;

  /**
   * Full invoice data from B2B Portal
   */
  invoiceData: B2BPortalInvoice;

  /**
   * Timestamp of the sync
   */
  syncedAt: Date;

  /**
   * Event published for the status change (if any)
   */
  event?: string;
}

export class SyncInvoiceStatusFromB2B {
  constructor(
    private readonly syncEventRepository: IB2BSyncEventRepository,
    private readonly apiClient: B2BPortalApiClient,
    private readonly statusMapper: B2BPortalStatusMapper,
    private readonly dataSource: DataSource,
    private readonly publishEvent: (event: string, data: unknown) => Promise<void>,
  ) {}

  /**
   * Execute the invoice status sync
   */
  async execute(input: SyncInvoiceStatusFromB2BInput): Promise<SyncInvoiceStatusFromB2BOutput> {
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

    // Get B2B invoice ID if not provided
    let b2bInvoiceId: string | null = input.b2bInvoiceId ?? null;
    if (!b2bInvoiceId) {
      b2bInvoiceId = await this.getB2BInvoiceIdFromDB(input.erpInvoiceId);
      if (!b2bInvoiceId) {
        throw new Error(`No B2B invoice ID found for ERP invoice: ${input.erpInvoiceId}`);
      }
    }

    // Fetch invoice from B2B Portal
    const invoiceData = await this.apiClient.getInvoice(b2bInvoiceId);

    // Map status from B2B to ERP
    const statusMapping = this.statusMapper.mapInvoiceStatusFromB2B(invoiceData.status);
    const newStatus = statusMapping.status;

    // Get current ERP invoice status
    const currentInvoice = await this.getErpInvoice(input.erpInvoiceId);
    const previousStatus = currentInvoice ? (currentInvoice.status as ErpInvoiceStatus) : null;

    // Check if status changed
    const statusChanged = previousStatus !== newStatus || input.force;

    // Create sync event
    const syncEvent = await this.syncEventRepository.create({
      entityType: 'invoice',
      entityId: input.erpInvoiceId,
      b2bEntityId: b2bInvoiceId,
      eventType: 'status_change',
      direction: 'inbound',
      payload: {
        b2bStatus: invoiceData.status,
        erpStatus: newStatus,
        previousStatus,
        force: input.force,
      },
      idempotencyKey: input.idempotencyKey,
    });

    if (statusChanged) {
      try {
        // Update ERP invoice status
        await this.updateErpInvoiceStatus(input.erpInvoiceId, newStatus);

        // Update B2B reference in ERP invoice
        await this.updateErpInvoiceB2BRef(input.erpInvoiceId, b2bInvoiceId, 'synced');

        // Mark sync event as success
        await this.syncEventRepository.markAsSuccess(syncEvent.id, b2bInvoiceId);

        // Emit event for status change
        let publishedEvent: string | undefined;
        if (previousStatus !== newStatus) {
          const eventName = `b2b.invoice_status_changed`;
          await this.publishEvent(eventName, {
            erpInvoiceId: input.erpInvoiceId,
            b2bInvoiceId: b2bInvoiceId,
            previousStatus,
            newStatus,
            b2bStatus: invoiceData.status,
            timestamp: new Date().toISOString(),
          });
          publishedEvent = eventName;
        }

        return {
          erpInvoiceId: input.erpInvoiceId,
          b2bInvoiceId: b2bInvoiceId,
          previousStatus,
          newStatus,
          statusChanged,
          invoiceData,
          syncedAt: new Date(),
          event: publishedEvent,
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
          b2bInvoiceId,
          'failed',
          error instanceof Error ? error.message : String(error),
        );

        throw error;
      }
    } else {
      // Status unchanged - mark as success without updating
      await this.syncEventRepository.markAsSuccess(syncEvent.id, b2bInvoiceId);

      // Update sync timestamp without changing status
      await this.updateErpInvoiceB2BRef(input.erpInvoiceId, b2bInvoiceId, 'synced');

      return {
        erpInvoiceId: input.erpInvoiceId,
        b2bInvoiceId: b2bInvoiceId,
        previousStatus,
        newStatus,
        statusChanged: false,
        invoiceData,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Batch sync multiple invoices
   */
  async syncMany(invoiceIds: string[]): Promise<SyncInvoiceStatusFromB2BOutput[]> {
    const results: SyncInvoiceStatusFromB2BOutput[] = [];
    const errors: Array<{ invoiceId: string; error: Error }> = [];

    for (const invoiceId of invoiceIds) {
      try {
        const result = await this.execute({ erpInvoiceId: invoiceId });
        results.push(result);
      } catch (error) {
        errors.push({
          invoiceId,
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
   * Get ERP invoice from database
   */
  private async getErpInvoice(
    erpInvoiceId: string,
  ): Promise<{ id: string; status: string } | null> {
    const result = await this.dataSource.query(
      `SELECT id, status FROM invoices WHERE id = $1 LIMIT 1`,
      [erpInvoiceId],
    );

    return result[0] || null;
  }

  /**
   * Update ERP invoice status
   */
  private async updateErpInvoiceStatus(
    erpInvoiceId: string,
    status: ErpInvoiceStatus,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE invoices
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [status, erpInvoiceId],
    );
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

  /**
   * Build output from existing sync event
   */
  private buildOutputFromEvent(event: any): SyncInvoiceStatusFromB2BOutput {
    const payload = event.payload as any;
    return {
      erpInvoiceId: event.entity_id,
      b2bInvoiceId: event.b2b_entity_id || '',
      previousStatus: payload.previousStatus,
      newStatus: payload.erpStatus,
      statusChanged: false,
      invoiceData: {} as B2BPortalInvoice,
      syncedAt: event.processed_at ? new Date(event.processed_at) : new Date(event.created_at),
    };
  }
}
