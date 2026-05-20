import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { Express, Response, NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { createB2BRoutes } from '../../src/api/routes/b2b.routes';

type CatalogVisibility = 'public' | 'login_only' | 'hidden';

function createSettingsService(catalogVisibility: CatalogVisibility) {
  return {
    async getPublicSettings() {
      return {
        general: {
          companyName: 'Ledux SRL',
          taxId: 'RO12345678',
          address: '',
          phone: '',
          email: '',
          currency: 'RON',
          vatRate: 19,
        },
        b2b: {
          catalogVisibility,
          approvalMode: 'manual' as const,
          showPrices: true,
          showStock: true,
          allowRegistration: true,
          autoApprove: false,
          minOrderValue: '0',
          defaultCreditLimit: '0',
        },
        brandStrategy: {
          selectedDirection: 'hybrid_commerce' as const,
          brandName: 'LEDUX',
          website: 'https://ledux.ro',
          promise: 'Iluminat pentru retail si B2B.',
          toneOfVoice: ['clar'],
          valuePillars: ['stoc real'],
          forbiddenPhrases: [],
          seo: {
            titleSuffix: 'Ledux.ro',
            metaDescriptionCta: 'Comanda online.',
            focusKeywords: ['iluminat'],
            categoryIntentMap: {},
          },
          ai: {
            enforceBrandGuardrails: true,
            defaultTemperature: 0.2,
            maxTokens: 512,
            preferredModel: 'gemini-2.5-flash',
          },
        },
      };
    },
  };
}

function createApp(catalogVisibility: CatalogVisibility): Express {
  const controller = {
    async registerB2BCustomer() {},
    async verifyCui() {},
    async verifyCuiGet() {},
    async listProducts(_req: unknown, res: Response, _next: NextFunction) {
      res.status(200).json({
        success: true,
        data: {
          products: [
            {
              id: 1,
              sku: 'LED-001',
              name: 'Panou LED 40W',
              description: 'Panou LED pentru retail si B2B',
              price: 199.99,
              currency: 'RON',
              stock_local: 4,
              stock_supplier: 8,
              stock_total: 12,
              supplier_lead_time: 3,
            },
          ],
          pagination: {
            page: 1,
            limit: 24,
            total: 1,
            total_pages: 1,
          },
        },
      });
    },
    async getProductFilters(_req: unknown, res: Response, _next: NextFunction) {
      res.status(200).json({ success: true, data: {} });
    },
    async getProductCategories(_req: unknown, res: Response, _next: NextFunction) {
      res.status(200).json({ success: true, data: [] });
    },
    async previewDocument() {},
    async getProductDetails(_req: unknown, res: Response, _next: NextFunction) {
      res.status(200).json({
        success: true,
        data: {
          id: 1,
          sku: 'LED-001',
          name: 'Panou LED 40W',
          description: 'Panou LED pentru retail si B2B',
          price: 199.99,
          currency: 'RON',
          stock_local: 4,
          stock_supplier: 8,
          stock_total: 12,
          supplier_lead_time: 3,
        },
      });
    },
  };

  const noopController = new Proxy(
    {},
    {
      get: () => async (_req: unknown, res: Response) => {
        res.status(200).json({ success: true });
      },
    },
  );

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
      createSettingsService(catalogVisibility) as any,
    ),
  );

  return app;
}

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

describe('B2B catalog visibility policy', () => {
  beforeEach(() => {
    process.env['JWT_SECRET_B2B'] = 'test-b2b-secret';
  });

  it('allows anonymous catalog access when catalog visibility is public', async () => {
    const app = createApp('public');

    const response = await request(app).get('/api/v1/b2b/products');

    expect(response.status).toBe(200);
    expect(response.body.data.products[0]).toMatchObject({
      id: 1,
      price: 199.99,
      stock_local: 4,
      stock_supplier: 8,
    });
  });

  it('redacts protected catalog fields for anonymous users when catalog visibility is login_only', async () => {
    const app = createApp('login_only');

    const listResponse = await request(app).get('/api/v1/b2b/products');
    const detailResponse = await request(app).get('/api/v1/b2b/products/1');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.products[0]).toMatchObject({
      id: 1,
    });
    expect(listResponse.body.data.products[0]).not.toHaveProperty('price');
    expect(listResponse.body.data.products[0]).not.toHaveProperty('stock_local');
    expect(listResponse.body.data.products[0]).not.toHaveProperty('stock_supplier');
    expect(listResponse.body.data.products[0]).not.toHaveProperty('stock_total');
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({
      id: 1,
    });
    expect(detailResponse.body.data).not.toHaveProperty('price');
    expect(detailResponse.body.data).not.toHaveProperty('stock_local');
    expect(detailResponse.body.data).not.toHaveProperty('stock_supplier');
    expect(detailResponse.body.data).not.toHaveProperty('stock_total');
  });

  it('hides the catalog entirely from anonymous users when catalog visibility is hidden', async () => {
    const app = createApp('hidden');

    const listResponse = await request(app).get('/api/v1/b2b/products');
    const detailResponse = await request(app).get('/api/v1/b2b/products/1');

    expect(listResponse.status).toBe(404);
    expect(detailResponse.status).toBe(404);
  });

  it('allows authenticated B2B customers to access allowed catalog fields when hidden publicly', async () => {
    const app = createApp('hidden');
    const token = createB2BToken();

    const response = await request(app)
      .get('/api/v1/b2b/products')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products[0]).toMatchObject({
      id: 1,
      price: 199.99,
      stock_local: 4,
      stock_supplier: 8,
    });
    expect(response.body.data.products[0]).not.toHaveProperty('credit_limit');
    expect(response.body.data.products[0]).not.toHaveProperty('discount_tiers');
  });

  it('allows authenticated B2B customers to access protected catalog fields when catalog visibility is login_only', async () => {
    const app = createApp('login_only');
    const token = createB2BToken();

    const response = await request(app)
      .get('/api/v1/b2b/products')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products[0]).toMatchObject({
      id: 1,
      price: 199.99,
      stock_local: 4,
      stock_supplier: 8,
    });
  });

  it('marks anonymous catalog responses as public cacheable', async () => {
    const app = createApp('public');

    const response = await request(app).get('/api/v1/b2b/products');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('public');
    expect(response.headers['vary']).toBe('Accept-Encoding');
  });

  it('marks authenticated catalog responses as private and varies by auth state', async () => {
    const app = createApp('public');
    const token = createB2BToken();

    const response = await request(app)
      .get('/api/v1/b2b/products')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('private');
    expect(response.headers['vary']).toContain('Authorization');
    expect(response.headers['vary']).toContain('Cookie');
    expect(response.headers['vary']).toContain('Accept-Encoding');
  });
});
