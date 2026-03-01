import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import authRouter from '../../src/routes/auth.routes';
import { JwtService } from '../../shared/services/JwtService';

describe('Auth Refresh Route Integration', () => {
  const originalEnv: Record<string, string | undefined> = {};

  const TEST_ACCESS_SECRET = 'auth-refresh-access-secret-2026';
  const TEST_REFRESH_SECRET = 'auth-refresh-refresh-secret-2026';

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

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/v1/auth', authRouter);
    return app;
  }

  beforeEach(() => {
    setEnv({
      NODE_ENV: 'test',
      JWT_SECRET: TEST_ACCESS_SECRET,
      JWT_REFRESH_SECRET: TEST_REFRESH_SECRET,
      JWT_ACCESS_TOKEN_EXPIRY: '15m',
      JWT_REFRESH_TOKEN_EXPIRY: '7d',
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns 401 without refresh token', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'No refresh token provided' });
  });

  it('issues non-persistent cookies when rememberMe=false', async () => {
    const app = createApp();
    const jwtService = new JwtService();
    const refreshToken = jwtService.generateRefreshToken({
      id: 'u-remember-false',
      email: 'remember.false@example.com',
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${refreshToken}`])
      .send({ rememberMe: false });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();

    const setCookie = (res.headers['set-cookie'] || []) as string[];
    const persistCookie = setCookie.find((cookie) => cookie.startsWith('auth_persist='));

    expect(persistCookie).toBeDefined();
    expect(persistCookie).toContain('auth_persist=false');

    // Session cookies should not include Max-Age
    expect(setCookie.join(';')).not.toContain('Max-Age=');
  });

  it('inherits non-persistent mode from auth_persist cookie when rememberMe is omitted', async () => {
    const app = createApp();
    const jwtService = new JwtService();
    const refreshToken = jwtService.generateRefreshToken({
      id: 'u-cookie-persist-false',
      email: 'cookie.persist.false@example.com',
      role: 'manager',
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${refreshToken}`, 'auth_persist=false'])
      .send({});

    expect(res.status).toBe(200);

    const setCookie = (res.headers['set-cookie'] || []) as string[];
    const persistCookie = setCookie.find((cookie) => cookie.startsWith('auth_persist='));

    expect(persistCookie).toBeDefined();
    expect(persistCookie).toContain('auth_persist=false');
    expect(setCookie.join(';')).not.toContain('Max-Age=');
  });

  it('accepts legacy refresh payload with userId and defaults role to user', async () => {
    const app = createApp();
    const legacyRefresh = jwt.sign(
      { userId: 'legacy-refresh-user', email: 'legacy.refresh@example.com' },
      TEST_REFRESH_SECRET,
      { expiresIn: '7d' },
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${legacyRefresh}`])
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const decoded = jwt.verify(res.body.token, TEST_ACCESS_SECRET) as {
      id?: string;
      role?: string;
      email?: string;
    };

    expect(decoded.id).toBe('legacy-refresh-user');
    expect(decoded.email).toBe('legacy.refresh@example.com');
    expect(decoded.role).toBe('user');
  });
});
