import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Global API rate limiter: configurable, default 100 requests per 15 minutes per IP
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
  },
  // Uses default ipKeyGenerator which handles IPv6 normalization correctly
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/v1/health';
  },
});

// B2B Portal rate limiter: higher limit for business customers browsing catalog
// Default 300 requests per 15 minutes (3x global) — configurable via RATE_LIMIT_B2B_MAX
export const b2bApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_B2B_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests to B2B portal, please try again later.',
  },
  // Uses default ipKeyGenerator which handles IPv6 normalization correctly
});

// Strict login rate limiter: 5 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many login attempts, please try again after 15 minutes.',
  },
  // Uses default ipKeyGenerator which handles IPv6 normalization correctly
});

// Auth endpoints rate limiter: 10 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many authentication attempts, please try again later.',
  },
});

// API write operations limiter: 30 write operations per minute
export const writeOperationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many write operations, please slow down.',
  },
  skip: (req: Request) => {
    return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  },
});
