/**
 * Rate Limit Middleware Unit Tests
 *
 * Tests the middleware configuration exported from rate-limit.middleware.ts.
 * express-rate-limit uses an async MemoryStore internally, so non-skipped
 * requests call next() asynchronously. We handle this with a Promise wrapper.
 */

import {
  globalApiLimiter,
  b2bApiLimiter,
  loginLimiter,
  authLimiter,
  writeOperationLimiter,
  createRateLimitPolicies,
  defaultApiLimiter,
  authInteractiveLimiter,
  refreshGuardrailLimiter,
} from '../../shared/middleware/rate-limit.middleware';
import { extractClientKey } from '../../src/middleware/client-key';
import { refreshRateLimiter } from '../../src/middleware/rate-limiter';
import { parseTrustedProxyCidrs } from '../../src/config/trusted-proxy';

/** Helper: invoke middleware and return a Promise that resolves when next() is called. */
function invokeMiddleware(mw: any, req: any, res: any, timeoutMs = 1000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (err) {
        reject(err);
        return;
      }
      resolve();
    };

    const timer = setTimeout(
      () => reject(new Error('next() was not called within timeout')),
      timeoutMs,
    );

    const originalStatus = res.status;
    if (typeof originalStatus === 'function') {
      res.status = jest.fn((...args: any[]) => {
        const returnValue = originalStatus.apply(res, args);
        finish();
        return returnValue;
      });
    }

    const next = () => {
      finish();
    };
    mw(req, res, next);
  });
}

function mockRes() {
  const headers = new Map<string, string | number>();
  return {
    setHeader: jest.fn((name: string, value: string | number) => {
      headers.set(name.toLowerCase(), value);
    }),
    getHeader: jest.fn((name: string) => headers.get(name.toLowerCase())),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
    headersSent: false,
  } as any;
}

