import { Request, Response } from 'express';
import { CreateInvoiceUseCase } from '../../application/use-cases/CreateInvoice';
import { CreateProformaUseCase } from '../../application/use-cases/CreateProforma';
import { CreateProformaFromQuoteUseCase } from '../../application/use-cases/CreateProformaFromQuote';
import { ConvertProformaToInvoiceUseCase } from '../../application/use-cases/ConvertProformaToInvoice';
import { SyncInvoiceStatusUseCase } from '../../application/use-cases/SyncInvoiceStatus';
import { SyncStockUseCase } from '../../application/use-cases/SyncStock';
import { GetWarehousesUseCase } from '../../application/use-cases/GetWarehouses';
import { SyncPricesFromInvoicesUseCase } from '../../application/use-cases/SyncPricesFromInvoices';
import { ImportPricesFromExcelUseCase } from '../../application/use-cases/ImportPricesFromExcel';
import { SyncSmartBillCustomers } from '../../application/use-cases/SyncSmartBillCustomers';
import { CustomerMatchingService } from '../../application/services/CustomerMatchingService';
import { SyncMonitorService } from '../../application/services/SyncMonitorService';
import { ISmartBillRepository } from '../../application/ports/ISmartBillRepository';
import { SmartBillApiClient } from '../../infrastructure/api-client/SmartBillApiClient';
import { SmartBillError } from '../../application/errors/smartbill.errors';
import { DataSource } from 'typeorm';
import { successResponse, errorResponse } from '@shared/utils/response';
import { getAuditLogger } from '@shared/utils/audit-logger';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('smartbill-controller');

