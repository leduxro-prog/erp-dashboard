import { Router } from 'express';

import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

import { ImageSearchAdminController } from './ImageSearchAdminController';

export function createImageSearchAdminRoutes(controller: ImageSearchAdminController): Router {
  const router = Router();

  router.use(authenticate, requireRole(['admin']));
  router.get('/health', (req, res) => void controller.health(req, res));
  router.post('/reindex', (req, res) => void controller.reindexAll(req, res));
  router.post('/products/:productId/reindex', (req, res) => void controller.reindexProduct(req, res));

  return router;
}
