import { Router, Request, Response } from 'express';
import { QuotationController } from '../controllers/QuotationController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

export function createQuotationRoutes(controller: QuotationController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * POST /api/v1/quotations
   * Create a new quote
   */
  router.post('/', (req: Request, res: Response) =>
    controller.createQuoteHandler(req, res),
  );

  /**
   * GET /api/v1/quotations
   * List all quotes with filters and pagination
   */
  router.get('/', (req: Request, res: Response) =>
    controller.listQuotesHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/:id
   * Get a specific quote by ID
   */
  router.get('/:id', (req: Request, res: Response) =>
    controller.getQuoteHandler(req, res),
  );

  /**
   * POST /api/v1/quotations/:id/send
   * Send quote to customer
   */
  router.post('/:id/send', (req: Request, res: Response) =>
    controller.sendQuoteHandler(req, res),
  );

  /**
   * POST /api/v1/quotations/:id/accept
   * Accept a quote
   */
  router.post('/:id/accept', (req: Request, res: Response) =>
    controller.acceptQuoteHandler(req, res),
  );

  /**
   * POST /api/v1/quotations/:id/reject
   * Reject a quote with reason
   */
  router.post('/:id/reject', (req: Request, res: Response) =>
    controller.rejectQuoteHandler(req, res),
  );

  /**
   * POST /api/v1/quotations/:id/convert
   * Convert accepted quote to order (requires admin role)
   */
  router.post('/:id/convert', requireRole(['admin']), (req: Request, res: Response) =>
    controller.convertToOrderHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/:id/pdf
   * Download quote as PDF
   */
  router.get('/:id/pdf', (req: Request, res: Response) =>
    controller.generatePdfHandler(req, res),
  );

  // ==================== ANALYTICS ROUTES ====================

  /**
   * GET /api/v1/quotations/analytics/metrics
   * Get quote metrics for date range
   */
  router.get('/analytics/metrics', (req: Request, res: Response) =>
    controller.getAnalyticsHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/analytics/trends
   * Get quote trends over time
   */
  router.get('/analytics/trends', (req: Request, res: Response) =>
    controller.getTrendsHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/analytics/top-customers
   * Get top customers by quote value
   */
  router.get('/analytics/top-customers', (req: Request, res: Response) =>
    controller.getTopCustomersHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/analytics/top-products
   * Get top quoted products
   */
  router.get('/analytics/top-products', (req: Request, res: Response) =>
    controller.getTopProductsHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/analytics/expiring
   * Get quotes expiring soon
   */
  router.get('/analytics/expiring', (req: Request, res: Response) =>
    controller.getExpiringQuotesHandler(req, res),
  );

  // ==================== WORKFLOW ROUTES ====================

  /**
   * POST /api/v1/quotations/:id/remind
   * Send manual reminder for quote
   */
  router.post('/:id/remind', (req: Request, res: Response) =>
    controller.sendManualReminderHandler(req, res),
  );

  /**
   * GET /api/v1/quotations/workflow/stats
   * Get workflow automation statistics
   */
  router.get('/workflow/stats', (req: Request, res: Response) =>
    controller.getWorkflowStatsHandler(req, res),
  );

  return router;
}
