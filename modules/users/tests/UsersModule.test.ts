import { describe, expect, it, jest } from '@jest/globals';

import { UsersModule } from '../src/users-module';

describe('UsersModule health', () => {
  it('returns healthy when user table count query succeeds', async () => {
    const module = new UsersModule();

    const dataSource = {
      getRepository: jest.fn().mockReturnValue({}),
      query: jest.fn<any>().mockResolvedValue([{ total: '3' }]),
    };

    await module.initialize({
      dataSource,
      eventBus: { subscribe: jest.fn() },
      cacheManager: {},
      logger: {},
      config: {},
      apiClientFactory: {},
      featureFlags: {
        isEnabled: jest.fn().mockReturnValue(false),
        getAll: jest.fn().mockReturnValue({}),
        set: jest.fn(),
      },
    } as any);

    const health = await module.getHealth();

    expect(health.status).toBe('healthy');
    expect(dataSource.query).toHaveBeenCalledWith('SELECT COUNT(*)::int AS total FROM users');
    expect(String((health.details as any).database.message)).toContain('3 users total');
  });

  it('subscribes in start and unsubscribes in stop', async () => {
    const module = new UsersModule();

    const eventBus = {
      subscribe: jest.fn<any>().mockResolvedValue(undefined),
      unsubscribe: jest.fn<any>().mockResolvedValue(undefined),
    };

    await module.initialize({
      dataSource: {
        getRepository: jest.fn().mockReturnValue({}),
        query: jest.fn<any>().mockResolvedValue([{ total: '0' }]),
      },
      eventBus,
      cacheManager: {},
      logger: {},
      config: {},
      apiClientFactory: {},
      featureFlags: {
        isEnabled: jest.fn().mockReturnValue(false),
        getAll: jest.fn().mockReturnValue({}),
        set: jest.fn(),
      },
    } as any);

    expect(eventBus.subscribe).not.toHaveBeenCalled();

    await module.start();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'b2b.registration_approved',
      expect.any(Function),
    );

    await module.stop();
    expect(eventBus.unsubscribe).toHaveBeenCalledWith('b2b.registration_approved');
  });
});
