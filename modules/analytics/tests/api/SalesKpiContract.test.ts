import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { AnalyticsController } from '../../src/api/controllers/AnalyticsController';
import { createAnalyticsRoutes } from '../../src/api/routes/analytics.routes';
import { SalesKpiQueryService } from '../../src/application/services/SalesKpiQueryService';

function createAuthToken(): string {
  return jwt.sign(
    {
      id: 'user-1',
      email: 'analytics.contract@cypher.ro',
      role: 'manager',
    },
    process.env.JWT_SECRET || 'test-secret',
  );
}

function createApp(options?: { failReadModel?: boolean; topProductsAsString?: boolean }): Express {
  const query = jest.fn(async (sql: string) => {
    if (options?.failReadModel && sql.includes('FROM sales_kpi_daily')) {
      throw new Error('sales_kpi_daily unavailable');
    }

    if (sql.includes('SELECT top_products')) {
      return [
        {
          top_products: options?.topProductsAsString
            ? JSON.stringify([{ name: 'Panou LED', revenue: 900 }])
            : [{ name: 'Panou LED', revenue: 900 }],
        },
      ];
    }

    if (sql.includes('FROM sales_kpi_daily')) {
      return [{ total_revenue: '2000', total_orders: '4', average_order_value: '500' }];
    }

    if (sql.includes('SELECT items')) {
      return [
        {
          items: [
            { name: 'Corp LED 60x60', quantity: 2, price: 300, total: 600 },
            { name: 'Spot LED GU10', quantity: 3, price: 120, total: 360 },
          ],
        },
      ];
    }

    return [{ total_revenue: '1500.5', total_orders: '3' }];
  });

  const dataSource = {
    query,
  };

  const controller = new AnalyticsController(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    } as any,
    dataSource as any,
    new SalesKpiQueryService(dataSource as any),
  );

  const app = express();
  app.use(express.json());
  app.use('/api/v1/analytics', createAnalyticsRoutes(controller));

  return app;
}

describe('Sales KPI API contract compatibility', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.ANALYTICS_SALES_SOURCE;
  });

  it('returns success payload with backwards-compatible sales metrics shape', async () => {
    const app = createApp();
    const token = createAuthToken();

    const response = await request(app)
      .get('/api/v1/analytics/kpi/sales')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        metrics: expect.any(Object),
      }),
    );

    const metrics = response.body.data.metrics;

    expect(metrics).toEqual(
      expect.objectContaining({
        total_revenue: expect.any(Number),
        total_orders: expect.any(Number),
        average_order_value: expect.any(Number),
        top_products: expect.any(Array),
      }),
    );

    expect(Array.isArray(metrics.top_products)).toBe(true);
    if (metrics.top_products.length > 0) {
      expect(metrics.top_products[0]).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          revenue: expect.any(Number),
        }),
      );
    }
  });

  it('keeps the same metrics contract when read-model source flag is enabled', async () => {
    process.env.ANALYTICS_SALES_SOURCE = 'smartbill_readmodel';

    const app = createApp({ topProductsAsString: true });
    const token = createAuthToken();

    const response = await request(app)
      .get('/api/v1/analytics/kpi/sales')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.period.source).toBe('smartbill_readmodel');

    const metrics = response.body.data.metrics;

    expect(metrics).toEqual(
      expect.objectContaining({
        total_revenue: expect.any(Number),
        total_orders: expect.any(Number),
        average_order_value: expect.any(Number),
        top_products: expect.any(Array),
      }),
    );

    expect(metrics.top_products[0]).toEqual(
      expect.objectContaining({
        name: 'Panou LED',
        revenue: 900,
      }),
    );
  });

  it('falls back to legacy SmartBill source when read-model query fails', async () => {
    process.env.ANALYTICS_SALES_SOURCE = 'smartbill_readmodel';

    const app = createApp({ failReadModel: true });
    const token = createAuthToken();

    const response = await request(app)
      .get('/api/v1/analytics/kpi/sales')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.period.source).toBe('smartbill');
    expect(response.body.data.metrics).toEqual(
      expect.objectContaining({
        total_revenue: expect.any(Number),
        total_orders: expect.any(Number),
        average_order_value: expect.any(Number),
        top_products: expect.any(Array),
      }),
    );
  });
});
