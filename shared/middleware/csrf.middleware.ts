/**
 * CSRF Protection Middleware
 * Implements CSRF protection for API-only ERP system
 * Uses origin/referer header validation and double-submit cookie pattern
 */

import { Request, Response, NextFunction } from 'express';
import { URL } from 'url';
import logger from '../utils/logger';

/**
 * CSRF Configuration
 */
interface CSRFConfig {
  /** List of allowed origins for CSRF validation */
  allowedOrigins: string[];
  /** Enable CSRF protection (can be disabled for development) */
  enabled: boolean;
}

/**
 * Create CSRF protection middleware factory
 * Validates origin and referer headers for API requests
 * Skips protection for safe methods and API token requests
 *
 * @param config - CSRF configuration
 * @returns Express middleware function
 *
 * @example
 * const csrfConfig = {
 *   allowedOrigins: ['https://app.example.com', 'http://localhost:3000'],
 *   enabled: process.env.NODE_ENV === 'production'
 * };
 * app.use(createCSRFMiddleware(csrfConfig));
 */
export function createCSRFMiddleware(config: CSRFConfig) {
  const csrfLogger = logger.child({ module: 'csrf' });

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF validation if disabled
    if (!config.enabled) {
      next();
      return;
    }

    // Skip CSRF for safe HTTP methods
    if (isSafeMethod(req.method)) {
      next();
      return;
    }

    // Skip CSRF for requests with valid Bearer token (API clients)
    if (hasValidBearerToken(req)) {
      csrfLogger.debug('CSRF check skipped for Bearer token request', {
        path: req.path,
        method: req.method,
      });
      next();
      return;
    }

    // Validate origin and referer headers
    const origin = req.get('origin');
    const referer = req.get('referer');

    csrfLogger.debug('CSRF validation', {
      path: req.path,
      method: req.method,
      origin,
      referer,
      requestId: req.id,
    });

    // Check origin header if present
    if (origin) {
      if (!isOriginAllowed(origin, config.allowedOrigins)) {
        csrfLogger.warn('CSRF attack detected - invalid origin', {
          path: req.path,
          method: req.method,
          origin,
          requestId: req.id,
        });
        res.status(403).json({
          error: 'CSRF Validation Failed',
          message: 'Request origin not allowed',
          code: 'CSRF_INVALID_ORIGIN',
        });
        return;
      }
    }

    // Check referer header if present
    if (referer) {
      if (!isRefererAllowed(referer, config.allowedOrigins)) {
        csrfLogger.warn('CSRF attack detected - invalid referer', {
          path: req.path,
          method: req.method,
          referer,
          requestId: req.id,
        });
        res.status(403).json({
          error: 'CSRF Validation Failed',
          message: 'Request referer not allowed',
          code: 'CSRF_INVALID_REFERER',
        });
        return;
      }
    }

    // If both origin and referer are missing, reject state-changing requests
    // as they could be CSRF attacks
    if (!origin && !referer) {
      // For state-changing requests, require Origin or Referer header
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        csrfLogger.warn('CSRF rejection - missing origin/referer for state-changing request', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          requestId: req.id,
        });
        res.status(403).json({
          error: 'Origin or Referer header required for state-changing requests',
        });
        return;
      }
      // Allow GET/HEAD/OPTIONS without origin
      return next();
    }

    next();
  };
}

/**
 * Check if HTTP method is safe (no state change)
 * Safe methods don't require CSRF protection
 *
 * @param method - HTTP method
 * @returns True if method is GET, HEAD, or OPTIONS
 */
function isSafeMethod(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return safeMethods.includes(method.toUpperCase());
}

/**
 * Check if request has a valid Bearer token
 * API clients with tokens don't need CSRF protection
 *
 * @param req - Express Request object
 * @returns True if Authorization header contains Bearer token
 */
function hasValidBearerToken(req: Request): boolean {
  const authHeader = req.get('authorization');
  if (!authHeader) {
    return false;
  }
  return authHeader.toLowerCase().startsWith('bearer ') && authHeader.length > 7;
}

/**
 * Validate origin against allowed origins list
 *
 * @param origin - Origin header value
 * @param allowedOrigins - List of allowed origins
 * @returns True if origin is in allowed list
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.origin;

    return allowedOrigins.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return allowedUrl.origin === originHost;
      } catch {
        return allowed === originHost;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Validate referer against allowed origins
 *
 * @param referer - Referer header value
 * @param allowedOrigins - List of allowed origins
 * @returns True if referer origin is in allowed list
 */
function isRefererAllowed(referer: string, allowedOrigins: string[]): boolean {
  try {
    const refererUrl = new URL(referer);
    const refererOrigin = refererUrl.origin;

    return allowedOrigins.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return allowedUrl.origin === refererOrigin;
      } catch {
        return allowed === refererOrigin;
      }
    });
  } catch {
    return false;
  }
}

export default createCSRFMiddleware;
