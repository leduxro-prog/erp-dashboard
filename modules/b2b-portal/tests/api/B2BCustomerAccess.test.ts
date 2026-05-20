import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { Express, NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createB2BRoutes } from '../../src/api/routes/b2b.routes';

function createB2BToken(): string {
  return jwt.sign(
    {
      sub: 'customer-1',
      email: 'buyer@ledux.ro',
      role: 'customer',
      realm: 'b2b',
      customer_id: 'customer-1',
      tier: 'STANDARD',
      company_name: 'Ledux Partner',
    },
    process.env['JWT_SECRET_B2B'] || 'test-b2b-secret',
  );
}

function createAdminToken(): string {
  return jwt.sign(
    {
      id: 'admin-1',
      email: 'admin@ledux.ro',
      role: 'admin',
    },
    process.env.JWT_SECRET || 'test-secret',
  );
}

function createApp(): Express {
  const controller = new Proxy(
    {
      async listCustomers(_req: unknown, res: Response, _next: NextFunction) {
        res.status(200).json({
          success: true,
          data: [
            {
              id: 'customer-1',
              company_name: 'Customer One',
              credit_limit: 10000,
              credit_used: 500,
            },
          ],
        });
      },
    },
    {
      get(target, prop) {
        if (prop in target) {
          return target[prop as keyof typeof target];
        }

        return async (_req: unknown, res: Response) => {
          res.status(200).json({ success: true });
        };
      },
    },
  );

  const noopController = new Proxy(
    {},
    {
      get: () => async (_req: unknown, res: Response) => {
        res.status(200).json({ success: true });
      },
    },
  );

  const settingsService = {
    async getPublicSettings() {
      return { b2b: { catalogVisibility: 'public' } };
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/b2b',
    (createB2BRoutes as any)(
      controller as any,
      noopController as any,
      noopController as any,
      noopController as any,
      noopController as any,
      noopController as any,
      noopController as any,
      noopController as any,
      noopController as any,
      noopController as any,
      settingsService as any,
    ),
  );

  return app;
}

describe('B2B customer access policy', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env['JWT_SECRET_B2B'] = 'test-b2b-secret';
  });

  it('does not allow a normal B2B customer to list all customers', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/b2b/customers')
      .set('Authorization', `Bearer ${createB2BToken()}`);

    expect(response.status).not.toBe(200);
  });

  it('allows ERP admins to list B2B customers', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/b2b/customers')
      .set('Authorization', `Bearer ${createAdminToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ id: 'customer-1' });
  });
});
