import { describe, expect, it, jest } from '@jest/globals';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('./logger', () => ({
  createModuleLogger: () => loggerMock,
}));

type MessageHandler = (channel: string, message: string) => void;

class MockRedis {
  static instances: MockRedis[] = [];

  private mode: 'normal' | 'subscribed' = 'normal';
  private handlers: Record<string, ((...args: any[]) => void)[]> = {};

  constructor(_config?: any) {
    MockRedis.instances.push(this);
  }

  on(event: string, handler: (...args: any[]) => void) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  async ping() {
    if (this.mode === 'subscribed') {
      throw new Error("ERR Can't execute 'info': only (P|S)SUBSCRIBE / (P|S)UNSUBSCRIBE / PING / QUIT / RESET are allowed in this context");
    }
    return 'PONG';
  }

  async subscribe(channel: string, cb?: (err: Error | null, count: number) => void) {
    this.mode = 'subscribed';
    if (cb) cb(null, 1);
    return 1;
  }

  async unsubscribe(_channel: string) {
    this.mode = 'normal';
    return 0;
  }

  async publish(_channel: string, _message: string) {
    return 1;
  }

  async quit() {
    return 'OK';
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: MockRedis,
}));

describe('EventBus', () => {
  it('uses a single connect flow for concurrent subscribe calls', async () => {
    MockRedis.instances.length = 0;

    const { getEventBus } = await import('./event-bus');
    const eventBus = getEventBus();

    await Promise.all([
      eventBus.subscribe('order.completed', () => undefined),
      eventBus.subscribe('order.cancelled', () => undefined),
    ]);

    expect(MockRedis.instances.length).toBe(2);
  });
});
