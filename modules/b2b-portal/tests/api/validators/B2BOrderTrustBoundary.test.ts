import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { Express, Response } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createB2BRoutes } from '../../../src/api/routes/b2b.routes';
import { createB2BOrderSchema } from '../../../src/api/validators/b2b-checkout.validators';

const validOrderPayload = {
  items: [
    {
      product_id: 1,
      quantity: 2,
    },
  ],
  shipping_address: {
    street: 'Strada Test 1',
    city: 'Bucuresti',
    postal_code: '010101',
    country: 'Romania',
  },
  contact_name: 'Test Buyer',
  contact_phone: '0712345678',
  payment_method: 'CREDIT',
};

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

function createApp(): Express {
  const orderController = {
    async createOrder(_req: unknown, res: Response) {
      res.status(201).json({ success: true });
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
      noopController as any,
      orderController as any,
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

describe('B2B order trust boundary validation', () => {
  beforeEach(() => {
    process.env['JWT_SECRET_B2B'] = 'test-b2b-secret';
  });

  it('does not require client supplied item prices', () => {
    const { error, value } = createB2BOrderSchema.validate(validOrderPayload, {
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    expect(value.items[0]).toEqual({ product_id: 1, quantity: 2 });
  });

  it('rejects client supplied pricing fields', () => {
    const { error } = createB2BOrderSchema.validate(
      {
        ...validOrderPayload,
        items: [
          {
            product_id: 1,
            quantity: 2,
            price: 0.01,
            unit_price: 0.01,
            discount: 99,
            subtotal: 0.02,
            total: 0.02,
          },
        ],
      },
      { abortEarly: false },
    );

    expect(error?.details.map((detail) => detail.path.join('.'))).toEqual(
      expect.arrayContaining([
        'items.0.price',
        'items.0.unit_price',
        'items.0.discount',
        'items.0.subtotal',
        'items.0.total',
      ]),
    );
  });

  it('rejects non-positive item quantities', () => {
    const { error } = createB2BOrderSchema.validate(
      {
        ...validOrderPayload,
        items: [{ product_id: 1, quantity: 0 }],
      },
      { abortEarly: false },
    );

    expect(error?.details.map((detail) => detail.path.join('.'))).toContain('items.0.quantity');
  });

  it('applies order validation on the direct order route', async () => {
    const response = await request(createApp())
      .post('/api/v1/b2b/orders')
      .set('Authorization', `Bearer ${createB2BToken()}`)
      .send({
        ...validOrderPayload,
        items: [{ product_id: 1, quantity: -5 }],
      });

    expect(response.status).toBe(400);
  });
});
