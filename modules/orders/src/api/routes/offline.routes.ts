
import { Router } from 'express';
import { OfflineController } from '../controllers/OfflineController';
import { authenticate } from '@shared/middleware/auth.middleware';

export function createOfflineRoutes(controller: OfflineController): Router {
    const router = Router();

    router.use(authenticate);

    router.post('/api/v1/orders/sync-offline', (req, res, next) => controller.syncOffline(req, res, next));
    router.get('/api/v1/orders/offline/status', (req, res, next) => controller.getSyncStatus(req, res, next));

    return router;
}
