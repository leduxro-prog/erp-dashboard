import { rateLimit } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * Default: 1000 requests per hour per IP
 */
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10),
  limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  handler: (req: Request, res: Response, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Auth endpoints rate limiter (stricter)
 * Default: 20 requests per hour per IP
 * Prevents brute force attacks on login/register endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '3600000', 10),
  limit: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '20', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many login attempts. Please try again after an hour.',
  },
  handler: (req: Request, res: Response, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

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
