/**
 * B2B Portal Webhook Controller
 *
 * Handles incoming webhooks from external B2B Portal.
 * Provides endpoints for order and invoice status updates.
 *
 * @module B2B Portal - API Controllers
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { B2BPortalApiClient } from '../../infrastructure/services/B2BPortalApiClient';
import { B2BPortalStatusMapper } from '../../infrastructure/services/B2BPortalStatusMapper';
import { DataSource } from 'typeorm';

export interface B2BWebhookPayload {
  /**
   * Webhook event type
   */
  event: string;

  /**
   * Event ID (for idempotency)
   */
  id: string;

  /**
   * Timestamp of the event
   */
  timestamp: string;

  /**
   * Entity type
   */
  entity_type: 'order' | 'invoice' | 'customer';

  /**
   * Entity data
   */
  data: Record<string, unknown>;
}

export interface OrderWebhookData {
  /**
   * B2B Portal order ID
   */
  id: string;

  /**
   * External order number
   */
  order_number: string;

  /**
   * Current status
   */
  status: string;

  /**
   * Previous status (if changed)
   */
  previous_status?: string;

  /**
   * ERP order reference ID
   */
  erp_order_id?: string;

  /**
   * Customer reference ID
   */
  customer_ref_id?: string;

  /**
   * Tracking numbers (if shipped)
   */
  tracking_numbers?: string[];

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

export interface InvoiceWebhookData {
  /**
   * B2B Portal invoice ID
   */
  id: string;

  /**
   * Invoice number
   */
  invoice_number: string;

  /**
   * Associated order ID
   */
  order_id: string;

  /**
   * Current status
   */
  status: string;

  /**
   * Previous status (if changed)
   */
  previous_status?: string;

  /**
   * ERP invoice reference ID
   */
  erp_invoice_id?: string;

  /**
   * Payment date (if paid)
   */
  paid_date?: string;

  /**
   * Payment amount
   */
  paid_amount?: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

export class B2BPortalWebhookController {
  private apiClient: B2BPortalApiClient;
  private statusMapper: B2BPortalStatusMapper;

  constructor(
    private readonly dataSource: DataSource,
    apiClient?: B2BPortalApiClient,
    statusMapper?: B2BPortalStatusMapper,
  ) {
    // These will be injected via the module context if needed
    this.apiClient = apiClient || ({} as B2BPortalApiClient);
    this.statusMapper = statusMapper || new B2BPortalStatusMapper();
  }

  setApiClient(client: B2BPortalApiClient): void {
    this.apiClient = client;
  }

  setStatusMapper(mapper: B2BPortalStatusMapper): void {
    this.statusMapper = mapper;
  }

