import { Router } from 'express';
import { describe, expect, it, jest } from '@jest/globals';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../utils/logger', () => ({
  createModuleLogger: () => loggerMock,
}));

import { ModuleRegistry } from './module-registry';
import { ICypherModule } from './module.interface';

class TestModule implements ICypherModule {
  readonly name: string;
  readonly version = '1.0.0';
  readonly description = 'test module';
  readonly dependencies: string[] = [];
  readonly publishedEvents: string[] = [];
  readonly subscribedEvents: string[] = [];
  readonly router = Router();

  constructor(name: string, private readonly shouldInitialize = true) {
    this.name = name;
  }

  async initialize(): Promise<void> {
    if (!this.shouldInitialize) {
      throw new Error('init failed');
    }
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async getHealth(): Promise<any> {
    return { status: 'healthy', details: {}, lastChecked: new Date() };
  }
  getRouter(): Router {
    return this.router;
  }
  getMetrics(): any {
    return { requestCount: 0, errorCount: 0, avgResponseTime: 0 };
  }
}

describe('ModuleRegistry', () => {
  it('logs optional unloaded dependencies as info-level skip', async () => {
    jest.clearAllMocks();
    ModuleRegistry.resetInstance();
    const registry = ModuleRegistry.getInstance();

    const smartbillLike = new TestModule('smartbill');
    (smartbillLike as any).dependencies = ['orders'];

    registry.register(smartbillLike);

    await registry.initializeAll({
      dataSource: {},
      eventBus: {},
      cacheManager: {},
      logger: {},
      config: {},
      apiClientFactory: {},
      featureFlags: {
        isEnabled: () => true,
        getAll: () => ({}),
        set: async () => {},
      },
    } as any);

    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.stringContaining('depends on unloaded optional module "orders" - dependency skipped')
    );
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('depends on unloaded module "orders"')
    );
  });

  it('logs ai-assistant missing api key initialization failure as info-level skip', async () => {
    jest.clearAllMocks();
    ModuleRegistry.resetInstance();
    const registry = ModuleRegistry.getInstance();

    class FailingAiModule extends TestModule {
      constructor() {
        super('ai-assistant');
      }
      override async initialize(): Promise<void> {
        throw new Error('GEMINI_API_KEY is not defined');
      }
    }

    registry.register(new FailingAiModule());

    await registry.initializeAll({
      dataSource: {},
      eventBus: {},
      cacheManager: {},
      logger: {},
      config: {},
      apiClientFactory: {},
      featureFlags: {
        isEnabled: () => true,
        getAll: () => ({}),
        set: async () => {},
      },
    } as any);

    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.stringContaining('Optional module "ai-assistant" disabled: GEMINI_API_KEY is not defined')
    );
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Non-critical module "ai-assistant" failed to initialize')
    );
  });

  it('exposes only initialized/started modules for router mounting', async () => {
    ModuleRegistry.resetInstance();
    const registry = ModuleRegistry.getInstance();

    const started = new TestModule('started');
    const skipped = new TestModule('skipped', false);

    registry.register(started);
    registry.register(skipped);

    await registry.initializeAll({
      dataSource: {},
      eventBus: {},
      cacheManager: {},
      logger: {},
      config: {},
      apiClientFactory: {},
      featureFlags: {
        isEnabled: () => true,
        getAll: () => ({}),
        set: async () => {},
      },
    } as any);
    await registry.startAll();

    const startedModules = registry.getStartedModules();

    expect(startedModules.has('started')).toBe(true);
    expect(startedModules.has('skipped')).toBe(false);
  });
});
