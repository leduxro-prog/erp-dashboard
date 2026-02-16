import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '@shared/middleware/validation.middleware';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { wrapController } from '@shared/middleware/async-handler';
import {
  checkStockSchema,
  reserveStockSchema,
  adjustStockSchema,
  getMovementsSchema,
} from '../validators/inventory.validators';

export function createInventoryRoutes(controller: InventoryController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  // Stock levels list endpoint (with alias for frontend compatibility)
  router.get('/stock-levels', wrapController(controller, 'getStockLevels'));

  router.get('/products', wrapController(controller, 'getStockLevels'));

  // Static routes MUST be registered before parameterized routes
  // to prevent Express from matching e.g. /alerts as /:productId

  router.post(
    '/check',
    validateBody(checkStockSchema),
    wrapController(controller, 'checkStockBatch'),
  );

  // Stock reservation endpoints
  router.post(
    '/reserve',
    validateBody(reserveStockSchema),
    wrapController(controller, 'reserveStock'),
  );

  router.delete('/reservations/:id', wrapController(controller, 'releaseReservation'));

  // Admin only endpoints
  router.post(
    '/adjust',
    requireRole(['admin']),
    validateBody(adjustStockSchema),
    wrapController(controller, 'adjustStock'),
  );

  // Alerts
  router.get('/alerts', wrapController(controller, 'getLowStockAlerts'));

  router.post('/alerts/:id/acknowledge', wrapController(controller, 'acknowledgeAlert'));

  // Sync endpoints (admin only)
  router.post(
    '/sync/smartbill',
    requireRole(['admin']),
    wrapController(controller, 'syncSmartBill'),
  );

  router.post(
    '/sync/suppliers',
    requireRole(['admin']),
    wrapController(controller, 'syncSuppliers'),
  );

  // Warehouses
  router.get('/warehouses', wrapController(controller, 'getWarehouses'));

  // Parameterized routes AFTER all static routes
  router.get('/:productId', wrapController(controller, 'getStock'));

  router.get(
    '/:productId/movements',
    validateQuery(getMovementsSchema),
    wrapController(controller, 'getMovementHistory'),
  );

  // Product Images (admin only)
  router.post(
    '/products/:productId/images',
    requireRole(['admin']),
    wrapController(controller, 'addProductImage'),
  );

  router.delete(
    '/products/:productId/images/:imageId',
    requireRole(['admin']),
    wrapController(controller, 'deleteProductImage'),
  );

  router.post(
    '/products/images/bulk-import',
    requireRole(['admin']),
    wrapController(controller, 'bulkImportImages'),
  );

  router.post(
    '/products/images/auto-search',
    requireRole(['admin']),
    wrapController(controller, 'autoSearchProductImages'),
  );

  return router;
}
