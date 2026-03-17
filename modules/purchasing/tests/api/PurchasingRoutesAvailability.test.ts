import { describe, expect, it } from '@jest/globals';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';

import { createRoutes } from '../../src/api/routes';

function createSuccessController(): any {
  return new Proxy(
    {},
    {
      get: () => (_req: Request, res: Response) => {
        res.status(200).json({ success: true });
      },
    },
  );
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/purchasing',
    createRoutes(
      createSuccessController(),
      createSuccessController(),
      createSuccessController(),
      createSuccessController(),
      createSuccessController(),
    ),
  );

  return app;
}

describe('Purchasing routes availability', () => {
  it('does not return 501 for requisitions endpoint once routes are activated', async () => {
    const app = createApp();

    const response = await request(app).get('/api/v1/purchasing/requisitions');

    expect(response.status).not.toBe(501);
    expect(response.status).not.toBe(404);
    expect([200, 401, 403]).toContain(response.status);
  });
});
