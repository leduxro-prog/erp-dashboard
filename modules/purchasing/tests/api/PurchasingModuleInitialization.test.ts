import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { PurchasingModule } from '../../src/purchasing-module';

describe('Purchasing module initialization', () => {
  it('initializes router and exposes requisition endpoint without 501', async () => {
    const purchasingModule = new PurchasingModule();

    await purchasingModule.initialize({
      dataSource: {
        isInitialized: false,
      },
    } as any);

    const app = express();
    app.use(express.json());
    app.use('/api/v1/purchasing', purchasingModule.getRouter());

    const response = await request(app).get('/api/v1/purchasing/requisitions');

    expect(response.status).not.toBe(501);
    expect([200, 400, 401, 403]).toContain(response.status);
  });
});
