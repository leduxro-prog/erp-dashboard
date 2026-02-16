import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { validateBody } from '@shared/middleware/validation.middleware';
import { Router, Request, Response } from 'express';

import { FinancialAccountingController } from '../controllers/FinancialAccountingController';
import {
  createChartOfAccountSchema,
  createJournalEntrySchema,
  createArInvoiceSchema,
  createApInvoiceSchema,
  createFiscalPeriodSchema,
  recordPaymentSchema,
  threeWayMatchSchema,
} from '../validators/FinancialAccountingValidators';

export function createFinancialAccountingRoutes(
  chartOfAccountRepository: any,
  journalEntryRepository: any,
  fiscalPeriodRepository: any,
  arInvoiceRepository: any,
  apInvoiceRepository: any,
  costCenterRepository: any,
): Router {
  const router = Router();
  const controller = new FinancialAccountingController(
    chartOfAccountRepository,
    journalEntryRepository,
    fiscalPeriodRepository,
    arInvoiceRepository,
    apInvoiceRepository,
    costCenterRepository,
  );

  // Middleware
  router.use(authenticate);

  // ============================================================================
  // Chart of Accounts Routes
  // ============================================================================

  router.post(
    '/:organizationId/chart-of-accounts',
    requireRole(['admin', 'accountant']),
    validateBody(createChartOfAccountSchema),
    (req: Request, res: Response) => controller.createChartOfAccount(req, res),
  );

  router.get(
    '/:organizationId/chart-of-accounts',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getChartOfAccounts(req, res),
  );

  router.get(
    '/:organizationId/chart-of-accounts/:accountId',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getChartOfAccountById(req, res),
  );

  // ============================================================================
  // Fiscal Period Routes
  // ============================================================================

  router.post(
    '/:organizationId/fiscal-periods',
    requireRole(['admin', 'accountant']),
    validateBody(createFiscalPeriodSchema),
    (req: Request, res: Response) => {
      // Fiscal period creation handled by fiscal period controller
      res.status(501).json({ error: 'Not implemented' });
    },
  );

  // ============================================================================
  // Journal Entry Routes
  // ============================================================================

  router.post(
    '/:organizationId/journal-entries',
    requireRole(['admin', 'accountant']),
    validateBody(createJournalEntrySchema),
    (req: Request, res: Response) => controller.createJournalEntry(req, res),
  );

  router.get(
    '/:organizationId/journal-entries/:entryId',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getJournalEntry(req, res),
  );

  router.post(
    '/:organizationId/journal-entries/:entryId/post',
    requireRole(['admin', 'accountant']),
    (req: Request, res: Response) => controller.postJournalEntry(req, res),
  );

  router.post(
    '/:organizationId/journal-entries/:entryId/approve',
    requireRole(['admin']),
    (req: Request, res: Response) => controller.approveJournalEntry(req, res),
  );

  // ============================================================================
  // Financial Reports Routes
  // ============================================================================

  router.get(
    '/:organizationId/fiscal-periods/:fiscalPeriodId/trial-balance',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.generateTrialBalance(req, res),
  );

  router.get(
    '/:organizationId/reports/income-statement',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.generateIncomeStatement(req, res),
  );

  router.get(
    '/:organizationId/reports/balance-sheet',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.generateBalanceSheet(req, res),
  );

  // ============================================================================
  // Accounts Receivable Routes
  // ============================================================================

  router.post(
    '/:organizationId/ar-invoices',
    requireRole(['admin', 'accountant']),
    validateBody(createArInvoiceSchema),
    (req: Request, res: Response) => controller.createArInvoice(req, res),
  );

  router.get(
    '/:organizationId/ar-invoices/:invoiceId',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getArInvoice(req, res),
  );

  router.post(
    '/:organizationId/ar-invoices/:invoiceId/payments',
    requireRole(['admin', 'accountant']),
    validateBody(recordPaymentSchema),
    (req: Request, res: Response) => controller.recordArPayment(req, res),
  );

  router.get(
    '/:organizationId/ar-aging',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getArAging(req, res),
  );

  // ============================================================================
  // Accounts Payable Routes
  // ============================================================================

  router.post(
    '/:organizationId/ap-invoices',
    requireRole(['admin', 'accountant']),
    validateBody(createApInvoiceSchema),
    (req: Request, res: Response) => controller.createApInvoice(req, res),
  );

  router.get(
    '/:organizationId/ap-invoices/:invoiceId',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getApInvoice(req, res),
  );

  router.post(
    '/:organizationId/ap-invoices/:invoiceId/payments',
    requireRole(['admin', 'accountant']),
    validateBody(recordPaymentSchema),
    (req: Request, res: Response) => controller.recordApPayment(req, res),
  );

  router.post(
    '/:organizationId/ap-invoices/:invoiceId/three-way-match',
    requireRole(['admin', 'accountant']),
    validateBody(threeWayMatchSchema),
    (req: Request, res: Response) => controller.performThreeWayMatch(req, res),
  );

  router.get(
    '/:organizationId/ap-aging',
    requireRole(['admin', 'accountant', 'viewer']),
    (req: Request, res: Response) => controller.getApAging(req, res),
  );

  return router;
}
