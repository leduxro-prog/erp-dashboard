import { Router, Request, Response } from 'express';
import { WooCommerceController } from '../controllers/WooCommerceController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { WooCommerceValidators } from '../validators/woocommerce.validators';

export function createWooCommerceRoutes(
  controller: WooCommerceController,
  webhookMiddleware?: (req: Request, res: Response, next: any) => Promise<void>,
): Router {
  const router = Router();

  // =====================================================
  // WooCommerce Webhook endpoint (NO auth - called by WooCommerce)
  // Protected by HMAC signature verification + idempotency middleware
  // =====================================================
  if (webhookMiddleware) {
    router.post('/webhook', webhookMiddleware, (req: Request, res: Response) =>
      controller.handleWebhook(req, res),
    );
  } else {
    router.post('/webhook', (req: Request, res: Response) => controller.handleWebhook(req, res));
  }

  // Apply authentication to all other routes
  router.use(authenticate);

  // Test connection endpoint
  router.get('/test-connection', (req: Request, res: Response) =>
    controller.testConnection(req, res),
  );

  // Sync endpoints
  router.post(
    '/sync/product/:productId',
    WooCommerceValidators.validateProductId,
    (req: Request, res: Response) => controller.syncSingleProduct(req, res),
  );

  router.post(
    '/sync/all',
    requireRole(['admin']),
    WooCommerceValidators.validateSyncAllProductsRequest,
    (req: Request, res: Response) => controller.syncAllProducts(req, res),
  );

  router.post(
    '/sync/stock/:productId',
    WooCommerceValidators.validateProductId,
    (req: Request, res: Response) => controller.syncStock(req, res),
  );

  router.post(
    '/sync/price/:productId',
    WooCommerceValidators.validateProductId,
    (req: Request, res: Response) => controller.syncPrice(req, res),
  );

  router.post('/sync/categories', requireRole(['admin']), (req: Request, res: Response) =>
    controller.syncCategories(req, res),
  );

  // Order pulling
  router.post(
    '/pull/orders',
    WooCommerceValidators.validatePullOrdersRequest,
    (req: Request, res: Response) => controller.pullOrders(req, res),
  );

  // Status and diagnostics
  router.get('/sync/status', (req: Request, res: Response) => controller.getSyncStatus(req, res));

  router.get('/sync/failed', requireRole(['admin']), (req: Request, res: Response) =>
    controller.getFailedItems(req, res),
  );

  router.post('/sync/retry', requireRole(['admin']), (req: Request, res: Response) =>
    controller.retryFailedSync(req, res),
  );

  router.get(
    '/mappings/:productId',
    WooCommerceValidators.validateProductId,
    (req: Request, res: Response) => controller.getProductMapping(req, res),
  );

  return router;
}
