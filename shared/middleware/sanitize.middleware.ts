import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Regular expressions for detecting dangerous patterns
 */
const SCRIPT_TAG_REGEX = /<script[^>]*>[\s\S]*?<\/script>/gi;
const IMG_ONERROR_REGEX = /<img[^>]*onerror[^>]*>/gi;
const EVENT_HANDLER_REGEX = /on\w+\s*=/gi;
const MONGODB_OPERATOR_REGEX = /^\$/;
const DANGEROUS_KEYS_REGEX = /^(__proto__|constructor|prototype)$/;
const MAX_STRING_LENGTH = 10000;

/**
 * Recursively sanitizes a value
 *
 * @param value - Value to sanitize
 * @param path - Current path in object (for logging)
 * @returns Sanitized value
 */
function sanitizeValue(value: any, path: string = ''): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Handle strings
  if (typeof value === 'string') {
    let sanitized = value;

    // Remove HTML/script tags
    sanitized = sanitized.replace(SCRIPT_TAG_REGEX, '');
    sanitized = sanitized.replace(IMG_ONERROR_REGEX, '');
    sanitized = sanitized.replace(EVENT_HANDLER_REGEX, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Check length
    if (sanitized.length > MAX_STRING_LENGTH) {
      logger.warn('String value exceeds maximum length', {
        path,
        length: sanitized.length,
        maxLength: MAX_STRING_LENGTH,
      });
      sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
    }

    return sanitized;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
  }

  // Handle objects
  if (typeof value === 'object') {
    const sanitized: Record<string, any> = {};

    for (const [key, val] of Object.entries(value)) {
      // Check for dangerous prototype pollution keys
      if (DANGEROUS_KEYS_REGEX.test(key)) {
        logger.warn('Dangerous key detected and removed', {
          path,
          key,
        });
        continue;
      }

      // Check for MongoDB-style operators
      if (MONGODB_OPERATOR_REGEX.test(key)) {
        logger.warn('MongoDB operator detected and removed', {
          path,
          key,
        });
        continue;
      }

      // Recursively sanitize nested values
      sanitized[key] = sanitizeValue(val, `${path}.${key}`);
    }

    return sanitized;
  }

  return value;
}

/**
 * Input sanitization middleware for Express
 *
 * Deep sanitizes all string values in req.body, req.query, and req.params:
 * - Strips HTML/script tags (XSS prevention)
 * - Trims whitespace from strings
 * - Prevents prototype pollution (__proto__, constructor, prototype)
 * - Rejects MongoDB-style operators ($regex, $eq, etc.)
 * - Limits string length to 10000 chars
 * - Recursively handles nested objects and arrays
 *
 * Skips sanitization for multipart/form-data (file uploads)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip sanitization for file uploads
  const contentType = req.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body, 'body');
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query, 'query');
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params, 'params');
    }

    next();
  } catch (error) {
    logger.error('Error during input sanitization', {
      error: error instanceof Error ? error.message : String(error),
      url: req.url,
      method: req.method,
    });

    // Reject request if sanitization fails - do not pass unsanitized input
    res.status(400).json({ error: 'Invalid input data' });
    return;
  }
}

export default sanitizeMiddleware;
