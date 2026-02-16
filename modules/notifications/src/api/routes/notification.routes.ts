/**
 * Notification API Routes
 * Defines all notification endpoints
 */
import { Router } from 'express';
import { NotificationsCompositionRoot } from '../../infrastructure/composition-root';
import { NotificationController } from '../controllers/NotificationController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

/**
 * Create and configure notification routes
 */
export function createNotificationsRouter(
  compositionRoot: NotificationsCompositionRoot
): Router {
  const router = Router();
  const resendAdapter = compositionRoot.getResendAdapter();
  const controller = new NotificationController(compositionRoot, resendAdapter);

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * POST /api/v1/notifications/send
   * Send a single notification
   * Auth: user
   */
  router.post('/send', (req, res, next) => {
    controller.sendNotification(req, res).catch(next);
  });

  /**
   * POST /api/v1/notifications/bulk
   * Send bulk notifications
   * Auth: admin
   */
  router.post('/bulk', requireRole(['admin']), (req, res, next) => {
    controller.sendBulkNotification(req, res).catch(next);
  });

  /**
   * GET /api/v1/notifications/history
   * Get notification history
   * Auth: user
   * Query params: page, limit, cursor
   */
  router.get('/history', (req, res, next) => {
    controller.getNotificationHistory(req, res).catch(next);
  });

  /**
   * GET /api/v1/notifications/stats
   * Get notification statistics
   * Auth: admin
   * Query params: startDate, endDate
   */
  router.get('/stats', requireRole(['admin']), (req, res, next) => {
    controller.getNotificationStats(req, res).catch(next);
  });

  /**
   * GET /api/v1/notifications/templates
   * List templates
   * Auth: admin
   */
  router.get('/templates', requireRole(['admin']), (req, res, next) => {
    controller.listTemplates(req, res).catch(next);
  });

  /**
   * POST /api/v1/notifications/templates
   * Create template
   * Auth: admin
   */
  router.post('/templates', requireRole(['admin']), (req, res, next) => {
    controller.createTemplate(req, res).catch(next);
  });

  /**
   * PUT /api/v1/notifications/templates/:id
   * Update template
   * Auth: admin
   */
  router.put('/templates/:id', requireRole(['admin']), (req, res, next) => {
    controller.updateTemplate(req, res).catch(next);
  });

  /**
   * DELETE /api/v1/notifications/templates/:id
   * Delete template
   * Auth: admin
   */
  router.delete('/templates/:id', requireRole(['admin']), (req, res, next) => {
    controller.deleteTemplate(req, res).catch(next);
  });

  /**
   * GET /api/v1/notifications/preferences
   * Get my preferences
   * Auth: user
   */
  router.get('/preferences', (req, res, next) => {
    controller.getMyPreferences(req, res).catch(next);
  });

  /**
   * PUT /api/v1/notifications/preferences
   * Update my preferences
   * Auth: user
   */
  router.put('/preferences', (req, res, next) => {
    controller.updateMyPreferences(req, res).catch(next);
  });

  /**
   * GET /api/v1/notifications/batches/:id
   * Get batch status
   * Auth: admin
   */
  router.get('/batches/:id', requireRole(['admin']), (req, res, next) => {
    controller.getBatchStatus(req, res).catch(next);
  });

  /**
   * POST /api/v1/notifications/:id/retry
   * Retry failed notification
   * Auth: admin
   */
  router.post('/:id/retry', requireRole(['admin']), (req, res, next) => {
    controller.retryNotification(req, res).catch(next);
  });

  /**
   * GET /api/v1/notifications/:id
   * Get notification detail
   * Auth: user
   */
  router.get('/:id', (req, res, next) => {
    controller.getNotification(req, res).catch(next);
  });

  return router;
}
