/**
 * Marketing API Routes
 * Defines all marketing endpoints including campaigns, discount codes, and email sequences
 */
import { Router, Request, Response, NextFunction } from 'express';
import { MarketingController } from '../controllers/MarketingController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignActionSchema,
  campaignCompletionSchema,
  listCampaignsSchema,
  createDiscountCodeSchema,
  bulkDiscountCodeSchema,
  listDiscountCodesSchema,
  validateDiscountCodeSchema,
  applyDiscountCodeSchema,
  createEmailSequenceSchema,
  listEmailSequencesSchema,
  updateEmailSequenceSchema,
  deleteEmailSequenceSchema,
  addCampaignStepSchema,
  previewAudienceSchema,
  scheduleCampaignSchema,
  getAttributionAnalyticsSchema,
  getFunnelAnalyticsSchema,
  validateRequest,
} from '../validators/marketing.validators';

/**
 * Create and configure marketing routes
 */
export function createMarketingRoutes(controller: MarketingController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * CAMPAIGN ROUTES
   */

  /**
   * POST /api/v1/marketing/campaigns
   * Create a new marketing campaign
   * Auth: user
   */
  router.post(
    '/campaigns',
    validateRequest(createCampaignSchema),
    (req: Request, res: Response, next: NextFunction) => controller.createCampaign(req, res, next),
  );

  /**
   * GET /api/v1/marketing/campaigns
   * List all marketing campaigns with pagination
   * Auth: user
   * Query params: page, limit, status, campaign_type, search
   */
  router.get('/campaigns', (req: Request, res: Response, next: NextFunction) =>
    controller.listCampaigns(req, res, next),
  );

  /**
   * EMAIL SEQUENCE ROUTES
   */

  /**
   * GET /api/v1/marketing/email-sequences/:id
   * Get email sequence details
   * Auth: admin
   */
  router.get(
    '/email-sequences/:id',
    requireRole(['admin']),
    (req: Request, res: Response, next: NextFunction) =>
      controller.getEmailSequenceDetails(req, res, next),
  );

  /**
   * POST /api/v1/marketing/email-sequences
   * Create a new email sequence
   * Auth: admin
   */
  router.post(
    '/email-sequences',
    requireRole(['admin']),
    validateRequest(createEmailSequenceSchema),
    (req: Request, res: Response, next: NextFunction) =>
      controller.createEmailSequence(req, res, next),
  );

  /**
   * GET /api/v1/marketing/email-sequences
   * List all email sequences
   * Auth: admin
   * Query params: campaign_id, status, trigger_event, page, limit
   */
  router.get(
    '/email-sequences',
    requireRole(['admin']),
    validateRequest(listEmailSequencesSchema),
    (req: Request, res: Response, next: NextFunction) =>
      controller.listEmailSequences(req, res, next),
  );

  /**
   * PUT /api/v1/marketing/email-sequences/:id
   * Update an email sequence
   * Auth: admin
   */
  router.put(
    '/email-sequences/:id',
    requireRole(['admin']),
    validateRequest(updateEmailSequenceSchema),
    (req: Request, res: Response, next: NextFunction) =>
      controller.updateEmailSequence(req, res, next),
  );

  /**
   * DELETE /api/v1/marketing/email-sequences/:id
   * Delete an email sequence
   * Auth: admin
   */
  router.delete(
    '/email-sequences/:id',
    requireRole(['admin']),
    (req: Request, res: Response, next: NextFunction) =>
      controller.deleteEmailSequence(req, res, next),
  );

  // ─── WS-A: Campaign Orchestrator Routes ──────────────────

  /**
   * POST /api/v1/marketing/campaigns/:id/steps
   * Add a step to a campaign journey
   * Auth: admin
   */
  router.post(
    '/campaigns/:id/steps',
    requireRole(['admin']),
    validateRequest(addCampaignStepSchema),
    (req: Request, res: Response, next: NextFunction) => controller.addCampaignStep(req, res, next),
  );

  /**
   * POST /api/v1/marketing/audiences/preview
   * Preview audience size based on filter criteria
   * Auth: user
   */
  router.post(
    '/audiences/preview',
    validateRequest(previewAudienceSchema),
    (req: Request, res: Response, next: NextFunction) => controller.previewAudience(req, res, next),
  );

  /**
   * POST /api/v1/marketing/campaigns/:id/schedule
   * Schedule a campaign for future delivery
   * Auth: admin
   */
  router.post(
    '/campaigns/:id/schedule',
    requireRole(['admin']),
    validateRequest(scheduleCampaignSchema),
    (req: Request, res: Response, next: NextFunction) =>
      controller.scheduleCampaign(req, res, next),
  );

  /**
   * GET /api/v1/marketing/campaigns/:id/deliveries
   * Get deliveries for a campaign
   * Auth: user
   */
  router.get('/campaigns/:id/deliveries', (req: Request, res: Response, next: NextFunction) =>
    controller.getCampaignDeliveries(req, res, next),
  );

  // ─── WS-D: Attribution Analytics Routes ──────────────────

  /**
   * GET /api/v1/marketing/analytics/attribution
   * Get attribution analytics across channels
   * Auth: user
   */
  router.get(
    '/analytics/attribution',
    validateRequest(getAttributionAnalyticsSchema),
    (req: Request, res: Response, next: NextFunction) =>
      controller.getAttributionAnalytics(req, res, next),
  );

  /**
   * GET /api/v1/marketing/analytics/funnel
   * Get funnel analytics for a campaign
   * Auth: user
   */
  router.get(
    '/analytics/funnel',
    validateRequest(getFunnelAnalyticsSchema),
    (req: Request, res: Response, next: NextFunction) =>
      controller.getFunnelAnalytics(req, res, next),
  );

  return router;
}
