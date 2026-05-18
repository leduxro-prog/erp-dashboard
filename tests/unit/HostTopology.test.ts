import { validateEnv } from '../../src/config/env.validation';
import { buildHostTopology } from '../../src/config/host-topology';

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

describe('host topology environment validation', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects staging intent when explicit frontend and api hosts are missing', () => {
    applyEnv({
      NODE_ENV: 'staging',
      DEPLOYMENT_INTENT: 'staging',
    });

    expect(() => validateEnv()).toThrow(/FRONTEND_URL/);
    expect(() => validateEnv()).toThrow(/PUBLIC_BASE_URL/);
  });

  it('rejects staging node env when deployment intent is omitted', () => {
    applyEnv({
      NODE_ENV: 'staging',
      DEPLOYMENT_INTENT: undefined,
      FRONTEND_URL: 'https://erp-staging.ledux.ro',
      PUBLIC_BASE_URL: 'https://api-staging.ledux.ro',
    });

    expect(() => validateEnv()).toThrow(/DEPLOYMENT_INTENT/);
  });

  it('rejects production intent without explicit production host fields', () => {
    applyEnv({
      NODE_ENV: 'production',
      DEPLOYMENT_INTENT: 'production',
      FRONTEND_URL: 'https://erp.ledux.ro',
      PUBLIC_BASE_URL: undefined,
    });

    expect(() => validateEnv()).toThrow(/PUBLIC_BASE_URL/);
  });

  it('requires an explicit canonical shop host when legacy coexistence is declared', () => {
    expect(() =>
      buildHostTopology({
        NODE_ENV: 'production',
        DEPLOYMENT_INTENT: 'production',
        FRONTEND_URL: 'https://erp.ledux.ro',
        PUBLIC_BASE_URL: 'https://api.ledux.ro',
        LEGACY_STOREFRONT_URL: 'https://legacy.ledux.ro',
      }),
    ).toThrow(/CANONICAL_SHOP_URL/);
  });

  it('rejects contradictory node env and deployment intent combinations', () => {
    expect(() =>
      buildHostTopology({
        NODE_ENV: 'production',
        DEPLOYMENT_INTENT: 'local',
      }),
    ).toThrow(/NODE_ENV/);
  });

  it('accepts rehearsal intent with explicit production hosts', () => {
    const topology = buildHostTopology({
      NODE_ENV: 'production',
      DEPLOYMENT_INTENT: 'rehearsal',
      FRONTEND_URL: 'https://erp-rehearsal.ledux.ro',
      PUBLIC_BASE_URL: 'https://api-rehearsal.ledux.ro',
      CANONICAL_SHOP_URL: 'https://rehearsal.ledux.ro',
    });

    expect(topology).toMatchObject({
      deploymentIntent: 'rehearsal',
      frontendOrigin: 'https://erp-rehearsal.ledux.ro',
      apiOrigin: 'https://api-rehearsal.ledux.ro',
      canonicalShopOrigin: 'https://rehearsal.ledux.ro',
    });
  });

  it('returns explicit canonical and legacy topology details for coexistence', () => {
    const topology = buildHostTopology({
      NODE_ENV: 'production',
      DEPLOYMENT_INTENT: 'production',
      FRONTEND_URL: 'https://erp.ledux.ro',
      PUBLIC_BASE_URL: 'https://api.ledux.ro',
      CANONICAL_SHOP_URL: 'https://ledux.ro',
      LEGACY_STOREFRONT_URL: 'https://legacy.ledux.ro',
      CORS_ORIGINS: 'https://erp.ledux.ro, https://b2b.ledux.ro',
    });

    expect(topology).toMatchObject({
      deploymentIntent: 'production',
      frontendOrigin: 'https://erp.ledux.ro',
      apiOrigin: 'https://api.ledux.ro',
      canonicalShopOrigin: 'https://ledux.ro',
      legacyStorefrontOrigin: 'https://legacy.ledux.ro',
    });
    expect(topology.allowedCorsOrigins).toEqual([
      'https://erp.ledux.ro',
      'https://b2b.ledux.ro',
      'https://ledux.ro',
      'https://legacy.ledux.ro',
      'https://api.ledux.ro',
    ]);
  });

  it('allows localhost browser origin for local docker frontend flow', () => {
    const topology = buildHostTopology({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3000',
      PUBLIC_BASE_URL: 'http://localhost:3000',
    });

    expect(topology.allowedCorsOrigins).toContain('http://localhost');
    expect(topology.allowedCorsOrigins).toContain('http://127.0.0.1');
  });

  it('keeps localhost browser origin when local compose CORS_ORIGINS is set', () => {
    const topology = buildHostTopology({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3000',
      PUBLIC_BASE_URL: 'http://localhost:3000',
      CORS_ORIGINS:
        'http://localhost,http://127.0.0.1,http://localhost:3000,http://localhost:3001,http://localhost:5173',
    });

    expect(topology.allowedCorsOrigins).toContain('http://localhost');
    expect(topology.allowedCorsOrigins).toContain('http://127.0.0.1');
  });

  it('accepts copied local example env contract values', () => {
    applyEnv({
      NODE_ENV: 'development',
      DEPLOYMENT_INTENT: 'local',
      DB_USER: 'cypher_user',
      DB_USERNAME: 'cypher_user',
      FRONTEND_URL: 'http://localhost:3000',
      PUBLIC_BASE_URL: 'http://localhost:3000',
    });

    expect(validateEnv()).toMatchObject({
      DB_USERNAME: 'cypher_user',
      DEPLOYMENT_INTENT: 'local',
    });
  });
});
