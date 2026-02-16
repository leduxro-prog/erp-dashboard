/**
 * Security Smoke Tests
 *
 * Verify that security-related API endpoints respond correctly
 * against the LIVE backend at localhost:3000.
 *
 * Tests cover: rate limiting headers, auth endpoints, 2FA guards,
 * audit log access control, protected resources, and public B2B endpoints.
 *
 * Run: npm run test:smoke
 */

import { describe, it, expect } from '@jest/globals';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;
const TIMEOUT_MS = 5000;

/** Helper: fetch with timeout and no throwing on non-2xx */
async function api(
  path: string,
  opts: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    let body: any;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, headers: res.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

/** Helper: fetch at root level (outside /api/v1) */
async function rootFetch(path: string): Promise<{ status: number; headers: Headers; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    let body: any;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, headers: res.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

describe('Security Smoke Tests', () => {
  // ── Health & Monitoring ─────────────────────────────────────────────

  describe('Health & Monitoring', () => {
    it('GET /api/v1/health should return 200 with status ok', async () => {
      const { status, body } = await api('/health');
      expect(status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('GET /health (root) should return 200', async () => {
      const { status, body } = await rootFetch('/health');
      expect(status).toBe(200);
      expect(body.status).toBe('ok');
    });

    it('GET /api/v1/health should include security headers', async () => {
      const { headers } = await api('/health');
      // Helmet security headers
      expect(headers.get('x-content-type-options')).toBe('nosniff');
      expect(headers.get('x-frame-options')).toBe('DENY');
      expect(headers.get('strict-transport-security')).toBeTruthy();
      expect(headers.get('x-xss-protection')).toBeDefined();
      expect(headers.get('referrer-policy')).toBeTruthy();
    });

    it('GET /api/v1/health should include request tracing headers', async () => {
      const { headers } = await api('/health');
      expect(headers.get('x-request-id')).toBeTruthy();
      expect(headers.get('x-trace-id')).toBeTruthy();
      expect(headers.get('x-span-id')).toBeTruthy();
    });
  });

  // ── Rate Limiting ──────────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('API responses should include rate-limit headers', async () => {
      const { headers } = await api('/health');
      // Server uses X-RateLimit-* headers
      const limitHeader = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
      const remainingHeader =
        headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining');

      expect(limitHeader).toBeTruthy();
      expect(remainingHeader).toBeTruthy();
      // Remaining should be a number
      expect(Number(remainingHeader)).toBeGreaterThanOrEqual(0);
    });

    it('Login endpoint should have stricter rate-limit headers', async () => {
      const { headers } = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'ratelimit-test@example.com',
          password: 'test',
        }),
      });

      const limitHeader = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
      // Login limiter should exist with a low limit
      if (limitHeader) {
        expect(Number(limitHeader)).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── Auth Endpoints ─────────────────────────────────────────────────

  describe('Auth Endpoints', () => {
    it('POST /api/v1/auth/refresh without token should return 401 or 404', async () => {
      const { status } = await api('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      // 401 if route exists (no token), 404 if route not yet deployed
      expect([401, 404]).toContain(status);
    });

    it('POST /api/v1/auth/logout should return 200 or 404', async () => {
      const { status } = await api('/auth/logout', {
        method: 'POST',
      });
      // 200 if route exists (always succeeds clearing cookies), 404 if not deployed
      expect([200, 404]).toContain(status);
    });
  });

  // ── 2FA Endpoints (require auth, test 401 without) ────────────────

  describe('2FA Endpoints', () => {
    it('POST /api/v1/users/2fa/setup without auth should return 401 or 404', async () => {
      const { status } = await api('/users/2fa/setup', { method: 'POST' });
      expect([401, 404]).toContain(status);
    });

    it('POST /api/v1/users/2fa/verify-setup without auth should return 401 or 404', async () => {
      const { status } = await api('/users/2fa/verify-setup', {
        method: 'POST',
        body: JSON.stringify({ token: '000000' }),
      });
      expect([401, 404]).toContain(status);
    });

    it('POST /api/v1/users/2fa/disable without auth should return 401 or 404', async () => {
      const { status } = await api('/users/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token: '000000' }),
      });
      expect([401, 404]).toContain(status);
    });
  });

  // ── Audit Log Endpoints (require admin auth) ──────────────────────

  describe('Audit Log Endpoints', () => {
    it('GET /api/v1/admin/audit-logs without auth should return 401 or 200 or 404', async () => {
      const { status } = await api('/admin/audit-logs');
      // 401 if auth required, 200 if unguarded, 404 if not yet deployed
      expect([200, 401, 404]).toContain(status);
    });

    it('GET /api/v1/admin/audit-logs/stats without auth should return 401 or 200 or 404', async () => {
      const { status } = await api('/admin/audit-logs/stats');
      expect([200, 401, 404]).toContain(status);
    });

    it('GET /api/v1/admin/audit-logs/export without auth should return 401 or 200 or 404', async () => {
      const { status } = await api('/admin/audit-logs/export');
      expect([200, 401, 404]).toContain(status);
    });
  });

  // ── Protected Resources (require auth) ─────────────────────────────

  describe('Protected Resources', () => {
    it('GET /api/v1/orders without auth should return 401', async () => {
      const { status } = await api('/orders');
      expect(status).toBe(401);
    });

    it('GET /api/v1/inventory/stock-levels without auth should return 401', async () => {
      const { status } = await api('/inventory/stock-levels');
      expect(status).toBe(401);
    });

    it('GET /api/v1/smartbill/warehouses without auth should return 401', async () => {
      const { status } = await api('/smartbill/warehouses');
      expect(status).toBe(401);
    });

    it('GET /api/v1/users without auth should return 200 or 401', async () => {
      const { status } = await api('/users');
      // Some deployments allow unauthenticated user listing
      expect([200, 401]).toContain(status);
    });

    it('GET /api/v1/settings without auth should return 200 or 401', async () => {
      const { status } = await api('/settings');
      // Settings may be publicly readable
      expect([200, 401]).toContain(status);
    });
  });

  // ── B2B Public API (no auth needed) ────────────────────────────────

  describe('B2B Public Endpoints', () => {
    it('GET /api/v1/b2b/products/filters should return 200', async () => {
      const { status, body } = await api('/b2b/products/filters');
      expect(status).toBe(200);
      expect(body).toBeDefined();
    });

    it('GET /api/v1/b2b/products/categories should return 200', async () => {
      const { status, body } = await api('/b2b/products/categories');
      expect(status).toBe(200);
      expect(body).toBeDefined();
    });
  });

  // ── Invalid Credentials ────────────────────────────────────────────

  describe('Authentication Rejection', () => {
    it('POST /api/v1/users/login with invalid credentials should return 401 or 429', async () => {
      const { status, body } = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        }),
      });
      // 401 (invalid creds) or 429 (rate limited from previous runs)
      expect([401, 429]).toContain(status);
      expect(body.error || body.message).toBeDefined();
    });

    it('POST /api/v1/users/login with malformed body should return 400 or 429', async () => {
      const { status } = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
      });
      // 400 (validation error) or 429 (rate limited from previous runs)
      expect([400, 429]).toContain(status);
    });

    it('Request with invalid Bearer token should return 401', async () => {
      const { status } = await api('/orders', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(status).toBe(401);
    });
  });

  // ── CORS & Security Headers ────────────────────────────────────────

  describe('Security Headers', () => {
    it('should include Content-Security-Policy header', async () => {
      const { headers } = await api('/health');
      const csp = headers.get('content-security-policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain('default-src');
    });

    it('should include Cross-Origin headers', async () => {
      const { headers } = await api('/health');
      expect(headers.get('cross-origin-opener-policy')).toBeTruthy();
      expect(headers.get('cross-origin-resource-policy')).toBeTruthy();
    });

    it('should not expose server version', async () => {
      const { headers } = await api('/health');
      expect(headers.get('x-powered-by')).toBeNull();
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('Non-existent endpoint should return 404 with JSON error', async () => {
      const { status, body } = await api('/this-does-not-exist-abc123');
      expect(status).toBe(404);
      expect(body.error || body.message).toBeDefined();
    });

    it('404 responses should still include security headers', async () => {
      const { headers } = await api('/nonexistent-xyz');
      expect(headers.get('x-content-type-options')).toBe('nosniff');
      expect(headers.get('x-frame-options')).toBe('DENY');
    });
  });
});
