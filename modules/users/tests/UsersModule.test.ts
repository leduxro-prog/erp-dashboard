import { describe, expect, it, jest } from '@jest/globals';

import { UserService } from '../src/application/services/UserService';
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

  it('keeps backend Google auth compatibility available during module wiring', async () => {
    const module = new UsersModule();

    await module.initialize({
      dataSource: {
        getRepository: jest.fn().mockReturnValue({}),
        query: jest.fn<any>().mockResolvedValue([{ total: '0' }]),
      },
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

    expect(typeof UserService.prototype.findOrCreateGoogleUser).toBe('function');

    const stack = (module.getRouter() as any).stack ?? [];
    const hasGoogleRoute = stack.some(
      (layer: any) => layer.route?.path === '/auth/google' && layer.route?.methods?.post,
    );
    expect(hasGoogleRoute).toBe(true);
  });

  it('returns existing Google user when concurrent create hits duplicate email', async () => {
    const existingUser = {
      id: 7,
      email: 'ledux.ro@gmail.com',
      first_name: 'Existing',
      last_name: 'User',
      role: 'admin',
      is_active: true,
    };
    const duplicateEmailError = Object.assign(new Error('duplicate key value'), { code: '23505' });
    const repository = {
      findOne: jest
        .fn<any>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser),
      create: jest.fn<any>((data: any) => data),
      save: jest.fn<any>().mockRejectedValue(duplicateEmailError),
    };
    const service = new UserService({ getRepository: jest.fn().mockReturnValue(repository) } as any);

    const user = await service.findOrCreateGoogleUser({
      googleId: 'google-user-id',
      email: 'LEDUX.RO@GMAIL.COM',
      firstName: 'Google',
      lastName: 'User',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(user).toMatchObject({
      id: existingUser.id,
      email: existingUser.email,
      avatar_url: 'https://example.com/avatar.png',
      auth_provider: 'google',
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(2, {
      where: { email: 'ledux.ro@gmail.com' },
    });
  });
});
