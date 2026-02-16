/**
 * B2B Portal Sync Controller
 *
 * Provides API endpoints for manually triggering B2B Portal synchronization
 * and viewing sync status for orders and invoices.
 *
 * @module B2B Portal - API Controllers
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource } from 'typeorm';

export interface SyncStatusResponse {
  erpOrderId: string;
  b2bOrderId: string | null;
  syncStatus: string;
  syncedAt: string | null;
  lastError: string | null;
  syncEvents: Array<{
    id: string;
    eventType: string;
    direction: string;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }>;
}

export class B2BPortalSyncController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get sync status for an order
   *
   * @route GET /b2b/sync/orders/:id
   */
  async getOrderSyncStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      // Get order sync status
      const orderResult = await this.dataSource.query(
        `SELECT
          id,
          b2b_order_id,
          b2b_sync_status,
          b2b_synced_at,
          b2b_last_error
         FROM b2b_orders
         WHERE id = $1`,
        [id],
      );

      if (orderResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
        return;
      }

      const order = orderResult[0];

      // Get sync events for this order
      const syncEvents = await this.dataSource.query(
        `SELECT
          id,
          event_type,
          direction,
          status,
          created_at,
          processed_at,
          error_message
         FROM b2b_sync_events
         WHERE entity_type = 'order' AND entity_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [id],
      );

      res.status(200).json({
        success: true,
        data: {
          erpOrderId: order.id,
          b2bOrderId: order.b2b_order_id,
          syncStatus: order.b2b_sync_status || 'pending',
          syncedAt: order.b2b_synced_at,
          lastError: order.b2b_last_error,
          syncEvents: syncEvents.map((event: any) => ({
            id: event.id,
            eventType: event.event_type,
            direction: event.direction,
            status: event.status,
            createdAt: event.created_at,
            processedAt: event.processed_at,
            errorMessage: event.error_message,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sync status for an invoice
   *
   * @route GET /b2b/sync/invoices/:id
   */
  async getInvoiceSyncStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      // Get invoice sync status
      const invoiceResult = await this.dataSource.query(
        `SELECT
          id,
          b2b_invoice_id,
          b2b_sync_status,
          b2b_synced_at,
          b2b_last_error
         FROM invoices
         WHERE id = $1`,
        [id],
      );

      if (invoiceResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
        return;
      }

      const invoice = invoiceResult[0];

      // Get sync events for this invoice
      const syncEvents = await this.dataSource.query(
        `SELECT
          id,
          event_type,
          direction,
          status,
          created_at,
          processed_at,
          error_message
         FROM b2b_sync_events
         WHERE entity_type = 'invoice' AND entity_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [id],
      );

      res.status(200).json({
        success: true,
        data: {
          erpInvoiceId: invoice.id,
          b2bInvoiceId: invoice.b2b_invoice_id,
          syncStatus: invoice.b2b_sync_status || 'pending',
          syncedAt: invoice.b2b_synced_at,
          lastError: invoice.b2b_last_error,
          syncEvents: syncEvents.map((event: any) => ({
            id: event.id,
            eventType: event.event_type,
            direction: event.direction,
            status: event.status,
            createdAt: event.created_at,
            processedAt: event.processed_at,
            errorMessage: event.error_message,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all pending sync events
   *
   * @route GET /b2b/sync/pending
   */
  async getPendingSyncEvents(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { entityType, limit = 50 } = req.query as Record<string, any>;

      const whereClause = entityType
        ? `WHERE status IN ('pending', 'retrying') AND entity_type = $1`
        : `WHERE status IN ('pending', 'retrying')`;

      const params = entityType ? [entityType, parseInt(limit)] : [parseInt(limit)];

      const query = `
        SELECT
          id,
          entity_type,
          entity_id,
          b2b_entity_id,
          event_type,
          direction,
          status,
          retry_count,
          created_at,
          error_message
         FROM b2b_sync_events
         ${whereClause}
         ORDER BY created_at ASC
         LIMIT $${params.length}
      `;

      const events = await this.dataSource.query(query, params);

      res.status(200).json({
        success: true,
        data: {
          events: events.map((event: any) => ({
            id: event.id,
            entityType: event.entity_type,
            entityId: event.entity_id,
            b2bEntityId: event.b2b_entity_id,
            eventType: event.event_type,
            direction: event.direction,
            status: event.status,
            retryCount: event.retry_count,
            createdAt: event.created_at,
            errorMessage: event.error_message,
          })),
          count: events.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sync statistics
   *
   * @route GET /b2b/sync/statistics
   */
  async getSyncStatistics(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await this.dataSource.query(`
        SELECT
          entity_type,
          status,
          COUNT(*) as count
         FROM b2b_sync_events
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY entity_type, status
         ORDER BY entity_type, status
      `);

      const orderStats = stats.filter((s: any) => s.entity_type === 'order');
      const invoiceStats = stats.filter((s: any) => s.entity_type === 'invoice');

      res.status(200).json({
        success: true,
        data: {
          orders: this.formatStats(orderStats),
          invoices: this.formatStats(invoiceStats),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger manual sync for an order
   *
   * @route POST /b2b/sync/orders/:id/sync
   */
  async syncOrder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { force = false } = req.body as Record<string, any>;

      // Check if order has B2B reference
      const orderResult = await this.dataSource.query(
        `SELECT b2b_order_id FROM b2b_orders WHERE id = $1`,
        [id],
      );

      if (orderResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
        return;
      }

      if (!orderResult[0].b2b_order_id && !force) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_B2B_REFERENCE', message: 'Order not synced to B2B Portal yet' },
        });
        return;
      }

      // Create a sync event for manual sync
      const syncEventId = crypto.randomUUID();
      await this.dataSource.query(
        `INSERT INTO b2b_sync_events (
          id, entity_type, entity_id, event_type, direction,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [syncEventId, 'order', id, 'manual_sync', 'outbound', 'pending'],
      );

      res.status(202).json({
        success: true,
        data: {
          message: 'Sync initiated',
          syncEventId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger manual sync for an invoice
   *
   * @route POST /b2b/sync/invoices/:id/sync
   */
  async syncInvoice(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { force = false } = req.body as Record<string, any>;

      // Check if invoice has B2B reference
      const invoiceResult = await this.dataSource.query(
        `SELECT b2b_invoice_id FROM invoices WHERE id = $1`,
        [id],
      );

      if (invoiceResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
        return;
      }

      if (!invoiceResult[0].b2b_invoice_id && !force) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_B2B_REFERENCE', message: 'Invoice not synced to B2B Portal yet' },
        });
        return;
      }

      // Create a sync event for manual sync
      const syncEventId = crypto.randomUUID();
      await this.dataSource.query(
        `INSERT INTO b2b_sync_events (
          id, entity_type, entity_id, event_type, direction,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [syncEventId, 'invoice', id, 'manual_sync', 'outbound', 'pending'],
      );

      res.status(202).json({
        success: true,
        data: {
          message: 'Sync initiated',
          syncEventId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Format stats for response
   */
  private formatStats(stats: any[]): Record<string, number> {
    const result: Record<string, number> = {
      pending: 0,
      success: 0,
      failed: 0,
      retrying: 0,
      total: 0,
    };

    for (const stat of stats) {
      const status = stat.status.toLowerCase();
      result[status] = (result[status] || 0) + parseInt(stat.count);
      result.total += parseInt(stat.count);
    }

    return result;
  }
}
