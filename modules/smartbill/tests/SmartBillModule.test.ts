import { describe, expect, it, jest } from '@jest/globals';

import SmartBillModule from '../src';

describe('SmartBillModule', () => {
  it('initializes in degraded mode when redis client is missing', async () => {
    const module = new SmartBillModule();

    await expect(
      module.initialize({
        dataSource: {
          getRepository: jest.fn().mockReturnValue({}),
        },
        eventBus: { client: null, publish: jest.fn() },
        cacheManager: {},
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        },
        config: {},
        apiClientFactory: {},
        featureFlags: {
          isEnabled: jest.fn().mockReturnValue(false),
          getAll: jest.fn().mockReturnValue({}),
          set: jest.fn(),
        },
      } as any),
    ).resolves.toBeUndefined();
  });
});
