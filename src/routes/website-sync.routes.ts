import { NextFunction, Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';

type WebsiteSyncEnv = Record<string, string | undefined>;

const TOKEN_ENV_KEYS = ['WEBSITE_SYNC_TOKEN', 'WEBSITE_SYNC_API_TOKEN'];

function getConfiguredToken(env: WebsiteSyncEnv): string | undefined {
  return TOKEN_ENV_KEYS.map((key) => env[key]).find((token): token is string => Boolean(token));
}

function getRequestToken(req: Request): string | undefined {
  const authorization = req.header('authorization');

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return req.header('x-website-sync-token') || req.header('x-api-key');
}

function createTokenMiddleware(env: WebsiteSyncEnv) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const configuredToken = getConfiguredToken(env);

    if (!configuredToken) {
      res.status(401).json({ error: 'Website sync token is not configured' });
      return;
    }

    const requestToken = getRequestToken(req);

    if (!requestToken) {
      res.status(401).json({ error: 'Website sync token is required' });
      return;
    }

    if (requestToken !== configuredToken) {
      res.status(403).json({ error: 'Website sync token is invalid' });
      return;
    }

    next();
  };
}

function notImplemented(_req: Request, res: Response): void {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Website sync mutation handlers are not available in this build',
  });
}

export function createWebsiteSyncRouter(dataSource: DataSource, env: WebsiteSyncEnv): Router {
  const router = Router();

  router.use('/website-sync', createTokenMiddleware(env));

  router.get('/website-sync/status', (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'ok',
      service: 'website-sync',
      database: {
        initialized: dataSource.isInitialized,
      },
    });
  });

  router.get('/website-sync/health', (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'ok',
      service: 'website-sync',
    });
  });

  router.post('/website-sync/sync', notImplemented);
  router.post('/website-sync/products', notImplemented);
  router.post('/website-sync/orders', notImplemented);
  router.put('/website-sync/products/:id', notImplemented);
  router.patch('/website-sync/products/:id', notImplemented);
  router.delete('/website-sync/products/:id', notImplemented);

  return router;
}
