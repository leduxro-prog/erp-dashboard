import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createWebsiteSyncRouter } from './website-sync.routes';

function buildApp(env: Record<string, string | undefined> = { WEBSITE_SYNC_TOKEN: 'sync-token' }) {
  const app = express();

  app.use(express.json());
  app.use('/api/v1', createWebsiteSyncRouter({ isInitialized: true } as any, env));

  return app;
}

describe('createWebsiteSyncRouter', () => {
  it('requires a token for status endpoints', async () => {
    const response = await request(buildApp()).get('/api/v1/website-sync/status');

    expect(response.status).toBe(401);
  });

  it('rejects invalid tokens', async () => {
    const response = await request(buildApp())
      .get('/api/v1/website-sync/status')
      .set('Authorization', 'Bearer wrong-token');

    expect(response.status).toBe(403);
  });

  it('returns status when the configured token is valid', async () => {
    const response = await request(buildApp())
      .get('/api/v1/website-sync/status')
      .set('Authorization', 'Bearer sync-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'website-sync',
      database: { initialized: true },
    });
  });

  it('does not expose mutation endpoints without implemented handlers', async () => {
    const response = await request(buildApp())
      .post('/api/v1/website-sync/sync')
      .set('x-website-sync-token', 'sync-token')
      .send({ scope: 'products' });

    expect(response.status).toBe(501);
  });

  it('fails closed when the sync token is not configured', async () => {
    const response = await request(buildApp({}))
      .post('/api/v1/website-sync/sync')
      .set('Authorization', 'Bearer sync-token')
      .send({ scope: 'products' });

    expect(response.status).toBe(401);
  });
});
