import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createFinancialAccountingRoutes } from '../../src/api/routes/financialAccountingRoutes';

const ORGANIZATION_ID = '11111111-1111-1111-1111-111111111111';

function createAuthToken(): string {
  return jwt.sign(
    {
      id: 'finance-user-1',
      email: 'finance.contract@cypher.ro',
      role: 'accountant',
    },
    process.env.JWT_SECRET || 'test-secret',
  );
}

function createAppWithNullApRepository(): Express {
  const chartOfAccountRepository = {
    findById: async () => ({ id: 'acc-1' }),
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/financial-accounting',
    createFinancialAccountingRoutes(
      chartOfAccountRepository,
      {},
      {},
      {},
      null,
      null,
    ),
  );

  return app;
}

function buildValidPayload() {
  return {
    organizationId: ORGANIZATION_ID,
    vendorId: '22222222-2222-2222-2222-222222222222',
    invoiceNumber: 'AP-INV-1001',
    invoiceDate: '2026-02-01',
    dueDate: '2026-02-15',
    currencyCode: 'RON',
    apAccountId: '33333333-3333-3333-3333-333333333333',
    expenseAccountId: '44444444-4444-4444-4444-444444444444',
    lines: [
      {
        lineNumber: 1,
        description: 'Materiale electrice',
        quantity: 2,
        unitPrice: 150,
        amount: 300,
        expenseAccountId: '44444444-4444-4444-4444-444444444444',
      },
    ],
  };
}

describe('AP invoice routes resilience', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('does not return generic 500 and avoids null-repository crash signature', async () => {
    const app = createAppWithNullApRepository();
    const token = createAuthToken();

    const response = await request(app)
      .post(`/api/v1/financial-accounting/${ORGANIZATION_ID}/ap-invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send(buildValidPayload());

    expect(response.status).not.toBe(500);
    expect(response.status).not.toBe(404);
    expect([201, 400, 401, 403]).toContain(response.status);

    if (typeof response.body?.message === 'string') {
      expect(response.body.message).not.toMatch(/cannot read properties of null/i);
      expect(response.body.message).not.toMatch(/null.*repo/i);
      expect(response.body.message).not.toMatch(/apInvoiceRepository.*null/i);
    }
  });
});
