/**
 * Global Error Handler Middleware
 * Handles all errors across the application with consistent error responses
 */

import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../../shared/errors/BaseError';
import logger from '../../shared/utils/logger';

/**
 * Express error handler middleware
 * Catches and formats all errors consistently
 *
 * @param err - The error object
 * @param req - Express request object
 * @param res - Express response object
 * @param _next - Express next function (unused but required by Express)
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle BaseError subclasses
  if (err instanceof BaseError) {
    const baseError = err as BaseError;
    logger.warn(
      `[${baseError.code}] ${baseError.message}`,
      {
        statusCode: baseError.statusCode,
        path: req.path,
        method: req.method,
        code: baseError.code,
      }
    );

    res.status(baseError.statusCode).json({
      error: {
        code: baseError.code,
        message: baseError.message,
        statusCode: baseError.statusCode,
      },
    });
    return;
  }

  // Handle unexpected errors
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    url: req.url,
  });

  // Return generic error message in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      statusCode: 500,
    },
  });
}

/**
 * Async error wrapper for Express route handlers
 * Catches errors in async route handlers and passes them to error handler
 *
 * @param fn - Express route handler function
 * @returns Wrapped function that catches errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
