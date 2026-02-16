import jwt from 'jsonwebtoken';
import { JwtService, TokenPayload } from '../../shared/services/JwtService';

// Mock the logger to avoid side effects
jest.mock('../../shared/utils/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('JwtService', () => {
  let service: JwtService;
  const testPayload: TokenPayload = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
  };

  beforeEach(() => {
    // Set required secrets (constructor throws without them since SEC-03 fix)
    process.env.JWT_SECRET = 'test-unit-secret-key-for-jwt-service';
    process.env.JWT_REFRESH_SECRET = 'test-unit-refresh-secret-key-for-jwt';
    // Reset optional env vars to defaults
    delete process.env.JWT_ACCESS_TOKEN_EXPIRY;
    delete process.env.JWT_REFRESH_TOKEN_EXPIRY;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.NODE_ENV;
    service = new JwtService();
  });

  // ── Token Generation ───────────────────────────────────────────────

  describe('generateAccessToken', () => {
    it('returns a valid JWT string with three dot-separated segments', () => {
      const token = service.generateAccessToken(testPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds the correct payload claims', () => {
      const token = service.generateAccessToken(testPayload);
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('sets an expiry claim (exp) on the token', () => {
      const token = service.generateAccessToken(testPayload);
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
    });
  });

  describe('generateRefreshToken', () => {
    it('returns a valid JWT string', () => {
      const token = service.generateRefreshToken(testPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds the correct payload claims', () => {
      const token = service.generateRefreshToken(testPayload);
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('has a longer expiry than the access token', () => {
      const access = service.generateAccessToken(testPayload);
      const refresh = service.generateRefreshToken(testPayload);
      const accessDecoded = jwt.decode(access) as { exp: number };
      const refreshDecoded = jwt.decode(refresh) as { exp: number };
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });

  describe('access and refresh tokens use different secrets', () => {
    it('access token cannot be verified as a refresh token', () => {
      process.env.JWT_SECRET = 'access-secret-unique';
      process.env.JWT_REFRESH_SECRET = 'refresh-secret-unique';
      const svc = new JwtService();

      const accessToken = svc.generateAccessToken(testPayload);
      expect(() => svc.verifyRefreshToken(accessToken)).toThrow();
    });

    it('refresh token cannot be verified as an access token', () => {
      process.env.JWT_SECRET = 'access-secret-unique';
      process.env.JWT_REFRESH_SECRET = 'refresh-secret-unique';
      const svc = new JwtService();

      const refreshToken = svc.generateRefreshToken(testPayload);
      expect(() => svc.verifyAccessToken(refreshToken)).toThrow();
    });
  });

  // ── Token Verification ─────────────────────────────────────────────

  describe('verifyAccessToken', () => {
    it('returns the decoded payload for a valid token', () => {
      const token = service.generateAccessToken(testPayload);
      const decoded = service.verifyAccessToken(token);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('throws for an expired token', () => {
      // Create a token that already expired
      const secret = process.env.JWT_SECRET!;
      const expiredToken = jwt.sign(testPayload, secret, { expiresIn: '0s' });

      expect(() => service.verifyAccessToken(expiredToken)).toThrow();
    });

    it('throws for a malformed / invalid token', () => {
      expect(() => service.verifyAccessToken('not.a.valid.token')).toThrow();
    });

    it('throws for a token signed with the wrong secret', () => {
      const wrongToken = jwt.sign(testPayload, 'wrong-secret', { expiresIn: '15m' });
      expect(() => service.verifyAccessToken(wrongToken)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns the decoded payload for a valid refresh token', () => {
      const token = service.generateRefreshToken(testPayload);
      const decoded = service.verifyRefreshToken(token);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('throws for an expired refresh token', () => {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
      const expiredToken = jwt.sign(testPayload, secret, { expiresIn: '0s' });
      expect(() => service.verifyRefreshToken(expiredToken)).toThrow();
    });

    it('throws for a tampered token', () => {
      const token = service.generateRefreshToken(testPayload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => service.verifyRefreshToken(tampered)).toThrow();
    });
  });

  // ── Cookie Management ──────────────────────────────────────────────

  describe('constructor validation', () => {
    it('throws when JWT_SECRET is not set', () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      expect(() => new JwtService()).toThrow('JWT_SECRET environment variable is required');
      process.env.JWT_SECRET = saved;
    });

    it('throws when JWT_SECRET is empty string', () => {
      const saved = process.env.JWT_SECRET;
      process.env.JWT_SECRET = '';
      expect(() => new JwtService()).toThrow('JWT_SECRET environment variable is required');
      process.env.JWT_SECRET = saved;
    });
  });

  // ── Cookie Management (continued) ─────────────────────────────────

  describe('setAuthCookies', () => {
    it('calls res.cookie exactly 3 times', () => {
      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'access-tok', 'refresh-tok');
      expect(mockRes.cookie).toHaveBeenCalledTimes(3);
    });

    it('sets access_token cookie with httpOnly true and path /', () => {
      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'access-tok', 'refresh-tok');

      const accessCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'access_token');
      expect(accessCall).toBeDefined();
      expect(accessCall![1]).toBe('access-tok');
      expect(accessCall![2]).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    });

    it('sets refresh_token cookie with restricted path', () => {
      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'access-tok', 'refresh-tok');

      const refreshCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'refresh_token');
      expect(refreshCall).toBeDefined();
      expect(refreshCall![1]).toBe('refresh-tok');
      expect(refreshCall![2]).toMatchObject({
        httpOnly: true,
        path: '/api/v1/auth/refresh',
      });
    });

    it('sets auth_status cookie with httpOnly false', () => {
      const mockRes = { cookie: jest.fn() } as any;
      service.setAuthCookies(mockRes, 'access-tok', 'refresh-tok');

      const statusCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'auth_status');
      expect(statusCall).toBeDefined();
      expect(statusCall![1]).toBe('authenticated');
      expect(statusCall![2]).toMatchObject({ httpOnly: false });
    });

    it('sets secure flag when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-unit-secret-key-for-jwt-service';
      process.env.JWT_REFRESH_SECRET = 'test-unit-refresh-secret-key-for-jwt';
      const prodService = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      prodService.setAuthCookies(mockRes, 'a', 'r');

      for (const call of mockRes.cookie.mock.calls) {
        expect(call[2].secure).toBe(true);
      }
    });

    it('does NOT set secure flag in non-production', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test-unit-secret-key-for-jwt-service';
      process.env.JWT_REFRESH_SECRET = 'test-unit-refresh-secret-key-for-jwt';
      const devService = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      devService.setAuthCookies(mockRes, 'a', 'r');

      for (const call of mockRes.cookie.mock.calls) {
        expect(call[2].secure).toBe(false);
      }
    });
  });

  describe('clearAuthCookies', () => {
    it('calls res.clearCookie exactly 3 times', () => {
      const mockRes = { clearCookie: jest.fn() } as any;
      service.clearAuthCookies(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(3);
    });

    it('clears access_token with path /', () => {
      const mockRes = { clearCookie: jest.fn() } as any;
      service.clearAuthCookies(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    });

    it('clears refresh_token with restricted path', () => {
      const mockRes = { clearCookie: jest.fn() } as any;
      service.clearAuthCookies(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/v1/auth/refresh',
      });
    });

    it('clears auth_status with path /', () => {
      const mockRes = { clearCookie: jest.fn() } as any;
      service.clearAuthCookies(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('auth_status', { path: '/' });
    });
  });

  // ── parseDurationToMs (tested indirectly via cookie maxAge) ────────

  describe('cookie maxAge reflects configured expiry durations', () => {
    it('parses minutes correctly (e.g. 30m)', () => {
      process.env.JWT_ACCESS_TOKEN_EXPIRY = '30m';
      const svc = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      svc.setAuthCookies(mockRes, 'a', 'r');

      const accessCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'access_token');
      expect(accessCall![2].maxAge).toBe(30 * 60 * 1000);
    });

    it('parses days correctly (e.g. 7d)', () => {
      process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d';
      const svc = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      svc.setAuthCookies(mockRes, 'a', 'r');

      const refreshCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'refresh_token');
      expect(refreshCall![2].maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('parses hours correctly (e.g. 2h)', () => {
      process.env.JWT_ACCESS_TOKEN_EXPIRY = '2h';
      const svc = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      svc.setAuthCookies(mockRes, 'a', 'r');

      const accessCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'access_token');
      expect(accessCall![2].maxAge).toBe(2 * 60 * 60 * 1000);
    });

    it('parses seconds correctly (e.g. 45s)', () => {
      process.env.JWT_ACCESS_TOKEN_EXPIRY = '45s';
      const svc = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      svc.setAuthCookies(mockRes, 'a', 'r');

      const accessCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'access_token');
      expect(accessCall![2].maxAge).toBe(45 * 1000);
    });

    it('falls back to 15 minutes for invalid duration string', () => {
      process.env.JWT_ACCESS_TOKEN_EXPIRY = 'invalid';
      const svc = new JwtService();
      const mockRes = { cookie: jest.fn() } as any;
      svc.setAuthCookies(mockRes, 'a', 'r');

      const accessCall = mockRes.cookie.mock.calls.find((c: any[]) => c[0] === 'access_token');
      expect(accessCall![2].maxAge).toBe(15 * 60 * 1000);
    });
  });
});
