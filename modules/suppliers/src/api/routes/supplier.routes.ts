import { Router, Request, Response, NextFunction } from 'express';
import { SupplierController } from '../controllers/SupplierController';
import { ISupplierRepository } from '../../domain';
import { SupplierSyncJob } from '../../infrastructure/jobs/SupplierSyncJob';
import { SupplierPricingRulesController } from '../controllers/SupplierPricingRulesController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import * as Validators from '../validators/supplier.validators';
import * as PricingRulesValidators from '../validators/supplier-pricing-rules.validators';

type ValidationIssue = { message: string };
type ValidationResult = {
  error?: { details: ValidationIssue[] };
  value: unknown;
};
type ValidationSchema = {
  validate: (payload: unknown) => ValidationResult;
};

export function createSupplierRoutes(
  repository: ISupplierRepository,
  syncJob: SupplierSyncJob,
): Router {
  const router = Router();
  const controller = new SupplierController(repository, syncJob);
  const pricingRulesController = new SupplierPricingRulesController(repository);

  // Apply authentication to all routes
  router.use(authenticate);

  // Middleware for validation
  const validateRequest =
    (schema: ValidationSchema) => (req: Request, res: Response, next: NextFunction) => {
      const { error, value } = schema.validate(req.body || req.query);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map((d) => d.message),
        });
        return;
      }
      req.body = { ...req.body, ...(value as Record<string, unknown>) };
      next();
    };

  const validateParams =
    (schema: ValidationSchema) => (req: Request, res: Response, next: NextFunction) => {
      const { error, value } = schema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map((d) => d.message),
        });
        return;
      }
      req.params = value as Request['params'];
      next();
    };

  // Supplier endpoints
  router.get('/suppliers', (req: Request, res: Response) =>
    controller.listSuppliers(req, res),
  );

  router.get('/suppliers/:id', (req: Request, res: Response) =>
    controller.getSupplier(req, res),
  );

  router.get('/suppliers/:id/products', (req: Request, res: Response) =>
    controller.getSupplierProducts(req, res),
  );

  router.get('/suppliers/:id/statistics', (req: Request, res: Response) =>
    controller.getProductStatistics(req, res),
  );

  router.post('/suppliers/:id/sync', requireRole(['admin']), (req: Request, res: Response) =>
    controller.triggerSync(req, res),
  );

  router.post('/suppliers/sync-all', requireRole(['admin']), (req: Request, res: Response) =>
    controller.triggerSyncAll(req, res),
  );

  // SKU Mapping endpoints
  router.get('/suppliers/:id/sku-mappings', (req: Request, res: Response) =>
    controller.listSkuMappings(req, res),
  );

  router.get('/suppliers/:id/unmapped-products', (req: Request, res: Response) =>
    controller.getUnmappedProducts(req, res),
  );

  router.post(
    '/suppliers/:id/sku-mappings',
    validateRequest(Validators.createSkuMappingSchema),
    (req: Request, res: Response) => controller.createSkuMapping(req, res),
  );

  router.delete(
    '/suppliers/sku-mappings/:mappingId',
    requireRole(['admin']),
    (req: Request, res: Response) => controller.deleteSkuMapping(req, res),
  );

  // Supplier Order endpoints
  router.post(
    '/suppliers/:id/orders',
    validateRequest(Validators.placeSupplierOrderSchema),
    (req: Request, res: Response) => controller.placeOrder(req, res),
  );

  router.get('/suppliers/:id/orders', (req: Request, res: Response) =>
    controller.getOrders(req, res),
  );

  // Supplier Pricing Rules endpoints
  router.get(
    '/pricing-rules/:supplierCode',
    validateParams(PricingRulesValidators.supplierPricingRulesBySupplierParamsSchema),
    (req: Request, res: Response) => pricingRulesController.listBySupplier(req, res),
  );

  router.post(
    '/pricing-rules',
    requireRole(['admin']),
    validateRequest(PricingRulesValidators.createSupplierPricingRuleSchema),
    (req: Request, res: Response) => pricingRulesController.create(req, res),
  );

  router.put(
    '/pricing-rules/:supplierCode/:categoryKey',
    requireRole(['admin']),
    validateParams(PricingRulesValidators.supplierPricingRuleParamsSchema),
    validateRequest(PricingRulesValidators.upsertSupplierPricingRuleSchema),
    (req: Request, res: Response) => pricingRulesController.upsertByKey(req, res),
  );

  router.patch(
    '/pricing-rules/:supplierCode/:categoryKey/active',
    requireRole(['admin']),
    validateParams(PricingRulesValidators.supplierPricingRuleParamsSchema),
    validateRequest(PricingRulesValidators.setSupplierPricingRuleActiveSchema),
    (req: Request, res: Response) => pricingRulesController.setActive(req, res),
  );

  return router;
}
