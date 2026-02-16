import { Router, Request, Response, NextFunction } from 'express';
import { SupplierController } from '../controllers/SupplierController';
import { ISupplierRepository } from '../../application/ports/ISupplierRepository';
import { SupplierSyncJob } from '../../infrastructure/jobs/SupplierSyncJob';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import * as Validators from '../validators/supplier.validators';

export function createSupplierRoutes(
  repository: ISupplierRepository,
  syncJob: SupplierSyncJob,
): Router {
  const router = Router();
  const controller = new SupplierController(repository, syncJob);

  // Apply authentication to all routes
  router.use(authenticate);

  // Middleware for validation
  const validateRequest =
    (schema: any) => (req: Request, res: Response, next: NextFunction) => {
      const { error, value } = schema.validate(req.body || req.query);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.details.map((d: any) => d.message),
        });
        return;
      }
      req.body = { ...req.body, ...value };
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

  return router;
}
