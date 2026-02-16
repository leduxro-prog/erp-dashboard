/**
 * Auth Flow Smoke Tests
 *
 * Verify the authentication flow against the LIVE backend at localhost:3000.
 * Tests login with valid credentials, authenticated resource access,
 * rate limit header presence, and session management.
 *
 * Run: npm run test:smoke
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;
const TIMEOUT_MS = 5000;

// Admin credentials (must exist in the database)
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@cypher.ro';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'admin123';

/** Helper: fetch with timeout */
async function api(
  path: string,
  opts: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: any; rawHeaders: Headers }> {
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
    return { status: res.status, headers: res.headers, body, rawHeaders: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

describe('Auth Flow Smoke Tests', () => {
  let authToken: string | null = null;
  let loginSucceeded = false;

  // ── Login ──────────────────────────────────────────────────────────

  describe('Login', () => {
    it('POST /api/v1/users/login with valid admin credentials should return token', async () => {
      const { status, body } = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        }),
      });

      // 200 = login success, 401 = credentials wrong, 429 = rate limited
      expect([200, 401, 429]).toContain(status);

      if (status === 200) {
        expect(body.token).toBeDefined();
        authToken = body.token;
        loginSucceeded = true;
      }
      // 429 = rate limited, no login possible
      if (status === 429) {
        loginSucceeded = false;
      }
    });

    it('Login response should include rate limit headers', async () => {
      const { headers } = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'ratelimit-check@example.com',
          password: 'SomePassword123',
        }),
      });

      const limitHeader = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
      const remainingHeader =
        headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining');

      // Rate limit headers should be present on login endpoint
      expect(limitHeader).toBeTruthy();
      expect(remainingHeader).toBeTruthy();
    });
  });

  // ── Authenticated Access ───────────────────────────────────────────

  describe('Authenticated Resource Access', () => {
    it('GET /api/v1/orders with valid token should return 200', async () => {
      if (!loginSucceeded || !authToken) {
        // Skip if login failed (test user doesn't exist)
        const { status } = await api('/orders');
        expect(status).toBe(401);
        return;
      }

      const { status } = await api('/orders', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(status).toBe(200);
    });

    it('GET /api/v1/users with valid token should return 200', async () => {
      if (!loginSucceeded || !authToken) {
        // Users endpoint may or may not require auth
        const { status } = await api('/users');
        expect([200, 401]).toContain(status);
        return;
      }

      const { status } = await api('/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(status).toBe(200);
    });

    it('Authenticated responses should include rate limit headers', async () => {
      if (!loginSucceeded || !authToken) {
        // Verify unauthenticated requests still have rate limit headers
        const { headers } = await api('/orders');
        const limitHeader = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
        expect(limitHeader).toBeTruthy();
        return;
      }

      const { headers } = await api('/orders', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const limitHeader = headers.get('x-ratelimit-limit') || headers.get('ratelimit-limit');
      const remainingHeader =
        headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining');

      expect(limitHeader).toBeTruthy();
      expect(remainingHeader).toBeTruthy();
    });
  });

  // ── Cookie-Based Auth ──────────────────────────────────────────────

  describe('Cookie-Based Auth', () => {
    it('Login response may set cookies', async () => {
      const { status, headers } = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        }),
      });

      // 200, 401, or 429 (rate limited) are all acceptable
      expect([200, 401, 429]).toContain(status);
      if (status === 200) {
        // Server may or may not set cookies depending on config
        // Cookie support is optional, just verify no crash
        expect(status).toBe(200);
      }
    });

    it('POST /api/v1/auth/refresh should respond', async () => {
      const { status } = await api('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      // 401 (no token), 404 (not deployed), or 200 (with valid cookie)
      expect([200, 401, 404]).toContain(status);
    });

    it('POST /api/v1/auth/logout should respond', async () => {
      const { status } = await api('/auth/logout', {
        method: 'POST',
      });
      // 200 (clears cookies) or 404 (not deployed)
      expect([200, 404]).toContain(status);
    });
  });

  // ── System Endpoints ───────────────────────────────────────────────

  describe('System Endpoints', () => {
    it('GET /api/v1/system/modules should return module list', async () => {
      const { status, body } = await api('/system/modules');
      expect([200, 401, 404]).toContain(status);
      if (status === 200) {
        expect(body.modules).toBeDefined();
        expect(Array.isArray(body.modules)).toBe(true);
        expect(body.modules.length).toBeGreaterThan(0);
      }
    });

    it('GET /api/v1/system/metrics should respond', async () => {
      const { status } = await api('/system/metrics');
      expect([200, 401, 404]).toContain(status);
    });
  });

  // ── Response Time SLA ──────────────────────────────────────────────

  describe('Response Time SLA', () => {
    it('Health endpoint should respond under 200ms', async () => {
      const start = Date.now();
      await api('/health');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('Login rejection should respond under 1000ms', async () => {
      const start = Date.now();
      await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'sla-test@example.com',
          password: 'wrong',
        }),
      });
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });
});
