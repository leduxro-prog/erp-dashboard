export type DatabaseSslMode = 'disable' | 'require';

type DatabaseSslEnv = {
  DATABASE_SSL_MODE?: string;
  DATABASE_SSL_REJECT_UNAUTHORIZED?: string | boolean;
  DB_SSL?: string | boolean;
  NODE_ENV?: string;
  DEPLOYMENT_INTENT?: string;
};

type DatabaseSslConfig = false | { rejectUnauthorized: boolean };

const DEFAULT_ENV = process.env as DatabaseSslEnv;

function isProductionLike(env: DatabaseSslEnv): boolean {
  return (
    env.NODE_ENV === 'production' ||
    env.NODE_ENV === 'staging' ||
    env.DEPLOYMENT_INTENT === 'staging' ||
    env.DEPLOYMENT_INTENT === 'rehearsal' ||
    env.DEPLOYMENT_INTENT === 'production'
  );
}

function parseLegacyDbSsl(value: DatabaseSslEnv['DB_SSL']): DatabaseSslMode | undefined {
  if (typeof value === 'boolean') {
    return value ? 'require' : 'disable';
  }

  if (value === 'true') {
    return 'require';
  }

  if (value === 'false') {
    return 'disable';
  }

  return undefined;
}

function parseRejectUnauthorized(
  value: DatabaseSslEnv['DATABASE_SSL_REJECT_UNAUTHORIZED'],
): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

export function resolveDatabaseSslMode(env: DatabaseSslEnv = DEFAULT_ENV): DatabaseSslMode {
  if (env.DATABASE_SSL_MODE === 'disable' || env.DATABASE_SSL_MODE === 'require') {
    return env.DATABASE_SSL_MODE;
  }

  const legacyMode = parseLegacyDbSsl(env.DB_SSL);

  if (legacyMode) {
    return legacyMode;
  }

  return isProductionLike(env) ? 'require' : 'disable';
}

export function resolveDatabaseSsl(env: DatabaseSslEnv = DEFAULT_ENV): DatabaseSslConfig {
  if (resolveDatabaseSslMode(env) === 'disable') {
    return false;
  }

  return {
    rejectUnauthorized: parseRejectUnauthorized(env.DATABASE_SSL_REJECT_UNAUTHORIZED) ?? true,
  };
}