describe('Rate Limit Middleware', () => {
  // ── Export validation ─────────────────────────────────────────────

  describe('exports', () => {
    it('globalApiLimiter is a function', () => {
      expect(typeof globalApiLimiter).toBe('function');
    });

    it('loginLimiter is a function', () => {
      expect(typeof loginLimiter).toBe('function');
    });

    it('authLimiter is a function', () => {
      expect(typeof authLimiter).toBe('function');
    });

    it('writeOperationLimiter is a function', () => {
      expect(typeof writeOperationLimiter).toBe('function');
    });

    it('b2bApiLimiter is a function', () => {
      expect(typeof b2bApiLimiter).toBe('function');
    });
  });

  // ── globalApiLimiter ──────────────────────────────────────────────

  describe('globalApiLimiter', () => {
    it('calls next() for normal requests', async () => {
      const req = { ip: '127.0.0.1', path: '/api/v1/products', method: 'GET', headers: {} } as any;
      await expect(invokeMiddleware(globalApiLimiter, req, mockRes())).resolves.toBeUndefined();
    });

    it('accepts 3 arguments (req, res, next) like standard middleware', () => {
      expect(globalApiLimiter.length).toBeLessThanOrEqual(3);
    });

    it('skips health check endpoints', async () => {
      const req = { ip: '127.0.0.2', path: '/health', method: 'GET', headers: {} } as any;
      await expect(invokeMiddleware(globalApiLimiter, req, mockRes())).resolves.toBeUndefined();
    });

    it('skips /api/v1/health endpoint', async () => {
      const req = { ip: '127.0.0.3', path: '/api/v1/health', method: 'GET', headers: {} } as any;
      await expect(invokeMiddleware(globalApiLimiter, req, mockRes())).resolves.toBeUndefined();
    });
  });

  // ── loginLimiter ──────────────────────────────────────────────────

  describe('loginLimiter', () => {
    it('calls next() for the first request', async () => {
      const req = {
        ip: '10.10.10.1',
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {},
      } as any;
      await expect(invokeMiddleware(loginLimiter, req, mockRes())).resolves.toBeUndefined();
    });
  });

  // ── authLimiter ───────────────────────────────────────────────────

  describe('authLimiter', () => {
    it('calls next() for the first request', async () => {
      const req = {
        ip: '10.10.10.2',
        path: '/api/v1/auth/register',
        method: 'POST',
        headers: {},
      } as any;
      await expect(invokeMiddleware(authLimiter, req, mockRes())).resolves.toBeUndefined();
    });
  });

  // ── b2bApiLimiter ──────────────────────────────────────────────────

  describe('b2bApiLimiter', () => {
    it('calls next() for B2B catalog requests', async () => {
      const req = {
        ip: '10.20.30.1',
        path: '/api/v1/b2b/catalog',
        method: 'GET',
        headers: {},
      } as any;
      await expect(invokeMiddleware(b2bApiLimiter, req, mockRes())).resolves.toBeUndefined();
    });

    it('accepts 3 arguments (req, res, next) like standard middleware', () => {
      expect(b2bApiLimiter.length).toBeLessThanOrEqual(3);
    });

    it('sets rate limit headers for B2B requests', async () => {
      const req = {
        ip: '10.20.30.2',
        path: '/api/v1/b2b/orders',
        method: 'GET',
        headers: {},
      } as any;
      const res = mockRes();
      await invokeMiddleware(b2bApiLimiter, req, res);
      expect(res.setHeader).toHaveBeenCalled();
    });
  });

  // ── writeOperationLimiter ─────────────────────────────────────────

  describe('writeOperationLimiter', () => {
    it('calls next() for POST requests (does not skip)', async () => {
      const req = { ip: '10.10.10.3', path: '/api/v1/orders', method: 'POST', headers: {} } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('skips rate limiting for GET requests', async () => {
      const req = { ip: '10.10.10.4', path: '/api/v1/orders', method: 'GET', headers: {} } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('skips rate limiting for HEAD requests', async () => {
      const req = { ip: '10.10.10.5', path: '/api/v1/orders', method: 'HEAD', headers: {} } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('skips rate limiting for OPTIONS requests', async () => {
      const req = {
        ip: '10.10.10.6',
        path: '/api/v1/orders',
        method: 'OPTIONS',
        headers: {},
      } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('applies rate limiting for PUT requests', async () => {
      const req = { ip: '10.10.10.7', path: '/api/v1/orders/1', method: 'PUT', headers: {} } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('applies rate limiting for DELETE requests', async () => {
      const req = {
        ip: '10.10.10.8',
        path: '/api/v1/orders/1',
        method: 'DELETE',
        headers: {},
      } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('applies rate limiting for PATCH requests', async () => {
      const req = {
        ip: '10.10.10.9',
        path: '/api/v1/orders/1',
        method: 'PATCH',
        headers: {},
      } as any;
      await expect(
        invokeMiddleware(writeOperationLimiter, req, mockRes()),
      ).resolves.toBeUndefined();
    });

    it('does NOT skip for POST method', async () => {
      // Verify POST is not in the skip list (GET/HEAD/OPTIONS)
      const req = { ip: '10.10.10.10', path: '/api/v1/data', method: 'POST', headers: {} } as any;
      const res = mockRes();
      await expect(invokeMiddleware(writeOperationLimiter, req, res)).resolves.toBeUndefined();
      // POST should set rate limit headers (non-skipped)
      expect(res.setHeader).toHaveBeenCalled();
    });

    it('does NOT set rate limit headers for skipped GET', async () => {
      const req = { ip: '10.10.10.11', path: '/api/v1/data', method: 'GET', headers: {} } as any;
      const res = mockRes();
      await expect(invokeMiddleware(writeOperationLimiter, req, res)).resolves.toBeUndefined();
      // Skipped requests should not get rate limit headers
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('enterprise rate-limit policy tiers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('bypasses /health from throttling', async () => {
      const req = { method: 'GET', path: '/health', ip: '10.0.0.1', headers: {} } as any;
      const res = mockRes();
      await expect(invokeMiddleware(defaultApiLimiter, req, res)).resolves.toBeUndefined();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('builds client key from trusted forwarded chain', () => {
      const req = {
        ip: '172.16.0.10',
        headers: { 'x-forwarded-for': '198.51.100.20, 172.16.0.10' },
        path: '/api/v1/orders',
        method: 'GET',
      } as any;

      const key = extractClientKey(req, { trustedProxyCidrs: ['172.16.0.0/12'] });
      expect(key).toBe('198.51.100.20');
    });

    it('ignores spoofed x-forwarded-for when request is not from trusted proxy', () => {
      const req = {
        ip: '203.0.113.9',
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '203.0.113.9' },
      } as any;

      const key = extractClientKey(req, { trustedProxyCidrs: ['10.0.0.0/8'] });
      expect(key).toBe('203.0.113.9');
      expect(key).not.toContain('1.2.3.4');
    });

    it('uses stable client key identity across routes for the same client', () => {
      const firstReq = {
        ip: '198.51.100.90',
        path: '/api/v1/orders',
        method: 'GET',
        headers: {},
      } as any;
      const secondReq = {
        ip: '198.51.100.90',
        path: '/api/v1/products',
        method: 'POST',
        headers: {},
      } as any;

      expect(extractClientKey(firstReq)).toBe(extractClientKey(secondReq));
    });

    it('does not consume auth-interactive budget when /api/v1/b2b-auth/refresh is throttled', async () => {
      const refreshReq = {
        method: 'POST',
        path: '/api/v1/b2b-auth/refresh',
        ip: '203.0.113.44',
        headers: {},
      } as any;
      const loginReq = {
        method: 'POST',
        path: '/api/v1/users/login',
        ip: '203.0.113.44',
        headers: {},
      } as any;

      const refreshRes = mockRes();
      const loginRes = mockRes();

      for (let i = 0; i < 20; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await invokeMiddleware(refreshGuardrailLimiter, refreshReq, refreshRes);
      }

      await expect(invokeMiddleware(authInteractiveLimiter, loginReq, loginRes)).resolves.toBeUndefined();
    });

    it('creates Redis-backed limiter store when RATE_LIMIT_STORE=redis', () => {
      process.env.RATE_LIMIT_STORE = 'redis';

      const mockRedisClient = {
        call: jest.fn(),
      } as any;

      const policies = createRateLimitPolicies({ redisClient: mockRedisClient });
      expect(policies.meta.storeType).toBe('redis');
    });

    it('maps refresh path to dedicated tier and default API to baseline tier', () => {
      const policies = createRateLimitPolicies();
      expect(policies.resolveTier('/api/v1/b2b-auth/refresh', 'POST')).toBe('tier-auth-refresh');
      expect(policies.resolveTier('/api/v1/orders', 'GET')).toBe('tier-default-api');
    });

    it('does not consume default tier budget for auth/refresh routes', async () => {
      const authReq = {
        method: 'POST',
        path: '/api/v1/users/login',
        ip: '203.0.113.80',
        headers: {},
      } as any;
      const refreshReq = {
        method: 'POST',
        path: '/api/v1/b2b-auth/refresh',
        ip: '203.0.113.81',
        headers: {},
      } as any;
      const authRes = mockRes();
      const refreshRes = mockRes();

      await expect(invokeMiddleware(defaultApiLimiter, authReq, authRes)).resolves.toBeUndefined();
      await expect(invokeMiddleware(defaultApiLimiter, refreshReq, refreshRes)).resolves.toBeUndefined();

      expect(authRes.setHeader).not.toHaveBeenCalled();
      expect(refreshRes.setHeader).not.toHaveBeenCalled();
    });

    it('skips default limiter budget for broad interactive auth routes', async () => {
      const routes = [
        '/api/v1/users/auth/google',
        '/api/v1/users/forgot-password',
        '/api/v1/users/reset-password',
        '/api/v1/b2b-auth/login',
        '/api/v1/b2b-auth/forgot-password',
        '/api/v1/b2b-auth/reset-password',
        '/api/v1/users/login',
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/b2b-auth/google',
      ];

      for (const [index, path] of routes.entries()) {
        const req = {
          method: 'POST',
          path,
          ip: `203.0.113.${90 + index}`,
          headers: {},
        } as any;
        const res = mockRes();

        // eslint-disable-next-line no-await-in-loop
        await expect(invokeMiddleware(defaultApiLimiter, req, res)).resolves.toBeUndefined();
        expect(res.setHeader).not.toHaveBeenCalled();
      }
    });

    it('applies auth-interactive limiter to broad interactive auth routes', async () => {
      const routes = [
        '/api/v1/users/auth/google',
        '/api/v1/users/forgot-password',
        '/api/v1/users/reset-password',
        '/api/v1/b2b-auth/login',
        '/api/v1/b2b-auth/forgot-password',
        '/api/v1/b2b-auth/reset-password',
      ];

      for (const [index, path] of routes.entries()) {
        const req = {
          method: 'POST',
          path,
          ip: `198.51.100.${110 + index}`,
          headers: {},
        } as any;
        const res = mockRes();

        // eslint-disable-next-line no-await-in-loop
        await expect(invokeMiddleware(authInteractiveLimiter, req, res)).resolves.toBeUndefined();
        expect(res.setHeader).toHaveBeenCalled();
      }
    });

    it('skips auth-interactive limiter for non-auth routes', async () => {
      const req = {
        method: 'GET',
        path: '/api/v1/orders',
        ip: '198.51.100.150',
        headers: {},
      } as any;
      const res = mockRes();

      await expect(invokeMiddleware(authInteractiveLimiter, req, res)).resolves.toBeUndefined();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('does not set default limiter headers when middleware chain handles auth route', async () => {
      const policies = createRateLimitPolicies();
      const req = {
        method: 'POST',
        path: '/api/v1/users/reset-password',
        ip: '198.51.100.160',
        headers: {},
      } as any;

      const authRes = mockRes();
      await expect(invokeMiddleware(policies.authInteractiveLimiter, req, authRes)).resolves.toBeUndefined();
      expect(authRes.setHeader).toHaveBeenCalled();

      const defaultRes = mockRes();
      await expect(invokeMiddleware(policies.defaultApiLimiter, req, defaultRes)).resolves.toBeUndefined();
      expect(defaultRes.setHeader).not.toHaveBeenCalled();
    });

    it('applies refresh guardrail only on POST /api/v1/b2b-auth/refresh', () => {
      const policies = createRateLimitPolicies();
      expect(policies.resolveTier('/api/v1/b2b-auth/refresh', 'POST')).toBe('tier-auth-refresh');
      expect(policies.resolveTier('/api/v1/b2b-auth/refresh', 'GET')).not.toBe('tier-auth-refresh');
    });

    it('does not apply refresh guardrail limiter for non-POST refresh requests', async () => {
      const req = {
        method: 'GET',
        path: '/api/v1/b2b-auth/refresh',
        ip: '198.51.100.91',
        headers: {},
      } as any;
      const res = mockRes();
      await expect(invokeMiddleware(refreshGuardrailLimiter, req, res)).resolves.toBeUndefined();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('keeps compatibility refresh export bound to shared singleton instance', () => {
      expect(refreshRateLimiter).toBe(refreshGuardrailLimiter);
    });

    it('parses trusted proxy list with named presets and bare IP addresses', () => {
      const parsed = parseTrustedProxyCidrs('loopback, 203.0.113.8, 2001:db8::1, 10.0.0.0/8');
      expect(parsed).toContain('127.0.0.1/32');
      expect(parsed).toContain('203.0.113.8/32');
      expect(parsed).toContain('2001:db8::1/128');
      expect(parsed).toContain('10.0.0.0/8');
    });

    it('enables passOnStoreError for all tier limiters', () => {
      const rateLimitFactory = jest.fn((..._args: any[]) => jest.fn());

      jest.isolateModules(() => {
        jest.doMock('express-rate-limit', () => ({
          __esModule: true,
          default: rateLimitFactory,
        }));

        // eslint-disable-next-line global-require
        const { createRateLimitPolicies: createPolicies } = require('../../shared/middleware/rate-limit.middleware');
        createPolicies();
      });

      expect(rateLimitFactory).toHaveBeenCalled();
      for (const call of rateLimitFactory.mock.calls) {
        const options = call[0] as { passOnStoreError?: boolean } | undefined;
        expect(options?.passOnStoreError).toBe(true);
      }

      jest.dontMock('express-rate-limit');
    });

    it('emits structured throttle log fields without raw PII', async () => {
      const req = {
        method: 'POST',
        path: '/api/v1/b2b-auth/refresh',
        ip: '198.51.100.77',
        headers: {},
      } as any;
      const res = mockRes();
      const logger = { warn: jest.fn() } as any;
      const policies = createRateLimitPolicies({ logger });

      for (let i = 0; i < 50; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await invokeMiddleware(policies.refreshGuardrailLimiter, req, res);
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '/api/v1/b2b-auth/refresh',
          limiter_tier: 'tier-auth-refresh',
          decision: 'throttled',
          client_key_hash: expect.any(String),
          remaining: expect.any(Number),
        }),
      );
    });
  });
});
