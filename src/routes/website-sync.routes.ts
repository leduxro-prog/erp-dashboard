import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';

export function createWebsiteSyncRouter(
  _dataSource: DataSource,
  _env: NodeJS.ProcessEnv,
): Router {
  const router = Router();

  // Placeholder route keeps server wiring stable until website-sync handlers are introduced.
  router.get('/website-sync/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  return router;
}
