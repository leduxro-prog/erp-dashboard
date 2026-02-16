import { Router, RequestHandler } from 'express';
import { PricingController } from '../controllers/PricingController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import {
  validationMiddleware,
  getProductPricingSchema,
  calculateOrderSchema,
  getTierPricingSchema,
  createPromotionSchema,
  deactivatePromotionSchema,
  listPromotionsSchema,
} from '../validators/pricing.validators';

export const createPricingRoutes = (controller: PricingController): Router => {
  const router = Router();

  // All routes require authentication
  router.use(authenticate);

  // GET /api/v1/pricing/:productId
  router.get(
    '/:productId',
    validationMiddleware(getProductPricingSchema),
    controller.getProductPricing as RequestHandler,
  );

  // POST /api/v1/pricing/calculate
  router.post(
    '/calculate',
    validationMiddleware(calculateOrderSchema),
    controller.calculateOrderPricing as RequestHandler,
  );

  // GET /api/v1/pricing/:productId/tiers
  router.get(
    '/:productId/tiers',
    validationMiddleware(getTierPricingSchema),
    controller.getTierPricing as RequestHandler,
  );

  // POST /api/v1/pricing/promotions (requires admin role)
  router.post(
    '/promotions',
    requireRole(['admin']),
    validationMiddleware(createPromotionSchema),
    controller.createPromotion as RequestHandler,
  );

  // GET /api/v1/pricing/promotions
  router.get(
    '/promotions',
    validationMiddleware(listPromotionsSchema),
    controller.listPromotions as RequestHandler,
  );

  // DELETE /api/v1/pricing/promotions/:id (requires admin role)
  router.delete(
    '/promotions/:id',
    requireRole(['admin']),
    validationMiddleware(deactivatePromotionSchema),
    controller.deactivatePromotion as RequestHandler,
  );

  return router;
};
