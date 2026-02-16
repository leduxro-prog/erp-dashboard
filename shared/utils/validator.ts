import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Reusable Joi validation schemas
export const idSchema = Joi.string().alphanum().length(24).required();

export const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .max(255)
  .required();

export const phoneSchema = Joi.string()
  .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
  .max(20)
  .allow('');

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  sortBy: Joi.string().pattern(/^[a-zA-Z0-9_]+$/),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
});

export const dateRangeSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
});

export const skuSchema = Joi.string()
  .pattern(/^[A-Z0-9\-_]+$/)
  .min(3)
  .max(50)
  .required();

export const moneySchema = Joi.number()
  .positive()
  .precision(2)
  .required();

/**
 * Validation schema specification for Express request validation.
 * Defines Joi schemas for different parts of the request.
 *
 * @example
 * const schema: ValidationSchema = {
 *   body: Joi.object({
 *     name: Joi.string().required(),
 *     email: Joi.string().email().required(),
 *   }),
 *   query: Joi.object({
 *     page: Joi.number().min(1).default(1),
 *   }),
 *   params: Joi.object({
 *     id: idSchema,
 *   }),
 * };
 *
 * @internal
 */
interface ValidationSchema {
  /** Schema for request body validation */
  body?: Joi.ObjectSchema;
  /** Schema for query parameters validation */
  query?: Joi.ObjectSchema;
  /** Schema for URL path parameters validation */
  params?: Joi.ObjectSchema;
}

/**
 * Express middleware factory to validate request body, query, and params.
 * Validates incoming requests against Joi schemas and returns 400 on validation failure.
 * Strips unknown properties (whitelist approach) and coerces types when safe.
 *
 * Validation process:
 * 1. Validates body if schema.body provided
 * 2. Validates query if schema.query provided
 * 3. Validates params if schema.params provided
 * 4. Returns structured errors if any validation fails
 * 5. Calls next() if all validations pass
 *
 * @param schema - Object containing Joi schemas for body, query, and params
 * @returns Express middleware function
 *
 * @example
 * // In route handler
 * router.post('/products', validateRequest({
 *   body: Joi.object({
 *     name: Joi.string().required().max(100),
 *     sku: skuSchema,
 *     price: moneySchema,
 *   }),
 * }), productController.create);
 *
 * @example
 * // Error response on validation failure
 * // Request: POST /products with body { price: -10 }
 * // Response: {
 * //   "success": false,
 * //   "message": "Validation error",
 * //   "errors": {
 * //     "body": ["name is required", "price must be positive"]
 * //   }
 * // }
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, string[]> = {};

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        errors.body = error.details.map((detail) => detail.message);
      } else {
        req.body = value;
      }
    }

    // Validate query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        errors.query = error.details.map((detail) => detail.message);
      } else {
        req.query = value;
      }
    }

    // Validate params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        errors.params = error.details.map((detail) => detail.message);
      } else {
        req.params = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    next();
  };
}

/**
 * Sanitize a string by trimming and removing XSS vectors.
 * Removes all HTML tags and potentially dangerous script content.
 * Suitable for user-generated content that will be stored and displayed.
 *
 * @param str - String to sanitize (non-strings return empty string)
 * @returns Sanitized string with HTML tags removed
 *
 * @example
 * const cleaned = sanitizeString('<script>alert("xss")</script>Hello');
 * // Returns: 'Hello'
 *
 * @example
 * const cleaned = sanitizeString('  test string  ');
 * // Returns: 'test string'
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }

  const trimmed = str.trim();
  const sanitized = DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });

  return sanitized;
}

/**
 * Sanitize an object's string properties recursively.
 * Traverses object tree and sanitizes all string values using sanitizeString().
 * Preserves object structure, arrays, and non-string values.
 * Creates new object (does not mutate input).
 *
 * @param obj - Object to sanitize (can contain nested objects and arrays)
 * @returns New object with all string values sanitized
 *
 * @example
 * const dirty = {
 *   name: '<script>alert("xss")</script>John',
 *   email: 'john@example.com',
 *   profile: {
 *     bio: '<img src=x onerror="alert()">Bio text',
 *     website: 'example.com',
 *   },
 *   tags: ['<b>tag1</b>', 'tag2'],
 * };
 * const clean = sanitizeObject(dirty);
 * // Returns:
 * // {
 * //   name: 'John',
 * //   email: 'john@example.com',
 * //   profile: {
 * //     bio: 'Bio text',
 * //     website: 'example.com',
 * //   },
 * //   tags: ['tag1', 'tag2'],
 * // }
 */
export function sanitizeObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === 'string') {
          return sanitizeString(item);
        }
        if (item !== null && typeof item === 'object') {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
