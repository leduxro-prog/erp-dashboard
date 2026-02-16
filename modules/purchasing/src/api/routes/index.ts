import { Router } from 'express';
import { validateRequest } from '@shared/middleware';
import { RequisitionController } from '../controllers/RequisitionController';
import { PurchaseOrderController } from '../controllers/PurchaseOrderController';
import { GRNController } from '../controllers/GRNController';
import { InvoiceController } from '../controllers/InvoiceController';
import { MatchingController } from '../controllers/MatchingController';
import * as RequisitionValidators from '../validators/RequisitionValidators';
import * as POValidators from '../validators/PurchaseOrderValidators';
import * as GRNValidators from '../validators/GRNValidators';
import * as InvoiceValidators from '../validators/InvoiceValidators';
import * as MatchValidators from '../validators/MatchValidators';

export function createRoutes(
  requisitionController: RequisitionController,
  poController: PurchaseOrderController,
  grnController: GRNController,
  invoiceController: InvoiceController,
  matchingController: MatchingController
): Router {
  const router = Router();

  // Requisition Routes
  router.post(
    '/requisitions',
    validateRequest({ body: RequisitionValidators.createRequisitionSchema }),
    (req, res) => requisitionController.createRequisition(req, res)
  );
  router.post(
    '/requisitions/submit',
    validateRequest({ body: RequisitionValidators.submitRequisitionSchema }),
    (req, res) => requisitionController.submitRequisition(req, res)
  );
  router.post(
    '/requisitions/approve',
    validateRequest({ body: RequisitionValidators.approveRequisitionSchema }),
    (req, res) => requisitionController.approveRequisition(req, res)
  );
  router.post(
    '/requisitions/reject',
    validateRequest({ body: RequisitionValidators.rejectRequisitionSchema }),
    (req, res) => requisitionController.rejectRequisition(req, res)
  );
  router.get('/requisitions/:id', (req, res) =>
    requisitionController.getRequisition(req, res)
  );
  router.get('/requisitions/number/:number', (req, res) =>
    requisitionController.getRequisitionByNumber(req, res)
  );
  router.get('/requisitions/department/:departmentId', (req, res) =>
    requisitionController.listByDepartment(req, res)
  );
  router.get('/requisitions/status/:status', (req, res) =>
    requisitionController.listByStatus(req, res)
  );
  router.get('/requisitions', (req, res) =>
    requisitionController.listAll(req, res)
  );
  router.delete('/requisitions/:id', (req, res) =>
    requisitionController.cancelRequisition(req, res)
  );

  // Purchase Order Routes
  router.post(
    '/purchase-orders',
    validateRequest({ body: POValidators.createPurchaseOrderSchema }),
    (req, res) => poController.createPurchaseOrder(req, res)
  );
  router.post(
    '/purchase-orders/approve',
    validateRequest({ body: POValidators.approvePurchaseOrderSchema }),
    (req, res) => poController.approvePO(req, res)
  );
  router.post(
    '/purchase-orders/send',
    validateRequest({ body: POValidators.sendPurchaseOrderSchema }),
    (req, res) => poController.sendPO(req, res)
  );
  router.post(
    '/purchase-orders/amend',
    validateRequest({ body: POValidators.amendPurchaseOrderSchema }),
    (req, res) => poController.amendPO(req, res)
  );
  router.post(
    '/purchase-orders/lines/update',
    validateRequest({ body: POValidators.updatePOLineSchema }),
    (req, res) => poController.updatePOLine(req, res)
  );
  router.get('/purchase-orders/:id', (req, res) =>
    poController.getPurchaseOrder(req, res)
  );
  router.get('/purchase-orders/number/:number', (req, res) =>
    poController.getPOByNumber(req, res)
  );
  router.get('/purchase-orders/vendor/:vendorId', (req, res) =>
    poController.listByVendor(req, res)
  );
  router.get('/purchase-orders/status/:status', (req, res) =>
    poController.listByStatus(req, res)
  );
  router.get('/purchase-orders', (req, res) =>
    poController.listAll(req, res)
  );
  router.delete('/purchase-orders/:id', (req, res) =>
    poController.cancelPO(req, res)
  );
  router.patch('/purchase-orders/:id/close', (req, res) =>
    poController.closePO(req, res)
  );

  // GRN Routes
  router.post(
    '/grns',
    validateRequest({ body: GRNValidators.createGRNSchema }),
    (req, res) => grnController.createGRN(req, res)
  );
  router.post('/grns/:id/submit', (req, res) =>
    grnController.submitGRN(req, res)
  );
  router.post(
    '/grns/inspect',
    validateRequest({ body: GRNValidators.inspectGRNSchema }),
    (req, res) => grnController.inspectGRN(req, res)
  );
  router.post('/grns/:id/accept', (req, res) =>
    grnController.acceptGRN(req, res)
  );
  router.post('/grns/:id/reject', (req, res) =>
    grnController.rejectGRN(req, res)
  );
  router.post(
    '/grns/request-return',
    validateRequest({ body: GRNValidators.requestReturnSchema }),
    (req, res) => grnController.requestReturn(req, res)
  );
  router.post('/grns/:grnId/returns/:returnId/approve', (req, res) =>
    grnController.approveReturn(req, res)
  );
  router.get('/grns/:id', (req, res) => grnController.getGRN(req, res));
  router.get('/grns/number/:number', (req, res) =>
    grnController.getGRNByNumber(req, res)
  );
  router.get('/grns/po/:poId', (req, res) => grnController.listByPO(req, res));
  router.get('/grns/vendor/:vendorId', (req, res) =>
    grnController.listByVendor(req, res)
  );
  router.get('/grns/status/:status', (req, res) =>
    grnController.listByStatus(req, res)
  );
  router.get('/grns', (req, res) => grnController.listAll(req, res));

  // Invoice Routes
  router.post(
    '/invoices',
    validateRequest({ body: InvoiceValidators.createInvoiceSchema }),
    (req, res) => invoiceController.registerInvoice(req, res)
  );
  router.post(
    '/invoices/dispute',
    validateRequest({ body: InvoiceValidators.disputeInvoiceSchema }),
    (req, res) => invoiceController.disputeInvoice(req, res)
  );
  router.post(
    '/invoices/resolve-dispute',
    validateRequest({ body: InvoiceValidators.resolveDisputeSchema }),
    (req, res) => invoiceController.resolveDispute(req, res)
  );
  router.post('/invoices/:id/approve', (req, res) =>
    invoiceController.approveForPayment(req, res)
  );
  router.post(
    '/invoices/record-payment',
    validateRequest({ body: InvoiceValidators.recordPaymentSchema }),
    (req, res) => invoiceController.recordPayment(req, res)
  );
  router.delete('/invoices/:id', (req, res) =>
    invoiceController.cancelInvoice(req, res)
  );
  router.get('/invoices/:id', (req, res) =>
    invoiceController.getInvoice(req, res)
  );
  router.get('/invoices/number/:number', (req, res) =>
    invoiceController.getInvoiceByNumber(req, res)
  );
  router.get('/invoices/vendor/:vendorId', (req, res) =>
    invoiceController.listByVendor(req, res)
  );
  router.get('/invoices/status/:status', (req, res) =>
    invoiceController.listByStatus(req, res)
  );
  router.get('/invoices/overdue', (req, res) =>
    invoiceController.listOverdue(req, res)
  );
  router.get('/invoices/due-soon', (req, res) =>
    invoiceController.listDueSoon(req, res)
  );
  router.get('/invoices', (req, res) =>
    invoiceController.listAll(req, res)
  );

  // 3-Way Matching Routes
  router.post(
    '/matches',
    validateRequest({ body: MatchValidators.createThreeWayMatchSchema }),
    (req, res) => matchingController.createMatch(req, res)
  );
  router.post('/matches/auto-approve', (req, res) =>
    matchingController.autoApproveMatches(req, res)
  );
  router.post(
    '/matches/exceptions/resolve',
    validateRequest({ body: MatchValidators.resolveExceptionSchema }),
    (req, res) => matchingController.resolveException(req, res)
  );
  router.get('/matches/:id', (req, res) =>
    matchingController.getMatch(req, res)
  );
  router.get('/matches/po/:poId', (req, res) =>
    matchingController.getMatchByPO(req, res)
  );
  router.get('/matches/grn/:grnId', (req, res) =>
    matchingController.getMatchByGRN(req, res)
  );
  router.get('/matches/invoice/:invoiceId', (req, res) =>
    matchingController.getMatchByInvoice(req, res)
  );
  router.get('/matches/exceptions', (req, res) =>
    matchingController.listWithExceptions(req, res)
  );
  router.get('/matches', (req, res) =>
    matchingController.listAll(req, res)
  );
  router.get('/matches/analytics', (req, res) =>
    matchingController.getAnalytics(req, res)
  );

  return router;
}
