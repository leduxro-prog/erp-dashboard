import request from 'supertest';
import { describe, expect, it, jest } from '@jest/globals';

import SearchIndexModule from '../src/search-index-module';

describe('SearchIndexModule', () => {
  it('initializes and exposes admin health route without redis client', async () => {
    const module = new SearchIndexModule();

    await module.initialize({
      dataSource: {} as any,
      eventBus: { client: null } as any,
      cacheManager: {} as any,
      logger: {} as any,
      config: {},
      apiClientFactory: {} as any,
      featureFlags: {
        isEnabled: jest.fn().mockReturnValue(false),
        getAll: jest.fn().mockReturnValue({}),
        set: jest.fn(),
      } as any,
    });

    await module.start();

    const app = require('express')();
    app.use('/api/v1/search-index', module.getRouter());

    const response = await request(app).get('/api/v1/search-index/admin/image-search/health');

    expect(response.status).toBe(401);
    await module.stop();
  });

  it('does not close shared redis client on stop', async () => {
    const quit = jest.fn();
    const disconnect = jest.fn();
    const module = new SearchIndexModule();

    await module.initialize({
      dataSource: {} as any,
      eventBus: { client: { quit, disconnect } } as any,
      cacheManager: {} as any,
      logger: {} as any,
      config: {},
      apiClientFactory: {} as any,
      featureFlags: {
        isEnabled: jest.fn().mockReturnValue(false),
        getAll: jest.fn().mockReturnValue({}),
        set: jest.fn(),
      } as any,
    });

    await module.start();
    await module.stop();

    expect(quit).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
});