  /**
   * Handle order status update webhook
   *
   * @route POST /webhooks/b2b/order
   */
  async handleOrderWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-b2b-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Reject missing signature unless explicitly skipped in development
      if (!signature) {
        if (
          process.env['NODE_ENV'] === 'development' &&
          process.env['SKIP_WEBHOOK_SIGNATURE'] === 'true'
        ) {
          // Allow unsigned webhooks in development when explicitly configured
        } else {
          res.status(401).json({
            success: false,
            error: { code: 'MISSING_SIGNATURE', message: 'Missing webhook signature' },
          });
          return;
        }
      } else if (this.apiClient) {
        const isValid = await this.apiClient.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
          });
          return;
        }
      }

      const payload = this.parseWebhookPayload(req.body);
      const orderData = payload.data as unknown as OrderWebhookData;

      // Check idempotency
      const existingEvent = await this.checkWebhookIdempotency(payload.id);
      if (existingEvent) {
        res.status(200).json({
          success: true,
          data: {
            message: 'Webhook already processed',
            processed_at: existingEvent.processed_at,
          },
        });
        return;
      }

      // Map status from B2B to ERP
      const statusMapping = this.statusMapper.mapOrderStatusFromB2B(orderData.status);
      const erpStatus = statusMapping.status;

      // Find ERP order by B2B reference or by order number
      const erpOrderId = await this.findErpOrderByB2BRef(
        orderData.id,
        orderData.erp_order_id,
        orderData.order_number,
      );

      if (!erpOrderId) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'ERP order not found' },
        });
        return;
      }

      // Update ERP order status
      await this.updateErpOrder(erpOrderId, {
        b2bOrderId: orderData.id,
        status: erpStatus,
        previousStatus: orderData.previous_status,
        trackingNumbers: orderData.tracking_numbers,
      });

      // Record webhook event for idempotency
      await this.recordWebhookEvent(payload.id, payload);

      res.status(200).json({
        success: true,
        data: {
          erp_order_id: erpOrderId,
          b2b_order_id: orderData.id,
          status: erpStatus,
          message: 'Order status updated successfully',
        },
      });
    } catch (error) {
      console.error('Error handling B2B order webhook:', error);
      next(error);
    }
  }

  /**
   * Handle invoice status update webhook
   *
   * @route POST /webhooks/b2b/invoice
   */
  async handleInvoiceWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-b2b-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Reject missing signature unless explicitly skipped in development
      if (!signature) {
        if (
          process.env['NODE_ENV'] === 'development' &&
          process.env['SKIP_WEBHOOK_SIGNATURE'] === 'true'
        ) {
          // Allow unsigned webhooks in development when explicitly configured
        } else {
          res.status(401).json({
            success: false,
            error: { code: 'MISSING_SIGNATURE', message: 'Missing webhook signature' },
          });
          return;
        }
      } else if (this.apiClient) {
        const isValid = await this.apiClient.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
          });
          return;
        }
      }

      const payload = this.parseWebhookPayload(req.body);
      const invoiceData = payload.data as unknown as InvoiceWebhookData;

      // Check idempotency
      const existingEvent = await this.checkWebhookIdempotency(payload.id);
      if (existingEvent) {
        res.status(200).json({
          success: true,
          data: {
            message: 'Webhook already processed',
            processed_at: existingEvent.processed_at,
          },
        });
        return;
      }

      // Map status from B2B to ERP
      const statusMapping = this.statusMapper.mapInvoiceStatusFromB2B(invoiceData.status);
      const erpStatus = statusMapping.status;

      // Find ERP invoice by B2B reference or by invoice number
      const erpInvoiceId = await this.findErpInvoiceByB2BRef(
        invoiceData.id,
        invoiceData.erp_invoice_id,
        invoiceData.invoice_number,
      );

      if (!erpInvoiceId) {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'ERP invoice not found' },
        });
        return;
      }

      // Update ERP invoice status
      await this.updateErpInvoice(erpInvoiceId, {
        b2bInvoiceId: invoiceData.id,
        status: erpStatus,
        previousStatus: invoiceData.previous_status,
        paidDate: invoiceData.paid_date,
        paidAmount: invoiceData.paid_amount,
      });

      // Record webhook event for idempotency
      await this.recordWebhookEvent(payload.id, payload);

      res.status(200).json({
        success: true,
        data: {
          erp_invoice_id: erpInvoiceId,
          b2b_invoice_id: invoiceData.id,
          status: erpStatus,
          message: 'Invoice status updated successfully',
        },
      });
    } catch (error) {
      console.error('Error handling B2B invoice webhook:', error);
      next(error);
    }
  }

  /**
   * Handle generic B2B webhook
   *
   * @route POST /webhooks/b2b
   */
  async handleGenericWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-b2b-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Reject missing signature unless explicitly skipped in development
      if (!signature) {
        if (
          process.env['NODE_ENV'] === 'development' &&
          process.env['SKIP_WEBHOOK_SIGNATURE'] === 'true'
        ) {
          // Allow unsigned webhooks in development when explicitly configured
        } else {
          res.status(401).json({
            success: false,
            error: { code: 'MISSING_SIGNATURE', message: 'Missing webhook signature' },
          });
          return;
        }
      } else if (this.apiClient) {
        const isValid = await this.apiClient.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
          });
          return;
        }
      }

      const payload = this.parseWebhookPayload(req.body);

      // Check idempotency
      const existingEvent = await this.checkWebhookIdempotency(payload.id);
      if (existingEvent) {
        res.status(200).json({
          success: true,
          data: {
            message: 'Webhook already processed',
            processed_at: existingEvent.processed_at,
          },
        });
        return;
      }

      // Record webhook event for idempotency
      await this.recordWebhookEvent(payload.id, payload);

      res.status(200).json({
        success: true,
        data: {
          event_id: payload.id,
          event_type: payload.event,
          entity_type: payload.entity_type,
          message: 'Webhook received successfully',
        },
      });
    } catch (error) {
      console.error('Error handling generic B2B webhook:', error);
      next(error);
    }
  }

  /**
   * Webhook verification endpoint
   *
   * @route GET /webhooks/b2b/verify
   */
  async verifyWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Test API connectivity
      if (this.apiClient) {
        const isConnected = await this.apiClient.testConnection();
        if (!isConnected) {
          res.status(503).json({
            success: false,
            error: { code: 'B2B_UNAVAILABLE', message: 'B2B Portal API is not accessible' },
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'B2B Portal webhook endpoint is active',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error verifying webhook:', error);
      next(error);
    }
  }

  /**
   * Parse and validate webhook payload
   */
  private parseWebhookPayload(body: unknown): B2BWebhookPayload {
    if (!body || typeof body !== 'object') {
      throw new Error('Invalid webhook payload');
    }

    const payload = body as Record<string, unknown>;

    if (!payload.event || typeof payload.event !== 'string') {
      throw new Error('Missing or invalid event field');
    }

    if (!payload.id || typeof payload.id !== 'string') {
      throw new Error('Missing or invalid id field');
    }

    if (!payload.timestamp || typeof payload.timestamp !== 'string') {
      throw new Error('Missing or invalid timestamp field');
    }

    if (!payload.entity_type || typeof payload.entity_type !== 'string') {
      throw new Error('Missing or invalid entity_type field');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      throw new Error('Missing or invalid data field');
    }

    return {
      event: payload.event,
      id: payload.id,
      timestamp: payload.timestamp,
      entity_type: payload.entity_type as 'order' | 'invoice' | 'customer',
      data: payload.data as Record<string, unknown>,
    };
  }

  /**
   * Check webhook idempotency
   */
  private async checkWebhookIdempotency(eventId: string): Promise<{ processed_at: string } | null> {
    const result = await this.dataSource.query(
      `SELECT processed_at FROM b2b_webhook_events WHERE event_id = $1 AND status = 'processed' LIMIT 1`,
      [eventId],
    );

    return result[0] || null;
  }

  /**
   * Record webhook event for idempotency
   */
  private async recordWebhookEvent(eventId: string, payload: B2BWebhookPayload): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO b2b_webhook_events (event_id, event_type, entity_type, payload, status, created_at, processed_at)
       VALUES ($1, $2, $3, $4, 'processed', NOW(), NOW())
       ON CONFLICT (event_id) DO UPDATE SET processed_at = NOW()`,
      [eventId, payload.event, payload.entity_type, JSON.stringify(payload)],
    );
  }

  /**
   * Find ERP order by B2B reference
   */
  private async findErpOrderByB2BRef(
    b2bOrderId: string,
    erpOrderId?: string,
    orderNumber?: string,
  ): Promise<string | null> {
    // Try direct B2B reference first
    let result = await this.dataSource.query(
      `SELECT id FROM b2b_orders WHERE b2b_order_id = $1 LIMIT 1`,
      [b2bOrderId],
    );

    if (result.length > 0) {
      return result[0].id;
    }

    // Try by ERP ID if provided
    if (erpOrderId) {
      result = await this.dataSource.query(`SELECT id FROM b2b_orders WHERE id = $1 LIMIT 1`, [
        erpOrderId,
      ]);

      if (result.length > 0) {
        return result[0].id;
      }
    }

    // Try by order number if provided
    if (orderNumber) {
      result = await this.dataSource.query(
        `SELECT id FROM b2b_orders WHERE order_number = $1 LIMIT 1`,
        [orderNumber],
      );

      if (result.length > 0) {
        return result[0].id;
      }
    }

    return null;
  }

  /**
   * Find ERP invoice by B2B reference
   */
  private async findErpInvoiceByB2BRef(
    b2bInvoiceId: string,
    erpInvoiceId?: string,
    invoiceNumber?: string,
  ): Promise<string | null> {
    // Try direct B2B reference first
    let result = await this.dataSource.query(
      `SELECT id FROM invoices WHERE b2b_invoice_id = $1 LIMIT 1`,
      [b2bInvoiceId],
    );

    if (result.length > 0) {
      return result[0].id;
    }

    // Try by ERP ID if provided
    if (erpInvoiceId) {
      result = await this.dataSource.query(`SELECT id FROM invoices WHERE id = $1 LIMIT 1`, [
        erpInvoiceId,
      ]);

      if (result.length > 0) {
        return result[0].id;
      }
    }

    // Try by invoice number if provided
    if (invoiceNumber) {
      result = await this.dataSource.query(
        `SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1`,
        [invoiceNumber],
      );

      if (result.length > 0) {
        return result[0].id;
      }
    }

    return null;
  }

  /**
   * Update ERP order
   */
  private async updateErpOrder(
    erpOrderId: string,
    data: {
      b2bOrderId: string;
      status: string;
      previousStatus?: string;
      trackingNumbers?: string[];
    },
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE b2b_orders
       SET b2b_order_id = $1,
           status = $2,
           b2b_synced_at = NOW(),
           b2b_sync_status = 'synced',
           b2b_last_error = NULL,
           tracking_numbers = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [
        data.b2bOrderId,
        data.status,
        data.trackingNumbers ? JSON.stringify(data.trackingNumbers) : null,
        erpOrderId,
      ],
    );
  }

  /**
   * Update ERP invoice
   */
  private async updateErpInvoice(
    erpInvoiceId: string,
    data: {
      b2bInvoiceId: string;
      status: string;
      previousStatus?: string;
      paidDate?: string;
      paidAmount?: number;
    },
  ): Promise<void> {
    const updates = [
      'b2b_invoice_id = $1',
      'status = $2',
      'b2b_synced_at = NOW()',
      "b2b_sync_status = 'synced'",
      'b2b_last_error = NULL',
      'updated_at = NOW()',
    ];

    const params: any[] = [data.b2bInvoiceId, data.status];
    let paramIndex = 3;

    if (data.paidDate) {
      updates.push(`paid_date = $${paramIndex}`);
      params.push(data.paidDate);
      paramIndex++;
    }

    if (data.paidAmount !== undefined) {
      updates.push(`paid_amount = $${paramIndex}`);
      params.push(data.paidAmount);
      paramIndex++;
    }

    params.push(erpInvoiceId);

    await this.dataSource.query(
      `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );
  }
}
