import { validateEnv } from '../../src/config/env.validation';
import { resolveDatabaseSslMode, resolveDatabaseSsl } from '../../src/config/database-ssl';

type EnvOverrides = Record<string, string | undefined>;

const BASE_ENV: Record<string, string> = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'cypher_erp',
  DB_USERNAME: 'cypher_user',
  DB_PASSWORD: '',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  JWT_EXPIRES_IN: '24h',
  NODE_ENV: 'development',
};

function applyEnv(overrides: EnvOverrides = {}): void {
  const nextEnv: NodeJS.ProcessEnv = { ...BASE_ENV };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete nextEnv[key];
      continue;
    }

    nextEnv[key] = value;
  }

  process.env = nextEnv;
}

describe('database ssl policy', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults local development to ssl disable', () => {
    expect(resolveDatabaseSslMode({ NODE_ENV: 'development' })).toBe('disable');
    expect(resolveDatabaseSsl({ NODE_ENV: 'development' })).toBe(false);
  });

  it('uses require mode when DATABASE_SSL_MODE=require', () => {
    expect(resolveDatabaseSslMode({ DATABASE_SSL_MODE: 'require', NODE_ENV: 'development' })).toBe(
      'require',
    );
    expect(resolveDatabaseSsl({ DATABASE_SSL_MODE: 'require' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('defaults production-like environments to require when mode is not explicit', () => {
    expect(resolveDatabaseSslMode({ NODE_ENV: 'production' })).toBe('require');
    expect(resolveDatabaseSsl({ DEPLOYMENT_INTENT: 'production' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('allows require mode to opt out of certificate verification explicitly', () => {
    expect(
      resolveDatabaseSsl({
        DATABASE_SSL_MODE: 'require',
        DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
      }),
    ).toEqual({ rejectUnauthorized: false });
  });

  it('keeps hardened certificate verification enabled when explicitly requested', () => {
    expect(
      resolveDatabaseSsl({
        DATABASE_SSL_MODE: 'require',
        DATABASE_SSL_REJECT_UNAUTHORIZED: 'true',
      }),
    ).toEqual({ rejectUnauthorized: true });
  });

  it('keeps legacy DB_SSL fallback when explicit mode is unset', () => {
    expect(resolveDatabaseSslMode({ DB_SSL: 'false', NODE_ENV: 'production' })).toBe('disable');
    expect(resolveDatabaseSslMode({ DB_SSL: 'true', NODE_ENV: 'development' })).toBe('require');
  });

  it('validates DATABASE_SSL_MODE env values', () => {
    applyEnv({ DATABASE_SSL_MODE: 'require', DATABASE_SSL_REJECT_UNAUTHORIZED: 'true' });

    expect(validateEnv()).toMatchObject({
      DATABASE_SSL_MODE: 'require',
      DATABASE_SSL_REJECT_UNAUTHORIZED: true,
    });
  });

  it('rejects unsupported DATABASE_SSL_MODE values', () => {
    applyEnv({ DATABASE_SSL_MODE: 'strict' });

    expect(() => validateEnv()).toThrow(/DATABASE_SSL_MODE/);
  });

  it('rejects unsupported DATABASE_SSL_REJECT_UNAUTHORIZED values', () => {
    applyEnv({ DATABASE_SSL_REJECT_UNAUTHORIZED: 'strict' });

    expect(() => validateEnv()).toThrow(/DATABASE_SSL_REJECT_UNAUTHORIZED/);
  });
});
