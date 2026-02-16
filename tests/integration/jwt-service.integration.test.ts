/**
 * JWT Service Integration Tests
 *
 * Tests the full JWT token lifecycle: generate, verify, refresh, expiry.
 * No database required — exercises the real jsonwebtoken library against
 * the JwtService class with controlled env-var configuration.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { JwtService, TokenPayload } from '../../shared/services/JwtService';

// Silence logger
jest.mock('../../shared/utils/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('JwtService Integration', () => {
  // Store original env for restoration
  const originalEnv: Record<string, string | undefined> = {};

  const TEST_ACCESS_SECRET = 'inttest-access-secret-key-2026';
  const TEST_REFRESH_SECRET = 'inttest-refresh-secret-key-2026';

  const testPayload: TokenPayload = {
    id: 'inttest-user-001',
    email: 'jwt-inttest@example.com',
    role: 'admin',
  };

  function setEnv(vars: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(vars)) {
      if (!(key in originalEnv)) {
        originalEnv[key] = process.env[key];
      }
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  function restoreEnv(): void {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  beforeEach(() => {
    setEnv({
      JWT_SECRET: TEST_ACCESS_SECRET,
      JWT_REFRESH_SECRET: TEST_REFRESH_SECRET,
      JWT_ACCESS_TOKEN_EXPIRY: '15m',
      JWT_REFRESH_TOKEN_EXPIRY: '7d',
      JWT_EXPIRES_IN: undefined,
      JWT_REFRESH_EXPIRES_IN: undefined,
      NODE_ENV: 'test',
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  // ── Full Token Lifecycle ──────────────────────────────────────────────

  describe('Full token lifecycle', () => {
    it('should generate -> verify -> decode an access token end-to-end', () => {
      const service = new JwtService();
      const token = service.generateAccessToken(testPayload);

      // Verify with the service
      const decoded = service.verifyAccessToken(token);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);

      // Also verify directly with jsonwebtoken to confirm the secret
      const rawDecoded = jwt.verify(token, TEST_ACCESS_SECRET) as TokenPayload;
      expect(rawDecoded.id).toBe(testPayload.id);
    });

    it('should generate -> verify -> decode a refresh token end-to-end', () => {
      const service = new JwtService();
      const token = service.generateRefreshToken(testPayload);

      const decoded = service.verifyRefreshToken(token);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);

      const rawDecoded = jwt.verify(token, TEST_REFRESH_SECRET) as TokenPayload;
      expect(rawDecoded.id).toBe(testPayload.id);
    });

    it('should support a simulated refresh flow: access expired -> use refresh -> new access', () => {
      const service = new JwtService();

      // 1. Generate initial pair
      const refreshToken = service.generateRefreshToken(testPayload);

      // 2. Simulate expired access token (create one with 0s expiry)
      const expiredAccess = jwt.sign(testPayload, TEST_ACCESS_SECRET, { expiresIn: '0s' });

      // 3. Verify that the access token is indeed expired
      expect(() => service.verifyAccessToken(expiredAccess)).toThrow();

      // 4. Verify the refresh token is still valid
      const refreshPayload = service.verifyRefreshToken(refreshToken);
      expect(refreshPayload.id).toBe(testPayload.id);

      // 5. Issue new access token from refresh payload
      const newPayload: TokenPayload = {
        id: refreshPayload.id,
        email: refreshPayload.email,
        role: refreshPayload.role,
      };
      const newAccessToken = service.generateAccessToken(newPayload);

      // 6. New access token should be valid
      const newDecoded = service.verifyAccessToken(newAccessToken);
      expect(newDecoded.id).toBe(testPayload.id);
      expect(newDecoded.email).toBe(testPayload.email);
    });
  });

  // ── Token Expiry Detection ────────────────────────────────────────────

  describe('Token expiry detection', () => {
    it('should throw TokenExpiredError for an expired access token', () => {
      const service = new JwtService();
      const expiredToken = jwt.sign(testPayload, TEST_ACCESS_SECRET, { expiresIn: '0s' });

      try {
        service.verifyAccessToken(expiredToken);
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(jwt.TokenExpiredError);
      }
    });

    it('should throw TokenExpiredError for an expired refresh token', () => {
      const service = new JwtService();
      const expiredToken = jwt.sign(testPayload, TEST_REFRESH_SECRET, { expiresIn: '0s' });

      try {
        service.verifyRefreshToken(expiredToken);
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(jwt.TokenExpiredError);
      }
    });

    it('should have a longer expiry on refresh token than access token', () => {
      const service = new JwtService();
      const accessToken = service.generateAccessToken(testPayload);
      const refreshToken = service.generateRefreshToken(testPayload);

      const accessDecoded = jwt.decode(accessToken) as { exp: number };
      const refreshDecoded = jwt.decode(refreshToken) as { exp: number };

      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });

  // ── Secret Isolation ──────────────────────────────────────────────────

  describe('Different secrets for access vs refresh tokens', () => {
    it('should not allow verifying an access token as a refresh token', () => {
      const service = new JwtService();
      const accessToken = service.generateAccessToken(testPayload);

      expect(() => service.verifyRefreshToken(accessToken)).toThrow(jwt.JsonWebTokenError);
    });

    it('should not allow verifying a refresh token as an access token', () => {
      const service = new JwtService();
      const refreshToken = service.generateRefreshToken(testPayload);

      expect(() => service.verifyAccessToken(refreshToken)).toThrow(jwt.JsonWebTokenError);
    });

    it('should not verify a token signed with a completely wrong secret', () => {
      const service = new JwtService();
      const wrongToken = jwt.sign(testPayload, 'totally-wrong-secret', { expiresIn: '1h' });

      expect(() => service.verifyAccessToken(wrongToken)).toThrow();
      expect(() => service.verifyRefreshToken(wrongToken)).toThrow();
    });

    it('should not verify a tampered token', () => {
      const service = new JwtService();
      const token = service.generateAccessToken(testPayload);

      // Flip a character in the signature
      const parts = token.split('.');
      parts[2] = parts[2].slice(0, -3) + 'XXX';
      const tampered = parts.join('.');

      expect(() => service.verifyAccessToken(tampered)).toThrow();
    });
  });

  // ── Cookie Setting on Express Response Mock ───────────────────────────

  describe('Cookie management with Express response mock', () => {
    it('should set 3 cookies with correct names and options', () => {
      const service = new JwtService();
      const accessToken = service.generateAccessToken(testPayload);
      const refreshToken = service.generateRefreshToken(testPayload);

      const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
      const mockRes = {
        cookie: jest.fn((name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        }),
      } as any;

      service.setAuthCookies(mockRes, accessToken, refreshToken);

      expect(mockRes.cookie).toHaveBeenCalledTimes(3);

      // access_token
      const accessCookie = cookies.find((c) => c.name === 'access_token');
      expect(accessCookie).toBeDefined();
      expect(accessCookie!.value).toBe(accessToken);
      expect(accessCookie!.options.httpOnly).toBe(true);
      expect(accessCookie!.options.path).toBe('/');

      // refresh_token
      const refreshCookie = cookies.find((c) => c.name === 'refresh_token');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.value).toBe(refreshToken);
      expect(refreshCookie!.options.httpOnly).toBe(true);
      expect(refreshCookie!.options.path).toBe('/api/v1/auth/refresh');

      // auth_status
      const statusCookie = cookies.find((c) => c.name === 'auth_status');
      expect(statusCookie).toBeDefined();
      expect(statusCookie!.value).toBe('authenticated');
      expect(statusCookie!.options.httpOnly).toBe(false);
    });

    it('should clear all 3 cookies on clearAuthCookies', () => {
      const service = new JwtService();
      const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
      const mockRes = {
        clearCookie: jest.fn((name: string, options: Record<string, unknown>) => {
          cleared.push({ name, options });
        }),
      } as any;

      service.clearAuthCookies(mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledTimes(3);

      const names = cleared.map((c) => c.name);
      expect(names).toContain('access_token');
      expect(names).toContain('refresh_token');
      expect(names).toContain('auth_status');
    });

    it('should set secure flag in production mode', () => {
      setEnv({ NODE_ENV: 'production' });
      const service = new JwtService();

      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'a', 'r');

      for (const call of mockRes.cookie.mock.calls) {
        expect(call[2].secure).toBe(true);
      }
    });

    it('should NOT set secure flag in non-production mode', () => {
      setEnv({ NODE_ENV: 'development' });
      const service = new JwtService();

      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'a', 'r');

      for (const call of mockRes.cookie.mock.calls) {
        expect(call[2].secure).toBe(false);
      }
    });
  });

  // ── Environment Configuration ─────────────────────────────────────────

  describe('Env-var driven configuration', () => {
    it('should use custom access expiry from JWT_ACCESS_TOKEN_EXPIRY', () => {
      setEnv({ JWT_ACCESS_TOKEN_EXPIRY: '30m' });
      const service = new JwtService();

      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'a', 'r');

      const accessCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'access_token');
      expect(accessCall![2].maxAge).toBe(30 * 60 * 1000);
    });

    it('should use custom refresh expiry from JWT_REFRESH_TOKEN_EXPIRY', () => {
      setEnv({ JWT_REFRESH_TOKEN_EXPIRY: '14d' });
      const service = new JwtService();

      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'a', 'r');

      const refreshCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'refresh_token');
      expect(refreshCall![2].maxAge).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('should throw when JWT_SECRET env var is not set (security requirement)', () => {
      setEnv({
        JWT_SECRET: undefined,
        JWT_REFRESH_SECRET: undefined,
        JWT_ACCESS_TOKEN_EXPIRY: undefined,
        JWT_REFRESH_TOKEN_EXPIRY: undefined,
      });

      // Must throw — hardcoded fallback secrets were removed (SEC-03)
      expect(() => new JwtService()).toThrow('JWT_SECRET environment variable is required');
    });
  });
});
