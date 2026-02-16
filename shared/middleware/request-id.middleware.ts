/**
 * Request ID Correlation Middleware
 * Generates and attaches a unique request ID to each incoming request
 * for distributed tracing and request correlation across the system
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * Generates a unique request ID for distributed tracing
 * Uses UUID v4 format for uniqueness across the distributed system
 *
 * @returns A UUID v4 string
 */
function generateRequestId(): string {
  return uuidv4();
}

/**
 * Request ID middleware factory
 * Creates middleware that attaches a unique ID to each request
 * and passes it to the logging context for all subsequent logs
 *
 * @returns Express middleware function
 *
 * @example
 * app.use(createRequestIdMiddleware());
 */
export function createRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Generate unique request ID
    const requestId = generateRequestId();

    // Attach to request object for use in handlers and downstream middleware
    req.id = requestId;

    // Set X-Request-ID response header for client tracing
    res.setHeader('X-Request-ID', requestId);

    // Create child logger with request context
    const requestLogger = logger.child({ requestId });

    // Log request start
    requestLogger.debug('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Override res.json to log before response
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      requestLogger.debug('Outgoing response', {
        statusCode: res.statusCode,
        contentType: res.get('content-type'),
      });
      return originalJson(body);
    };

    // Continue to next middleware
    next();
  };
}

/**
 * Get the request ID from the current request
 * Useful for passing to async operations that lose request context
 *
 * @param req - Express Request object
 * @returns The request ID or undefined if not set
 *
 * @example
 * const requestId = getRequestId(req);
 */
export function getRequestId(req: Request): string | undefined {
  return req.id;
}

export default createRequestIdMiddleware;
