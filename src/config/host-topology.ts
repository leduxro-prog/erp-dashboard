import { URL } from 'url';

export type NodeEnvironment = 'development' | 'production' | 'staging' | 'test';

export type DeploymentIntent = 'local' | 'staging' | 'rehearsal' | 'production';

export interface HostTopologyEnv {
  NODE_ENV?: NodeEnvironment;
  DEPLOYMENT_INTENT?: string;
  FRONTEND_URL?: string;
  PUBLIC_BASE_URL?: string;
  CANONICAL_SHOP_URL?: string;
  LEGACY_STOREFRONT_URL?: string;
  CORS_ORIGINS?: string;
}

export interface HostTopology {
  deploymentIntent: DeploymentIntent;
  frontendOrigin?: string;
  apiOrigin?: string;
  canonicalShopOrigin?: string;
  legacyStorefrontOrigin?: string;
  allowedCorsOrigins: string[];
}

const LOCAL_DEFAULT_ORIGINS = [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1',
];

const ALLOWED_INTENTS_BY_NODE_ENV: Record<NodeEnvironment, DeploymentIntent[]> = {
  development: ['local'],
  production: ['rehearsal', 'production'],
  staging: ['staging'],
  test: ['local'],
};

function splitOrigins(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
}

function normalizeOptionalOrigin(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return new URL(value).origin;
}

function uniqueOrigins(origins: Array<string | undefined>): string[] {
  return Array.from(new Set(origins.filter((origin): origin is string => Boolean(origin))));
}

export function resolveDeploymentIntent(env: HostTopologyEnv): DeploymentIntent {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const rawIntent = env.DEPLOYMENT_INTENT?.trim();

  if (rawIntent) {
    if (rawIntent === 'local' || rawIntent === 'staging' || rawIntent === 'rehearsal' || rawIntent === 'production') {
      const allowedIntents = ALLOWED_INTENTS_BY_NODE_ENV[nodeEnv];

      if (!allowedIntents.includes(rawIntent)) {
        throw new Error(
          `NODE_ENV=${nodeEnv} is incompatible with DEPLOYMENT_INTENT=${rawIntent}`,
        );
      }

      return rawIntent;
    }

    throw new Error('DEPLOYMENT_INTENT must be one of: local, staging, rehearsal, production');
  }

  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return 'local';
  }

  if (nodeEnv === 'staging') {
    throw new Error('DEPLOYMENT_INTENT is required when NODE_ENV is staging');
  }

  if (nodeEnv === 'production') {
    throw new Error('DEPLOYMENT_INTENT is required when NODE_ENV is production');
  }

  return 'local';
}

export function buildHostTopology(env: HostTopologyEnv): HostTopology {
  const deploymentIntent = resolveDeploymentIntent(env);
  const configuredCorsOrigins = splitOrigins(env.CORS_ORIGINS);
  const canonicalShopOrigin = normalizeOptionalOrigin(env.CANONICAL_SHOP_URL);
  const legacyStorefrontOrigin = normalizeOptionalOrigin(env.LEGACY_STOREFRONT_URL);

  if (legacyStorefrontOrigin && !canonicalShopOrigin) {
    throw new Error('CANONICAL_SHOP_URL is required when LEGACY_STOREFRONT_URL is set');
  }

  if (legacyStorefrontOrigin && canonicalShopOrigin === legacyStorefrontOrigin) {
    throw new Error('LEGACY_STOREFRONT_URL must differ from CANONICAL_SHOP_URL');
  }

  if (deploymentIntent === 'local') {
    const frontendOrigin = normalizeOptionalOrigin(env.FRONTEND_URL);
    const apiOrigin = normalizeOptionalOrigin(env.PUBLIC_BASE_URL);
    const allowedCorsOrigins =
      configuredCorsOrigins.length > 0
        ? uniqueOrigins([
            ...configuredCorsOrigins,
            frontendOrigin,
            apiOrigin,
            canonicalShopOrigin,
            legacyStorefrontOrigin,
          ])
        : uniqueOrigins([
            ...LOCAL_DEFAULT_ORIGINS,
            frontendOrigin,
            apiOrigin,
            canonicalShopOrigin,
            legacyStorefrontOrigin,
          ]);

    return {
      deploymentIntent,
      frontendOrigin,
      apiOrigin,
      canonicalShopOrigin,
      legacyStorefrontOrigin,
      allowedCorsOrigins,
    };
  }

  const missingFields = ['FRONTEND_URL', 'PUBLIC_BASE_URL'].filter((fieldName) => {
    const value = fieldName === 'FRONTEND_URL' ? env.FRONTEND_URL : env.PUBLIC_BASE_URL;
    return !normalizeOptionalOrigin(value);
  });

  if (missingFields.length > 0) {
    throw new Error(
      `${missingFields.join(', ')} ${
        missingFields.length === 1 ? 'is' : 'are'
      } required for non-local deployment intent`,
    );
  }

  const frontendOrigin = normalizeOptionalOrigin(env.FRONTEND_URL)!;
  const apiOrigin = normalizeOptionalOrigin(env.PUBLIC_BASE_URL)!;

  return {
    deploymentIntent,
    frontendOrigin,
    apiOrigin,
    canonicalShopOrigin,
    legacyStorefrontOrigin,
    allowedCorsOrigins: uniqueOrigins([
      ...configuredCorsOrigins,
      frontendOrigin,
      canonicalShopOrigin,
      legacyStorefrontOrigin,
      apiOrigin,
    ]),
  };
}
