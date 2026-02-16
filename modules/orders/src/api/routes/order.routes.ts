import { Router, Request, Response, NextFunction } from 'express';
import { OrderController } from '../controllers/OrderController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { validateRequest } from '../validators/order.validators';

export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  router.post('/', (req: Request, res: Response, next: NextFunction) =>
    controller.createOrder(req, res, next)
  );

  router.get('/', (req: Request, res: Response, next: NextFunction) =>
    controller.listOrders(req, res, next)
  );

  router.get('/:id', (req: Request, res: Response, next: NextFunction) =>
    controller.getOrderById(req, res, next)
  );

  router.get('/number/:orderNumber', (req: Request, res: Response, next: NextFunction) =>
    controller.getOrderByNumber(req, res, next)
  );

  router.patch('/:id/status', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.updateOrderStatus(req, res, next)
  );

  router.post('/:id/partial-delivery', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.recordPartialDelivery(req, res, next)
  );

  router.post('/:id/cancel', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.cancelOrder(req, res, next)
  );

  router.post('/:id/proforma', (req: Request, res: Response, next: NextFunction) =>
    controller.generateProforma(req, res, next)
  );

  router.get('/:id/status-history', (req: Request, res: Response, next: NextFunction) =>
    controller.getStatusHistory(req, res, next)
  );

  router.get('/customer/:customerId', (req: Request, res: Response, next: NextFunction) =>
    controller.getCustomerOrders(req, res, next)
  );

  return router;
}
