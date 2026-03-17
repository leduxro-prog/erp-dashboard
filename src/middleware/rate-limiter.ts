import { rateLimit } from 'express-rate-limit';
import {
  defaultApiLimiter,
  authInteractiveLimiter,
  refreshGuardrailLimiter,
} from '../../shared/middleware/rate-limit.middleware';

/**
 * General API rate limiter
 * Default: 1000 requests per hour per IP
 */
export const rateLimiter = defaultApiLimiter;

/**
 * Auth endpoints rate limiter (stricter)
 * Default: 20 requests per hour per IP
 * Prevents brute force attacks on login/register endpoints
 */
export const authRateLimiter = authInteractiveLimiter;

export const refreshRateLimiter = refreshGuardrailLimiter;

/**
 * Factory to create custom rate limiters
 */
export const createRateLimiter = (windowMs: number, maxRequests: number) => {
  return rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
};
