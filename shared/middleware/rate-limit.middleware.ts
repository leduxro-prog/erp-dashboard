import { Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type Redis from 'ioredis';
import logger from '../utils/logger';
import {
  extractClientKey,
  hashClientKey,
  type ClientKeyConfig,
} from '../../src/middleware/client-key';

type TierName =
  | 'tier-control'
  | 'tier-auth-interactive'
  | 'tier-auth-refresh'
  | 'tier-default-api'
  | 'tier-write-operations';

type MinimalLogger = {
  warn: (payload: Record<string, unknown>) => void;
};

export interface CreateRateLimitPoliciesOptions {
  redisClient?: Pick<Redis, 'call'>;
  logger?: MinimalLogger;
  clientKeyConfig?: ClientKeyConfig;
}

export interface RateLimitPolicies {
  defaultApiLimiter: RateLimitRequestHandler;
  authInteractiveLimiter: RateLimitRequestHandler;
  refreshGuardrailLimiter: RateLimitRequestHandler;
  writeOperationLimiter: RateLimitRequestHandler;
  resolveTier: (path: string, method: string) => TierName;
  meta: {
    storeType: 'memory' | 'redis';
  };
}

function isHealthPath(pathname: string): boolean {
  return pathname === '/health' || pathname === '/api/v1/health';
}

function normalizeApiPath(pathname: string): string {
  if (pathname.startsWith('/api/v1/')) {
    return pathname.slice('/api/v1'.length);
  }
  if (pathname === '/api/v1') {
    return '/';
  }
  return pathname;
}

function isAuthInteractivePath(pathname: string): boolean {
  const normalizedPath = normalizeApiPath(pathname);
  const explicitAuthPaths = new Set([
    '/users/login',
    '/users/auth/google',
    '/users/forgot-password',
    '/users/reset-password',
    '/b2b-auth/google',
    '/b2b-auth/login',
    '/b2b-auth/forgot-password',
    '/b2b-auth/reset-password',
  ]);

  return (
    explicitAuthPaths.has(normalizedPath) ||
    normalizedPath === '/auth' ||
    normalizedPath.startsWith('/auth/')
  );
}

function isRefreshGuardrailRequest(pathname: string, method: string): boolean {
  const normalizedPath = normalizeApiPath(pathname);
  return normalizedPath === '/b2b-auth/refresh' && method.toUpperCase() === 'POST';
}

function createStoreFactory(redisClient?: Pick<Redis, 'call'>) {
  const redisEnabled = process.env.RATE_LIMIT_STORE === 'redis' && Boolean(redisClient);
  const useRedisStore = redisEnabled && process.env.NODE_ENV !== 'test';

  return {
    redisEnabled,
    createStore: (tier: string) => {
      if (!useRedisStore || !redisClient) {
        return undefined;
      }

      return new RedisStore({
        sendCommand: (command: string, ...args: string[]) =>
          redisClient.call(command, ...args) as Promise<any>,
        prefix: `rl:cypher:${tier}:`,
      });
    },
  };
}

function parseNumericHeader(headerValue: unknown): number {
  if (typeof headerValue === 'number') {
    return headerValue;
  }
  if (typeof headerValue === 'string') {
    const parsed = Number(headerValue);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function buildThrottleHandler(
  tier: TierName,
  tierLogger: MinimalLogger,
  clientKeyConfig: ClientKeyConfig,
) {
  return (req: Request, res: Response, _next: () => void, options: any): void => {
    const clientKeyHash = hashClientKey(extractClientKey(req, clientKeyConfig));
    tierLogger.warn({
      event: 'rate_limit_decision',
      route: req.path,
      method: req.method,
      limiter_tier: tier,
      decision: 'throttled',
      client_key_hash: clientKeyHash,
      remaining: parseNumericHeader(res.getHeader('ratelimit-remaining')),
      reset_at: parseNumericHeader(res.getHeader('ratelimit-reset')),
      limit: parseNumericHeader(res.getHeader('ratelimit-limit')),
    });

    res.status(options.statusCode).json(options.message);
  };
}

function createKeyGenerator(clientKeyConfig: ClientKeyConfig) {
  return (req: Request): string => extractClientKey(req, clientKeyConfig);
}

export function createRateLimitPolicies(
  options: CreateRateLimitPoliciesOptions = {},
): RateLimitPolicies {
  const storeFactory = createStoreFactory(options.redisClient);
  const tierLogger = options.logger || logger;
  const clientKeyConfig = options.clientKeyConfig || {};
  const keyGenerator = createKeyGenerator(clientKeyConfig);
  const shared = {
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    keyGenerator,
  };

  const defaultApiLimiter = rateLimit({
    ...shared,
    store: storeFactory.createStore('default-api'),
    passOnStoreError: true,
    windowMs: 15 * 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '1200', 10),
    skip: (req: Request) =>
      isHealthPath(req.path) ||
      isAuthInteractivePath(req.path) ||
      isRefreshGuardrailRequest(req.path, req.method),
    message: {
      status: 429,
      message: 'Too many requests, please try again later.',
    },
    handler: buildThrottleHandler('tier-default-api', tierLogger, clientKeyConfig),
  });

  const authInteractiveLimiter = rateLimit({
    ...shared,
    store: storeFactory.createStore('auth-interactive'),
    passOnStoreError: true,
    windowMs: 15 * 60 * 1000,
    limit: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '120', 10),
    skip: (req: Request) => !isAuthInteractivePath(req.path),
    message: {
      status: 429,
      message: 'Too many authentication attempts, please try again later.',
    },
    handler: buildThrottleHandler('tier-auth-interactive', tierLogger, clientKeyConfig),
  });

  const refreshGuardrailLimiter = rateLimit({
    ...shared,
    store: storeFactory.createStore('auth-refresh'),
    passOnStoreError: true,
    windowMs: 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_REFRESH_MAX || '30', 10),
    skip: (req: Request) => !isRefreshGuardrailRequest(req.path, req.method),
    message: {
      status: 429,
      message: 'Too many refresh attempts, please try again shortly.',
    },
    handler: buildThrottleHandler('tier-auth-refresh', tierLogger, clientKeyConfig),
  });

  const writeOperationLimiter = rateLimit({
    ...shared,
    store: storeFactory.createStore('write'),
    passOnStoreError: true,
    windowMs: 60 * 1000,
    limit: parseInt(process.env.RATE_LIMIT_WRITE_MAX || '30', 10),
    skip: (req: Request) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
    message: {
      status: 429,
      message: 'Too many write operations, please slow down.',
    },
    handler: buildThrottleHandler('tier-write-operations', tierLogger, clientKeyConfig),
  });

  return {
    defaultApiLimiter,
    authInteractiveLimiter,
    refreshGuardrailLimiter,
    writeOperationLimiter,
    resolveTier: (pathname: string, method: string): TierName => {
      if (isHealthPath(pathname)) {
        return 'tier-control';
      }

      if (isRefreshGuardrailRequest(pathname, method)) {
        return 'tier-auth-refresh';
      }

      if (isAuthInteractivePath(pathname)) {
        return 'tier-auth-interactive';
      }

      return 'tier-default-api';
    },
    meta: {
      storeType: storeFactory.redisEnabled ? 'redis' : 'memory',
    },
  };
}

const defaultPolicies = createRateLimitPolicies();

export const defaultApiLimiter = defaultPolicies.defaultApiLimiter;
export const authInteractiveLimiter = defaultPolicies.authInteractiveLimiter;
export const refreshGuardrailLimiter = defaultPolicies.refreshGuardrailLimiter;

// Compatibility exports
export const globalApiLimiter = defaultApiLimiter;
export const b2bApiLimiter = defaultApiLimiter;
export const authLimiter = authInteractiveLimiter;
export const loginLimiter = authInteractiveLimiter;
export const writeOperationLimiter = defaultPolicies.writeOperationLimiter;
