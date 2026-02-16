import { Router, Request, Response, NextFunction } from 'express';
import { WhatsAppController } from '../controllers/WhatsAppController';
import {
  authenticate,
  requireRole,
  AuthenticatedRequest,
} from '@shared/middleware/auth.middleware';
import { asyncHandler } from '@shared/middleware/async-handler';
import {
  validationMiddleware,
  queryValidationMiddleware,
  sendMessageSchema,
  listMessagesSchema,
  webhookSchema,
  listConversationsSchema,
  assignConversationSchema,
  resolveConversationSchema,
  listTemplatesSchema,
  createTemplateSchema,
} from '../validators/whatsapp.validators';

/**
 * Async handler wrapper for catching errors in async route handlers
 */

export function createWhatsAppRoutes(controller: WhatsAppController): Router {
  const router = Router();

  // Apply authentication to all routes except webhook
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/v1/whatsapp/webhooks' && req.method === 'POST') {
      // Skip authentication for webhook endpoint
      return next();
    }
    authenticate(req as AuthenticatedRequest, res, next);
  });

  /**
   * POST /api/v1/whatsapp/messages
   * Send a WhatsApp message
   */
  router.post(
    '/api/v1/whatsapp/messages',
    authenticate,
    validationMiddleware(sendMessageSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.sendMessage(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/messages
   * List messages
   */
  router.get(
    '/api/v1/whatsapp/messages',
    authenticate,
    queryValidationMiddleware(listMessagesSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listMessages(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/messages/:id
   * Get message details
   */
  router.get(
    '/api/v1/whatsapp/messages/:id',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getMessageDetails(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/webhooks
   * Webhook handler for incoming messages and status updates from WhatsApp
   * Public endpoint - no authentication required
   */
  router.post(
    '/api/v1/whatsapp/webhooks',
    validationMiddleware(webhookSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.handleWebhook(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/conversations
   * List conversations
   */
  router.get(
    '/api/v1/whatsapp/conversations',
    authenticate,
    queryValidationMiddleware(listConversationsSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listConversations(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/conversations/:id
   * Get conversation details
   */
  router.get(
    '/api/v1/whatsapp/conversations/:id',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getConversation(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/conversations/:id/assign
   * Assign conversation to agent
   */
  router.post(
    '/api/v1/whatsapp/conversations/:id/assign',
    authenticate,
    requireRole(['admin', 'supervisor']),
    validationMiddleware(assignConversationSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.assignConversation(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/conversations/:id/resolve
   * Resolve conversation
   */
  router.post(
    '/api/v1/whatsapp/conversations/:id/resolve',
    authenticate,
    validationMiddleware(resolveConversationSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.resolveConversation(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/templates
   * List message templates
   */
  router.get(
    '/api/v1/whatsapp/templates',
    authenticate,
    queryValidationMiddleware(listTemplatesSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listTemplates(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/templates
   * Create message template (admin only)
   */
  router.post(
    '/api/v1/whatsapp/templates',
    authenticate,
    requireRole(['admin']),
    validationMiddleware(createTemplateSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.createTemplate(req, res, next),
    ),
  );

  // ─── NEW ENDPOINTS ──────────────────

  /**
   * POST /api/v1/whatsapp/conversations/:id/reopen
   * Reopen a resolved conversation
   */
  router.post(
    '/api/v1/whatsapp/conversations/:id/reopen',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.reopenConversation(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/conversations/:id/read
   * Mark conversation as read
   */
  router.post(
    '/api/v1/whatsapp/conversations/:id/read',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.markConversationAsRead(req, res, next),
    ),
  );

  /**
   * PUT /api/v1/whatsapp/templates/:id
   * Update template
   */
  router.put(
    '/api/v1/whatsapp/templates/:id',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.updateTemplate(req, res, next),
    ),
  );

  /**
   * DELETE /api/v1/whatsapp/templates/:id
   * Delete template
   */
  router.delete(
    '/api/v1/whatsapp/templates/:id',
    authenticate,
    requireRole(['admin']),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.deleteTemplate(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/agents
   * Get all agents
   */
  router.get(
    '/api/v1/whatsapp/agents',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getAgents(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/agents/:agentId/status
   * Set agent status
   */
  router.post(
    '/api/v1/whatsapp/agents/:agentId/status',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.setAgentStatus(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/connection/status
   * Get connection status
   */
  router.get(
    '/api/v1/whatsapp/connection/status',
    asyncHandler((req: Request, res: Response, next: NextFunction) =>
      controller.getConnectionStatus(req as AuthenticatedRequest, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/connect
   * Connect WhatsApp (generate QR code)
   */
  router.post(
    '/api/v1/whatsapp/connect',
    authenticate,
    requireRole(['admin']),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.connectWhatsApp(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/disconnect
   * Disconnect WhatsApp
   */
  router.post(
    '/api/v1/whatsapp/disconnect',
    authenticate,
    requireRole(['admin']),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.disconnectWhatsApp(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/reconnect
   * Reconnect WhatsApp (force new QR code)
   */
  router.post(
    '/api/v1/whatsapp/reconnect',
    authenticate,
    requireRole(['admin']),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.reconnectWhatsApp(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/tags
   * Get all tags
   */
  router.get(
    '/api/v1/whatsapp/tags',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getTags(req, res, next),
    ),
  );

  /**
   * POST /api/v1/whatsapp/conversations/:id/tags
   * Update conversation tags
   */
  router.post(
    '/api/v1/whatsapp/conversations/:id/tags',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.updateConversationTags(req, res, next),
    ),
  );

  /**
   * GET /api/v1/whatsapp/statistics
   * Get WhatsApp statistics
   */
  router.get(
    '/api/v1/whatsapp/statistics',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getStatistics(req, res, next),
    ),
  );

  return router;
}
