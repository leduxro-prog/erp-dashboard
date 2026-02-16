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
} from '../../shared/middleware/rate-limit.middleware';

/** Helper: invoke middleware and return a Promise that resolves when next() is called. */
function invokeMiddleware(mw: any, req: any, res: any, timeoutMs = 1000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('next() was not called within timeout')),
      timeoutMs,
    );
    const next = () => {
      clearTimeout(timer);
      resolve();
    };
    mw(req, res, next);
  });
}

function mockRes() {
  return {
    setHeader: jest.fn(),
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
});
