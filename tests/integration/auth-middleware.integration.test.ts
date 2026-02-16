/**
 * Auth Middleware Integration Tests
 *
 * Tests the authenticate middleware end-to-end using real JwtService
 * token generation/verification and Express-compatible request/response mocks.
 * No database required — exercises the full auth flow including auto-refresh.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { JwtService, TokenPayload } from '../../shared/services/JwtService';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';

// Silence logger
jest.mock('../../shared/utils/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// We need to mock the jwtService singleton used inside auth.middleware
// so that it uses the same secrets as our test JwtService instances.
jest.mock('../../shared/services/JwtService', () => {
  const actual = jest.requireActual('../../shared/services/JwtService') as any;
  return {
    ...actual,
    // Override the singleton with a getter so it picks up env vars at call time
    get jwtService() {
      return new actual.JwtService();
    },
  };
});

describe('Auth Middleware Integration', () => {
  const originalEnv: Record<string, string | undefined> = {};

  const TEST_ACCESS_SECRET = 'authtest-access-secret-2026';
  const TEST_REFRESH_SECRET = 'authtest-refresh-secret-2026';

  const testUser: TokenPayload = {
    id: 'authtest-user-001',
    email: 'authtest@example.com',
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

  /**
   * Build a minimal Express-like request mock.
   */
  function mockRequest(
    opts: {
      cookies?: Record<string, string>;
      authorizationHeader?: string;
    } = {},
  ): Request {
    return {
      cookies: opts.cookies || {},
      headers: {
        ...(opts.authorizationHeader ? { authorization: opts.authorizationHeader } : {}),
      },
    } as unknown as Request;
  }

  /**
   * Build a minimal Express-like response mock that captures status and json calls.
   */
  function mockResponse(): Response & {
    _status: number | null;
    _json: unknown;
    _cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>;
  } {
    const res: any = {
      _status: null,
      _json: null,
      _cookies: [],
      status(code: number) {
        res._status = code;
        return res;
      },
      json(body: unknown) {
        res._json = body;
        return res;
      },
      cookie(name: string, value: string, options: Record<string, unknown>) {
        res._cookies.push({ name, value, options });
        return res;
      },
    };
    return res;
  }

  let service: JwtService;

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
    service = new JwtService();
  });

  afterEach(() => {
    restoreEnv();
  });

  // ── Valid token in cookie ─────────────────────────────────────────────

  describe('Valid JWT in cookie', () => {
    it('should call next() and attach user to request', (done) => {
      const accessToken = service.generateAccessToken(testUser);
      const req = mockRequest({ cookies: { access_token: accessToken } });
      const res = mockResponse();

      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        expect((req as any).user).toBeDefined();
        expect((req as any).user.id).toBe(testUser.id);
        expect((req as any).user.email).toBe(testUser.email);
        expect((req as any).user.role).toBe(testUser.role);
        done();
      };

      authenticate(req, res, next);
    });
  });

  // ── Valid token in Authorization header ────────────────────────────────

  describe('Valid JWT in Authorization header', () => {
    it('should accept Bearer token in header and attach user', (done) => {
      const accessToken = service.generateAccessToken(testUser);
      const req = mockRequest({ authorizationHeader: `Bearer ${accessToken}` });
      const res = mockResponse();

      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        expect((req as any).user).toBeDefined();
        expect((req as any).user.id).toBe(testUser.id);
        done();
      };

      authenticate(req, res, next);
    });
  });

  // ── Cookie priority over header ───────────────────────────────────────

  describe('Cookie-first priority', () => {
    it('should prefer cookie token over Authorization header', (done) => {
      const cookieUser: TokenPayload = {
        id: 'cookie-user',
        email: 'cookie@example.com',
        role: 'user',
      };
      const headerUser: TokenPayload = {
        id: 'header-user',
        email: 'header@example.com',
        role: 'admin',
      };

      const cookieToken = service.generateAccessToken(cookieUser);
      const headerToken = service.generateAccessToken(headerUser);

      const req = mockRequest({
        cookies: { access_token: cookieToken },
        authorizationHeader: `Bearer ${headerToken}`,
      });
      const res = mockResponse();

      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        // Should use cookie user, not header user
        expect((req as any).user.id).toBe('cookie-user');
        expect((req as any).user.email).toBe('cookie@example.com');
        done();
      };

      authenticate(req, res, next);
    });
  });

  // ── Missing token ────────────────────────────────────────────────────

  describe('Missing token', () => {
    it('should respond with 401 when no token is provided', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Missing or invalid authorization header' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── Expired token ────────────────────────────────────────────────────

  describe('Expired tokens', () => {
    it('should respond with 401 when access token is expired and no refresh cookie', () => {
      const expiredToken = jwt.sign(testUser, TEST_ACCESS_SECRET, { expiresIn: '0s' });
      const req = mockRequest({ cookies: { access_token: expiredToken } });
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Token has expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should auto-refresh when access token expired but valid refresh cookie exists', (done) => {
      const expiredAccess = jwt.sign(testUser, TEST_ACCESS_SECRET, { expiresIn: '0s' });
      const validRefresh = service.generateRefreshToken(testUser);

      const req = mockRequest({
        cookies: {
          access_token: expiredAccess,
          refresh_token: validRefresh,
        },
      });
      const res = mockResponse();

      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        // User should be attached from the refresh token
        expect((req as any).user).toBeDefined();
        expect((req as any).user.id).toBe(testUser.id);

        // New cookies should be set on the response
        const cookieNames = res._cookies.map((c) => c.name);
        expect(cookieNames).toContain('access_token');
        expect(cookieNames).toContain('refresh_token');
        expect(cookieNames).toContain('auth_status');
        done();
      };

      authenticate(req, res as any, next);
    });

    it('should respond with 401 when both access and refresh tokens are expired', () => {
      const expiredAccess = jwt.sign(testUser, TEST_ACCESS_SECRET, { expiresIn: '0s' });
      const expiredRefresh = jwt.sign(testUser, TEST_REFRESH_SECRET, { expiresIn: '0s' });

      const req = mockRequest({
        cookies: {
          access_token: expiredAccess,
          refresh_token: expiredRefresh,
        },
      });
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── Invalid / malformed tokens ────────────────────────────────────────

  describe('Invalid tokens', () => {
    it('should respond with 401 for a completely invalid token string', () => {
      const req = mockRequest({ cookies: { access_token: 'not-a-jwt' } });
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should respond with 401 for a token signed with the wrong secret', () => {
      const wrongToken = jwt.sign(testUser, 'completely-wrong-secret', { expiresIn: '15m' });
      const req = mockRequest({ cookies: { access_token: wrongToken } });
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Invalid or malformed token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should respond with 401 for a tampered token', () => {
      const validToken = service.generateAccessToken(testUser);
      const tampered = validToken.slice(0, -5) + 'XXXXX';

      const req = mockRequest({ cookies: { access_token: tampered } });
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should respond with 401 for Authorization header without Bearer prefix', () => {
      const token = service.generateAccessToken(testUser);
      const req = mockRequest({ authorizationHeader: token }); // missing "Bearer "
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── Missing JWT_SECRET ────────────────────────────────────────────────

  describe('Missing JWT_SECRET configuration', () => {
    it('should respond with 500 when JWT_SECRET is not set', () => {
      setEnv({ JWT_SECRET: undefined });

      // Need to generate a token with something to pass extraction
      const token = jwt.sign(testUser, 'anything', { expiresIn: '15m' });
      const req = mockRequest({ cookies: { access_token: token } });
      const res = mockResponse();
      const next = jest.fn();

      authenticate(req, res as any, next);

      expect(res._status).toBe(500);
      expect(res._json).toEqual({ error: 'Server configuration error' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── requireRole middleware ────────────────────────────────────────────

  describe('requireRole middleware', () => {
    it('should call next() when user has the required role', (done) => {
      const req = mockRequest() as any;
      req.user = { id: 'u1', email: 'a@b.com', role: 'admin' };
      const res = mockResponse();

      const middleware = requireRole(['admin']);
      middleware(req, res as any, (err?: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should accept any of multiple allowed roles', (done) => {
      const req = mockRequest() as any;
      req.user = { id: 'u1', email: 'a@b.com', role: 'moderator' };
      const res = mockResponse();

      const middleware = requireRole(['admin', 'moderator']);
      middleware(req, res as any, (err?: any) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    it('should respond with 403 when user lacks the required role', () => {
      const req = mockRequest() as any;
      req.user = { id: 'u1', email: 'a@b.com', role: 'user' };
      const res = mockResponse();
      const next = jest.fn();

      const middleware = requireRole(['admin']);
      middleware(req, res as any, next);

      expect(res._status).toBe(403);
      expect(res._json).toMatchObject({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should respond with 401 when user is not authenticated', () => {
      const req = mockRequest() as any;
      // No user attached
      const res = mockResponse();
      const next = jest.fn();

      const middleware = requireRole(['admin']);
      middleware(req, res as any, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
