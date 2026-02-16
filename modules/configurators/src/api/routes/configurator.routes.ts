import { Router, Request, Response, NextFunction } from 'express';
import { ConfiguratorController } from '../controllers/ConfiguratorController';
import { authenticate, requireRole, AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { asyncHandler } from '@shared/middleware/async-handler';
import {
  validationMiddleware,
  queryValidationMiddleware,
  createSessionSchema,
  addComponentSchema,
  updateComponentSchema,
  validateConfigurationSchema,
  calculatePriceSchema,
  completeConfigurationSchema,
  convertToQuoteSchema,
  getCatalogSchema,
} from '../validators/configurator.validators';

/**
 * Async handler wrapper for catching errors in async route handlers
 */

export function createConfiguratorRoutes(controller: ConfiguratorController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * POST /api/v1/configurators/sessions
   * Create a new configurator session
   */
  router.post(
    '/api/v1/configurators/sessions',
    validationMiddleware(createSessionSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.createSession(req, res, next),
    ),
  );

  /**
   * GET /api/v1/configurators/sessions/:token
   * Get session details by token
   */
  router.get(
    '/api/v1/configurators/sessions/:token',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getSession(req, res, next),
    ),
  );

  /**
   * POST /api/v1/configurators/sessions/:token/items
   * Add a component to the configuration session
   */
  router.post(
    '/api/v1/configurators/sessions/:token/items',
    validationMiddleware(addComponentSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.addComponent(req, res, next),
    ),
  );

  /**
   * PUT /api/v1/configurators/sessions/:token/items/:itemId
   * Update a component in the configuration session
   */
  router.put(
    '/api/v1/configurators/sessions/:token/items/:itemId',
    validationMiddleware(updateComponentSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.updateComponent(req, res, next),
    ),
  );

  /**
   * DELETE /api/v1/configurators/sessions/:token/items/:itemId
   * Remove a component from the configuration session
   */
  router.delete(
    '/api/v1/configurators/sessions/:token/items/:itemId',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.removeComponent(req, res, next),
    ),
  );

  /**
   * POST /api/v1/configurators/sessions/:token/validate
   * Validate the current configuration
   */
  router.post(
    '/api/v1/configurators/sessions/:token/validate',
    validationMiddleware(validateConfigurationSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.validateConfiguration(req, res, next),
    ),
  );

  /**
   * POST /api/v1/configurators/sessions/:token/price
   * Calculate pricing for the current configuration
   */
  router.post(
    '/api/v1/configurators/sessions/:token/price',
    validationMiddleware(calculatePriceSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.calculatePrice(req, res, next),
    ),
  );

  /**
   * POST /api/v1/configurators/sessions/:token/complete
   * Complete the configuration session
   */
  router.post(
    '/api/v1/configurators/sessions/:token/complete',
    validationMiddleware(completeConfigurationSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.completeConfiguration(req, res, next),
    ),
  );

  /**
   * POST /api/v1/configurators/sessions/:token/convert-to-quote
   * Convert configuration to a quote
   */
  router.post(
    '/api/v1/configurators/sessions/:token/convert-to-quote',
    validationMiddleware(convertToQuoteSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.convertToQuote(req, res, next),
    ),
  );

  /**
   * GET /api/v1/configurators/catalog/:type
   * Get component catalog for a specific type
   */
  router.get(
    '/api/v1/configurators/catalog/:type',
    queryValidationMiddleware(getCatalogSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getCatalog(req, res, next),
    ),
  );

  return router;
}