export class SmartBillController {
  constructor(
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly createProformaUseCase: CreateProformaUseCase,
    private readonly syncStockUseCase: SyncStockUseCase,
    private readonly getWarehousesUseCase: GetWarehousesUseCase,
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: SmartBillApiClient,
    private readonly syncPricesUseCase?: SyncPricesFromInvoicesUseCase,
    private readonly importExcelUseCase?: ImportPricesFromExcelUseCase,
    private readonly syncSmartBillCustomers?: SyncSmartBillCustomers,
    private readonly createProformaFromQuoteUseCase?: CreateProformaFromQuoteUseCase,
    private readonly dataSource?: DataSource,
    private readonly customerMatchingService?: CustomerMatchingService,
    private readonly syncMonitorService?: SyncMonitorService,
    private readonly convertProformaToInvoiceUseCase?: ConvertProformaToInvoiceUseCase,
    private readonly syncInvoiceStatusUseCase?: SyncInvoiceStatusUseCase,
  ) {}

  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createInvoiceUseCase.execute(req.body);
      res.status(201).json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async createProforma(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createProformaUseCase.execute(req.body);
      res.status(201).json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const invoice = await this.repository.getInvoice(parseInt(req.params.id));
      if (!invoice) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Invoice not found', 404));
        return;
      }
      res.json(
        successResponse({
          id: invoice.id,
          orderId: invoice.orderId,
          smartBillId: invoice.smartBillId,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          totalWithVat: invoice.totalWithVat,
          items: invoice.items,
          paidAmount: invoice.paidAmount || 0,
          paymentDate: invoice.paymentDate || null,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getProforma(req: Request, res: Response): Promise<void> {
    try {
      const proforma = await this.repository.getProforma(parseInt(req.params.id));
      if (!proforma) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Proforma not found', 404));
        return;
      }
      res.json(
        successResponse({
          id: proforma.id,
          orderId: proforma.orderId,
          smartBillId: proforma.smartBillId,
          proformaNumber: proforma.proformaNumber,
          status: proforma.status,
          totalWithVat: proforma.totalWithVat,
          items: proforma.items,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncStock(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.syncStockUseCase.execute();
      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getWarehouses(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.getWarehousesUseCase.execute();
      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getInvoiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.invoiceId);

      if (!invoiceId || isNaN(invoiceId)) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid invoice ID', 400));
        return;
      }

      // Get invoice from local DB to get smartBillId
      const invoice = await this.repository.getInvoice(invoiceId);

      if (!invoice) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Invoice not found', 404));
        return;
      }

      // If no smartBillId, we can't check status - return local status
      if (!invoice.smartBillId) {
        res.json(
          successResponse({
            invoiceId: invoiceId,
            status: invoice.status,
            paidAmount: invoice.paidAmount || 0,
            totalAmount: invoice.totalWithVat,
            paymentDate: invoice.paymentDate || null,
            message: 'Invoice not synced with SmartBill - returning local status',
          }),
        );
        return;
      }

      // Call real SmartBill API
      const status = await this.apiClient.getPaymentStatus(invoice.smartBillId);

      // Update local record if changed
      if (status.status === 'paid' && invoice.status !== 'paid') {
        invoice.markPaid(status.paidAmount, status.paymentDate || new Date());
        await this.repository.updateInvoice(invoice);
      }

      res.json(
        successResponse({
          invoiceId: invoice.id,
          smartBillId: invoice.smartBillId,
          status: status.status,
          paidAmount: status.paidAmount,
          totalAmount: status.totalAmount,
          paymentDate: status.paymentDate,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async markInvoicePaid(req: Request, res: Response): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const invoice = await this.repository.getInvoice(invoiceId);

      if (!invoice) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Invoice not found', 404));
        return;
      }

      const amount = req.body.paidAmount ? parseFloat(req.body.paidAmount) : undefined;
      const date = req.body.paymentDate ? new Date(req.body.paymentDate) : undefined;

      const userId = (req as any).user?.id || 'unknown';
      const requestId = (req as any).requestId || 'no-request-id';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      // Store previous state for audit
      const previousState = {
        status: invoice.status,
        paidAmount: invoice.paidAmount,
        paymentDate: invoice.paymentDate,
      };

      invoice.markPaid(amount, date);
      await this.repository.updateInvoice(invoice);

      // Log audit event
      const auditLogger = getAuditLogger();
      try {
        await auditLogger.logEvent({
          id: `${requestId}-invoice-${invoiceId}`,
          timestamp: new Date(),
          requestId,
          userId: typeof userId === 'string' ? undefined : userId,
          action: 'UPDATE',
          resource: 'SmartBillInvoice',
          resourceId: String(invoice.id ?? 0),
          changes: {
            before: previousState,
            after: {
              status: invoice.status,
              paidAmount: invoice.paidAmount,
              paymentDate: invoice.paymentDate,
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      res.json(
        successResponse({
          invoiceId: invoice.id,
          status: invoice.status,
          paidAmount: invoice.paidAmount,
          paymentDate: invoice.paymentDate,
          message: 'Invoice marked as paid',
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncPricesFromInvoices(req: Request, res: Response): Promise<void> {
    try {
      if (!this.syncPricesUseCase) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Price sync feature not available', 503));
        return;
      }

      const daysBack = parseInt(req.query.daysBack as string) || 90;
      const updateStrategy = (req.query.strategy as 'latest' | 'average') || 'latest';

      const result = await this.syncPricesUseCase.execute(daysBack, updateStrategy);

      res.json(
        successResponse({
          message: 'Price sync completed',
          totalInvoices: result.totalInvoices,
          totalProducts: result.totalProducts,
          productsUpdated: result.productsUpdated,
          productsCostUpdated: result.productsCostUpdated,
          uniqueProducts: result.pricesExtracted.size,
          errors: result.errors.slice(0, 10),
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async previewPricesFromInvoices(req: Request, res: Response): Promise<void> {
    try {
      if (!this.syncPricesUseCase) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Price sync feature not available', 503));
        return;
      }

      const daysBack = parseInt(req.query.daysBack as string) || 90;

      const result = await this.syncPricesUseCase.previewPrices(daysBack);

      res.json(
        successResponse({
          totalInvoices: result.totalInvoices,
          totalProducts: result.productPrices.length,
          productPrices: result.productPrices.slice(0, 50),
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async importPricesFromExcel(req: Request, res: Response): Promise<void> {
    try {
      if (!this.importExcelUseCase) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Excel import feature not available', 503));
        return;
      }

      const file = (req as any).file;
      if (!file) {
        res.status(400).json(errorResponse('MISSING_FILE', 'No file uploaded', 400));
        return;
      }

      const options = {
        skuColumn: req.body.skuColumn,
        priceColumn: req.body.priceColumn,
        vatRate: req.body.vatRate ? parseInt(req.body.vatRate) : undefined,
        priceIncludesVat:
          req.body.priceIncludesVat !== undefined
            ? req.body.priceIncludesVat === 'true'
            : undefined,
        dryRun: req.body.dryRun === 'true',
      };

      const result = await this.importExcelUseCase.execute(file.buffer, options);

      res.json(
        successResponse({
          message: options.dryRun ? 'Preview completed (no changes made)' : 'Import completed',
          totalRows: result.totalRows,
          validRows: result.validRows,
          productsUpdated: result.productsUpdated,
          productsNotFound: result.productsNotFound,
          errors: result.errors.slice(0, 20),
          preview: result.preview.slice(0, 20),
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async downloadExcelTemplate(req: Request, res: Response): Promise<void> {
    try {
      if (!this.importExcelUseCase) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Excel import feature not available', 503));
        return;
      }

      const template = this.importExcelUseCase.getTemplate();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename=price-import-template.xlsx');
      res.send(template);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncCustomers(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId || `smartbill-sync-customers-${Date.now()}`;
    const rawUserId = (req as any).user?.id;
    const parsedUserId = Number(rawUserId);
    const userId = Number.isFinite(parsedUserId) ? parsedUserId : undefined;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      if (!this.syncSmartBillCustomers) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Customer sync feature not available', 503));
        return;
      }

      const startDate = req.body.startDate || (req.query.startDate as string);
      const endDate = req.body.endDate || (req.query.endDate as string);

      const result = await this.syncSmartBillCustomers.execute({
        startDate,
        endDate,
      });

      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-smartbill-customer-sync`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'UPDATE',
          resource: 'SmartBillCustomerSync',
          resourceId: 'smartbill',
          changes: {
            after: {
              startDate,
              endDate,
              totalProcessed: result.totalProcessed,
              newLinks: result.newLinks,
              updatedLinks: result.updatedLinks,
              matchedToErp: result.matchedToErp,
              conflicts: result.conflicts.length,
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log SmartBill customer sync audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      res.json(
        successResponse({
          message: 'SmartBill customer sync completed',
          totalProcessed: result.totalProcessed,
          newLinks: result.newLinks,
          updatedLinks: result.updatedLinks,
          matchedToErp: result.matchedToErp,
          conflicts: result.conflicts,
        }),
      );
    } catch (error) {
      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-smartbill-customer-sync-failed`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'UPDATE',
          resource: 'SmartBillCustomerSync',
          resourceId: 'smartbill',
          changes: {
            after: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log failed SmartBill customer sync audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      this.handleError(error, res);
    }
  }

  async createProformaFromQuote(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId || `smartbill-proforma-${Date.now()}`;
    const rawUserId = (req as any).user?.id;
    const parsedUserId = Number(rawUserId);
    const userId = Number.isFinite(parsedUserId) ? parsedUserId : undefined;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      if (!this.createProformaFromQuoteUseCase) {
        res
          .status(503)
          .json(
            errorResponse('SERVICE_UNAVAILABLE', 'Proforma from quote feature not available', 503),
          );
        return;
      }

      const quoteId = parseInt(req.params.quoteId);
      if (!quoteId || isNaN(quoteId)) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid quote ID', 400));
        return;
      }

      const result = await this.createProformaFromQuoteUseCase.execute({
        quoteId,
        series: req.body.series || 'PF',
        dueInDays: req.body.dueInDays || 30,
      });

      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-quote-proforma-${quoteId}`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'CREATE',
          resource: 'SmartBillProformaFromQuote',
          resourceId: String(result.id),
          changes: {
            after: {
              quoteId,
              proformaId: result.id,
              proformaNumber: result.proformaNumber,
              smartBillId: result.smartBillId,
              status: result.status,
              totalWithVat: result.totalWithVat,
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log proforma-from-quote audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
          quoteId,
        });
      }

      res.status(201).json(successResponse(result));
    } catch (error) {
      try {
        const quoteId = parseInt(req.params.quoteId);
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-quote-proforma-failed-${Date.now()}`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'CREATE',
          resource: 'SmartBillProformaFromQuote',
          resourceId: String(Number.isFinite(quoteId) ? quoteId : req.params.quoteId || 'unknown'),
          changes: {
            after: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log failed proforma-from-quote audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      this.handleError(error, res);
    }
  }

  async listCustomerLinks(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Customer link feature not available', 503));
        return;
      }

      const status = String(req.query.status || 'all').toLowerCase();
      const q = String(req.query.q || '').trim();
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
      const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

      const whereParts: string[] = [`cel.provider = 'smartbill'`];
      const params: unknown[] = [];

      if (status === 'unlinked') {
        whereParts.push('cel.customer_id IS NULL');
      } else if (status === 'linked') {
        whereParts.push('cel.customer_id IS NOT NULL');
      } else if (status === 'ignored') {
        whereParts.push(`COALESCE(cel.sync_status, '') = 'ignored'`);
      } else if (status === 'conflict') {
        whereParts.push('cel.customer_id IS NOT NULL');
        whereParts.push(`COALESCE(cel.external_data->>'email', '') <> ''`);
        whereParts.push(
          `LOWER(TRIM(COALESCE(c.email, ''))) <> LOWER(TRIM(COALESCE(cel.external_data->>'email', '')))`,
        );
      }

      if (q) {
        params.push(`%${q}%`);
        const idx = params.length;
        whereParts.push(
          `(COALESCE(cel.external_data->>'name', '') ILIKE $${idx}
            OR COALESCE(cel.external_data->>'vatCode', '') ILIKE $${idx}
            OR COALESCE(cel.external_data->>'email', '') ILIKE $${idx}
            OR COALESCE(c.company_name, '') ILIKE $${idx}
            OR COALESCE(c.email, '') ILIKE $${idx})`,
        );
      }

      const whereSql = whereParts.join(' AND ');

      const countRows = await this.dataSource.query(
        `SELECT COUNT(*)::int AS total
         FROM customer_external_links cel
         LEFT JOIN customers c ON c.id = cel.customer_id AND c.deleted_at IS NULL
         WHERE ${whereSql}`,
        params,
      );
      const total = Number(countRows[0]?.total || 0);

      const paramsWithPagination = [...params, limit, offset];
      const limitParam = params.length + 1;
      const offsetParam = params.length + 2;

      const rows = await this.dataSource.query(
        `SELECT
            cel.id,
            cel.external_id,
            cel.customer_id,
            cel.sync_status,
            cel.last_sync_at,
            cel.updated_at,
            cel.external_data,
            c.company_name AS erp_company_name,
            c.email AS erp_email,
            c.tax_identification_number AS erp_cui
         FROM customer_external_links cel
         LEFT JOIN customers c ON c.id = cel.customer_id AND c.deleted_at IS NULL
         WHERE ${whereSql}
         ORDER BY cel.last_sync_at DESC NULLS LAST, cel.updated_at DESC, cel.id DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        paramsWithPagination,
      );

      const links = rows.map((row: any) => {
        let externalData: any = row.external_data || {};
        if (typeof row.external_data === 'string') {
          try {
            externalData = JSON.parse(row.external_data || '{}');
          } catch {
            externalData = {};
          }
        }
        const externalEmail = String(externalData.email || '').trim();
        const erpEmail = String(row.erp_email || '').trim();

        const conflict =
          Boolean(row.customer_id) &&
          externalEmail.length > 0 &&
          erpEmail.length > 0 &&
          externalEmail.toLowerCase() !== erpEmail.toLowerCase();

        return {
          id: row.id,
          externalId: row.external_id,
          externalName: externalData.name || 'SmartBill Client',
          externalVatCode: externalData.vatCode || null,
          externalEmail: externalEmail || null,
          externalPhone: externalData.phone || null,
          customerId: row.customer_id,
          erpCompanyName: row.erp_company_name || null,
          erpEmail: row.erp_email || null,
          erpCui: row.erp_cui || null,
          syncStatus: row.sync_status || null,
          lastSyncAt: row.last_sync_at || null,
          conflict,
          conflictReason: conflict
            ? `Email mismatch: SmartBill=${externalEmail}, ERP=${erpEmail}`
            : null,
        };
      });

      res.json(
        successResponse(links, {
          total,
          limit,
          offset,
          status,
          query: q,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async resolveCustomerLink(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId || `smartbill-resolve-link-${Date.now()}`;
    const rawUserId = (req as any).user?.id;
    const parsedUserId = Number(rawUserId);
    const userId = Number.isFinite(parsedUserId) ? parsedUserId : undefined;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      if (!this.dataSource) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Customer link feature not available', 503));
        return;
      }

      const linkId = parseInt(req.params.id, 10);
      if (!linkId || Number.isNaN(linkId)) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid customer link ID', 400));
        return;
      }

      const action = String(req.body.action || '').toLowerCase();
      const reason = String(req.body.reason || '').trim() || null;
      const customerIdRaw = req.body.customerId;
      const customerId =
        customerIdRaw !== undefined && customerIdRaw !== null ? Number(customerIdRaw) : undefined;

      const existingRows = await this.dataSource.query(
        `SELECT id, customer_id, sync_status, external_id, external_data
         FROM customer_external_links
         WHERE id = $1 AND provider = 'smartbill'
         LIMIT 1`,
        [linkId],
      );

      if (existingRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Customer link not found', 404));
        return;
      }

      const existing = existingRows[0];
      const manager = this.dataSource;

      if (action === 'link') {
        if (!customerId || Number.isNaN(customerId)) {
          res
            .status(400)
            .json(errorResponse('INVALID_REQUEST', 'customerId is required for link action', 400));
          return;
        }

        const customerRows = await manager.query(
          `SELECT id, company_name, email
           FROM customers
           WHERE id = $1 AND deleted_at IS NULL
           LIMIT 1`,
          [customerId],
        );

        if (customerRows.length === 0) {
          res.status(404).json(errorResponse('NOT_FOUND', 'ERP customer not found', 404));
          return;
        }

        await manager.query(
          `UPDATE customer_external_links
           SET customer_id = $1,
               sync_status = 'synced',
               last_sync_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [customerId, linkId],
        );
      } else if (action === 'unlink') {
        await manager.query(
          `UPDATE customer_external_links
           SET customer_id = NULL,
               sync_status = 'pending',
               updated_at = NOW()
           WHERE id = $1`,
          [linkId],
        );
      } else if (action === 'ignore') {
        await manager.query(
          `UPDATE customer_external_links
           SET sync_status = 'ignored',
               updated_at = NOW()
           WHERE id = $1`,
          [linkId],
        );
      } else {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid action', 400));
        return;
      }

      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-smartbill-customer-link-${linkId}`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'UPDATE',
          resource: 'SmartBillCustomerLink',
          resourceId: String(linkId),
          changes: {
            before: {
              customerId: existing.customer_id,
              syncStatus: existing.sync_status,
            },
            after: {
              action,
              customerId:
                action === 'link' ? customerId : action === 'unlink' ? null : existing.customer_id,
              syncStatus:
                action === 'ignore' ? 'ignored' : action === 'unlink' ? 'pending' : 'synced',
              reason,
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log SmartBill customer link resolution audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
          linkId,
        });
      }

      res.json(
        successResponse({
          message: 'Customer link updated successfully',
          id: linkId,
          action,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getMatchSuggestions(req: Request, res: Response): Promise<void> {
    try {
      if (!this.customerMatchingService) {
        res
          .status(503)
          .json(
            errorResponse('SERVICE_UNAVAILABLE', 'Customer matching feature not available', 503),
          );
        return;
      }

      const linkId = req.query.linkId ? parseInt(String(req.query.linkId), 10) : undefined;

      if (linkId && !Number.isNaN(linkId)) {
        const result = await this.customerMatchingService.findMatchesForLink(linkId);
        if (!result) {
          res.status(404).json(errorResponse('NOT_FOUND', 'Customer link not found', 404));
          return;
        }
        res.json(successResponse([result]));
      } else {
        const results = await this.customerMatchingService.findMatchesForUnlinked();
        res.json(successResponse(results));
      }
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async autoLinkCustomers(req: Request, res: Response): Promise<void> {
    try {
      if (!this.customerMatchingService) {
        res
          .status(503)
          .json(
            errorResponse('SERVICE_UNAVAILABLE', 'Customer matching feature not available', 503),
          );
        return;
      }

      const dryRun = req.body.dryRun === true || req.body.dryRun === 'true';
      const result = await this.customerMatchingService.autoLinkHighConfidence(dryRun);

      const requestId = (req as any).requestId || `smartbill-auto-link-${Date.now()}`;
      const rawUserId = (req as any).user?.id;
      const parsedUserId = Number(rawUserId);
      const userId = Number.isFinite(parsedUserId) ? parsedUserId : undefined;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-smartbill-auto-link`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'UPDATE',
          resource: 'SmartBillCustomerAutoLink',
          resourceId: 'smartbill',
          changes: {
            after: {
              dryRun,
              linked: result.linked,
              skipped: result.skipped,
              detailsCount: result.details.length,
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log SmartBill auto-link audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      res.json(
        successResponse({
          message: dryRun ? 'Dry run completed (no changes made)' : 'Auto-link completed',
          dryRun,
          linked: result.linked,
          skipped: result.skipped,
          details: result.details,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSyncDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!this.syncMonitorService) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Sync monitoring feature not available', 503));
        return;
      }

      const dashboard = await this.syncMonitorService.getDashboard();
      res.json(successResponse(dashboard));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSyncHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!this.syncMonitorService) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Sync monitoring feature not available', 503));
        return;
      }

      const jobType = req.params.jobType;
      const validJobTypes = ['stock_sync', 'customer_sync', 'price_sync'];
      if (!validJobTypes.includes(jobType)) {
        res
          .status(400)
          .json(
            errorResponse(
              'INVALID_REQUEST',
              `Invalid job type. Must be one of: ${validJobTypes.join(', ')}`,
              400,
            ),
          );
        return;
      }

      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
      const history = await this.syncMonitorService.getJobHistory(jobType, limit);
      res.json(successResponse(history));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSyncAlerts(req: Request, res: Response): Promise<void> {
    try {
      if (!this.syncMonitorService) {
        res
          .status(503)
          .json(errorResponse('SERVICE_UNAVAILABLE', 'Sync monitoring feature not available', 503));
        return;
      }

      const alerts = await this.syncMonitorService.getActiveAlerts();
      res.json(successResponse(alerts));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async convertProformaToInvoice(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId || `smartbill-convert-proforma-${Date.now()}`;
    const rawUserId = (req as any).user?.id;
    const parsedUserId = Number(rawUserId);
    const userId = Number.isFinite(parsedUserId) ? parsedUserId : undefined;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      if (!this.convertProformaToInvoiceUseCase) {
        res
          .status(503)
          .json(
            errorResponse(
              'SERVICE_UNAVAILABLE',
              'Proforma-to-invoice conversion feature not available',
              503,
            ),
          );
        return;
      }

      const proformaId = parseInt(req.params.proformaId);
      if (!proformaId || isNaN(proformaId)) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid proforma ID', 400));
        return;
      }

      const result = await this.convertProformaToInvoiceUseCase.execute(proformaId);

      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-proforma-convert-${proformaId}`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'CREATE',
          resource: 'SmartBillProformaConversion',
          resourceId: String(result.id),
          changes: {
            after: {
              proformaId,
              invoiceId: result.id,
              invoiceNumber: result.invoiceNumber,
              smartBillId: result.smartBillId,
              status: result.status,
              totalWithVat: result.totalWithVat,
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log proforma conversion audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
          proformaId,
        });
      }

      res.status(201).json(successResponse(result));
    } catch (error) {
      try {
        const auditLogger = getAuditLogger();
        await auditLogger.logEvent({
          id: `${requestId}-proforma-convert-failed-${Date.now()}`,
          timestamp: new Date(),
          requestId,
          userId,
          action: 'CREATE',
          resource: 'SmartBillProformaConversion',
          resourceId: String(req.params.proformaId || 'unknown'),
          changes: {
            after: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          },
          ip,
          userAgent,
        });
      } catch (auditError) {
        logger.warn('Failed to log failed proforma conversion audit event', {
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }

      this.handleError(error, res);
    }
  }

  async syncInvoiceStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!this.syncInvoiceStatusUseCase) {
        res
          .status(503)
          .json(
            errorResponse('SERVICE_UNAVAILABLE', 'Invoice status sync feature not available', 503),
          );
        return;
      }

      const result = await this.syncInvoiceStatusUseCase.execute();

      res.json(
        successResponse({
          message: 'Invoice status sync completed',
          checked: result.checked,
          updated: result.updated,
          errors: result.errors,
          details: result.details,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async checkInvoicePaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.invoiceId);

      if (!invoiceId || isNaN(invoiceId)) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid invoice ID', 400));
        return;
      }

      const invoice = await this.repository.getInvoice(invoiceId);

      if (!invoice) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Invoice not found', 404));
        return;
      }

      if (!invoice.smartBillId) {
        res.json(
          successResponse({
            invoiceId,
            status: invoice.status,
            paidAmount: invoice.paidAmount || 0,
            totalAmount: invoice.totalWithVat,
            paymentDate: invoice.paymentDate || null,
            message: 'Invoice not synced with SmartBill - returning local status',
          }),
        );
        return;
      }

      // Real-time check against SmartBill API
      const status = await this.apiClient.getPaymentStatus(invoice.smartBillId);

      // Update local record if status changed
      if (status.status !== invoice.status) {
        if (status.status === 'paid' && invoice.status !== 'paid') {
          invoice.markPaid(status.paidAmount, status.paymentDate || new Date());
          await this.repository.updateInvoice(invoice);
        } else if (status.status === 'cancelled' || status.status === 'canceled') {
          invoice.markCancelled();
          await this.repository.updateInvoice(invoice);
        }
      }

      res.json(
        successResponse({
          invoiceId: invoice.id,
          smartBillId: invoice.smartBillId,
          invoiceNumber: invoice.invoiceNumber,
          status: status.status,
          paidAmount: status.paidAmount,
          totalAmount: status.totalAmount,
          paymentDate: status.paymentDate,
          localStatus: invoice.status,
        }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    if (error instanceof SmartBillError) {
      res.status(400).json(errorResponse('SMARTBILL_ERROR', error.message, 400));
    } else {
      logger.error('Unhandled SmartBill error', { error });
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
    }
  }
}
