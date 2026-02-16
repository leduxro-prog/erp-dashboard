import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { SmartBillController } from '../controllers/SmartBillController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});
import {
  createInvoiceSchema,
  createProformaSchema,
  getInvoiceSchema,
  getProformaSchema,
  syncStockSchema,
  getWarehousesSchema,
  getInvoiceStatusSchema,
  markInvoicePaidSchema,
} from '../validators/smartbill.validators';

export function createSmartBillRoutes(controller: SmartBillController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  const validateRequest =
    (schema: Joi.Schema) => (req: Request, res: Response, next: NextFunction) => {
      const { error, value } = schema.validate(req.body || req.params);
      if (error) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        req.body = value;
        next();
      }
    };

  router.post('/invoices', validateRequest(createInvoiceSchema), (req, res) =>
    controller.createInvoice(req, res),
  );

  router.post('/proformas', validateRequest(createProformaSchema), (req, res) =>
    controller.createProforma(req, res),
  );

  router.get('/invoices/:id', validateRequest(getInvoiceSchema), (req, res) =>
    controller.getInvoice(req, res),
  );

  router.get('/proformas/:id', validateRequest(getProformaSchema), (req, res) =>
    controller.getProforma(req, res),
  );

  router.post('/sync-stock', validateRequest(syncStockSchema), requireRole(['admin']), (req, res) =>
    controller.syncStock(req, res),
  );

  router.get('/warehouses', validateRequest(getWarehousesSchema), (req, res) =>
    controller.getWarehouses(req, res),
  );

  // Invoice status routes - custom validation for params
  router.get(
    '/invoices/:invoiceId/status',
    (req, res, next) => {
      const { error, value } = getInvoiceStatusSchema.validate({ invoiceId: req.params.invoiceId });
      if (error) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        req.params = { ...req.params, ...value };
        next();
      }
    },
    (req, res) => controller.getInvoiceStatus(req, res),
  );

  router.post(
    '/invoices/:invoiceId/paid',
    requireRole(['admin']),
    (req, res, next) => {
      const { error, value } = markInvoicePaidSchema.validate({ ...req.params, ...req.body });
      if (error) {
        res.status(400).json({ success: false, error: error.message });
      } else {
        req.params = { ...req.params, invoiceId: value.invoiceId };
        req.body = { ...value };
        next();
      }
    },
    (req, res) => controller.markInvoicePaid(req, res),
  );

  // Price sync routes
  router.post('/sync-prices', requireRole(['admin']), (req, res) =>
    controller.syncPricesFromInvoices(req, res),
  );

  router.get('/preview-prices', requireRole(['admin']), (req, res) =>
    controller.previewPricesFromInvoices(req, res),
  );

  // Excel import routes
  router.post('/import-prices', requireRole(['admin']), upload.single('file'), (req, res) =>
    controller.importPricesFromExcel(req, res),
  );

  router.get('/template', requireRole(['admin']), (req, res) =>
    controller.downloadExcelTemplate(req, res),
  );

  // Customer sync from SmartBill invoices
  router.post('/sync-customers', requireRole(['admin', 'manager']), (req, res) =>
    controller.syncCustomers(req, res),
  );

  // Customer external links and conflict resolution
  router.get('/customer-links', requireRole(['admin', 'manager', 'sales']), (req, res) =>
    controller.listCustomerLinks(req, res),
  );
  router.patch('/customer-links/:id/resolve', requireRole(['admin', 'manager']), (req, res) =>
    controller.resolveCustomerLink(req, res),
  );

  // Customer match suggestions and auto-linking
  router.get('/customer-matches', requireRole(['admin', 'manager', 'sales']), (req, res) =>
    controller.getMatchSuggestions(req, res),
  );
  router.post('/customer-auto-link', requireRole(['admin']), (req, res) =>
    controller.autoLinkCustomers(req, res),
  );

  // Proforma from quotation
  router.post(
    '/proformas/from-quote/:quoteId',
    requireRole(['admin', 'manager', 'sales']),
    (req, res) => controller.createProformaFromQuote(req, res),
  );

  // Sync monitoring dashboard routes
  router.get('/sync-dashboard', requireRole(['admin']), (req, res) =>
    controller.getSyncDashboard(req, res),
  );
  router.get('/sync-history/:jobType', requireRole(['admin']), (req, res) =>
    controller.getSyncHistory(req, res),
  );
  router.get('/sync-alerts', requireRole(['admin']), (req, res) =>
    controller.getSyncAlerts(req, res),
  );

  // Proforma-to-invoice conversion
  router.post('/proformas/:proformaId/convert', requireRole(['admin', 'manager']), (req, res) =>
    controller.convertProformaToInvoice(req, res),
  );

  // Invoice status sync (batch)
  router.post('/sync-invoice-status', requireRole(['admin']), (req, res) =>
    controller.syncInvoiceStatus(req, res),
  );

  // Real-time payment status check for a single invoice
  router.get('/invoices/:invoiceId/payment-status', (req, res) =>
    controller.checkInvoicePaymentStatus(req, res),
  );

  return router;
}

export { SmartBillController };
