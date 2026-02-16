/**
 * RequestValidator Middleware
 * Enterprise-level request validation middleware for preventing common attacks
 * and ensuring request integrity.
 *
 * This middleware provides:
 * 1. Validates no customerId in payload (prevents IDOR)
 * 2. Schema validation for request body
 * 3. Input sanitization (XSS, SQL injection prevention)
 * 4. Type coercion and validation
 * 5. Size limits and constraints
 */

import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '@shared/utils/logger';
import { ValidationError } from '@shared/errors/BaseError';
import Joi from 'joi';
import { SecurityRequest, ValidationOptions } from '../types/AuthContext';

const logger = createModuleLogger('request-validator-middleware');

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  /** Field path with error */
  field: string;

  /** Error message */
  message: string;

  /** Error type */
  type: string;

  /** Provided value */
  value?: unknown;

  /** Allowed values (for enum type) */
  allowed?: unknown[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** Array of validation errors */
  errors: ValidationErrorDetail[];

  /** Sanitized data */
  sanitized?: Record<string, unknown>;
}

/**
 * Request validator options
 */
export interface RequestValidatorOptions {
  /** Fields to block from request body */
  blockedFields?: string[];

  /** Fields to validate as customer IDs (check against authenticated user) */
  customerIdFields?: string[];

  /** Whether to strip blocked fields (default: true) */
  stripBlockedFields?: boolean;

  /** Whether to sanitize input (default: true) */
  sanitizeInput?: boolean;

  /** Whether to detect SQL injection patterns during sanitization */
  checkSqlInjection?: boolean;

  /** Whether to detect XSS patterns during sanitization */
  checkXss?: boolean;

  /** Maximum request body size (default: '1mb') */
  maxBodySize?: string;

  /** Whether to validate content type */
  validateContentType?: string | boolean;

  /** Custom validation schema (Joi) */
  schema?: Joi.ObjectSchema;

  /** Custom validation function */
  customValidator?: (data: Record<string, unknown>, req: SecurityRequest) => ValidationResult;
}

/**
 * Default validator options
 */
const DEFAULT_VALIDATOR_OPTIONS: RequestValidatorOptions = {
  blockedFields: ['customer_id', 'customerId', 'b2b_customer_id', 'b2bCustomerId', 'user_id', 'userId'],
  customerIdFields: ['customer_id', 'customerId', 'b2b_customer_id', 'b2bCustomerId'],
  stripBlockedFields: true,
  sanitizeInput: true,
  checkSqlInjection: true,
  checkXss: true,
  maxBodySize: '1mb',
  validateContentType: false,
};

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION|SCRIPT)\b)/i,
  /(\'|\").*(\b(OR|AND)\b).*(\=|LIKE)/i,
  /(\-\-|;|\/\*|\*\/)/,
  /(\b(XP_|SP_)\w+)/i,
  /(\b(0x[0-9a-f]+)\b)/i,
];

/**
 * XSS patterns
 */
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>.*?<\/embed>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]+src=["']?javascript:/gi,
  /eval\s*\(/gi,
];

/**
 * Sanitize string value to prevent XSS
 *
 * @param value - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(value: string): string {
  let sanitized = value;

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>'"&]/g, char => {
    const replacements: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
      '&': '&amp;',
    };
    return replacements[char];
  });

  return sanitized;
}

/**
 * Check for SQL injection in string value
 *
 * @param value - String to check
 * @returns True if SQL injection detected
 */
export function detectSqlInjection(value: string): boolean {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for XSS in string value
 *
 * @param value - String to check
 * @returns True if XSS detected
 */
export function detectXss(value: string): boolean {
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Deep sanitize object
 *
 * @param obj - Object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object
 */
export function deepSanitize(
  obj: unknown,
  options: {
    sanitizeStrings?: boolean;
    checkSqlInjection?: boolean;
    checkXss?: boolean;
  } = {}
): unknown {
  const {
    sanitizeStrings = true,
    checkSqlInjection = true,
    checkXss = true,
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    let result = obj;

    if (sanitizeStrings) {
      result = sanitizeString(result);
    }

    if (checkSqlInjection && detectSqlInjection(result)) {
      logger.warn('SQL injection detected in request', { value: obj });
      throw new ValidationError('Potential SQL injection detected');
    }

    if (checkXss && detectXss(result)) {
      logger.warn('XSS detected in request', { value: obj });
      throw new ValidationError('Potential XSS attack detected');
    }

    return result;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item, options));
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Sanitize keys
    const sanitizedKey = sanitizeStrings ? sanitizeString(key) : key;
    const value = (obj as Record<string, unknown>)[key];

    result[sanitizedKey] = deepSanitize(value, options);
  }

  return result;
}

/**
 * Remove blocked fields from object
 *
 * @param obj - Object to clean
 * @param blockedFields - Array of field names to block
 * @returns Object with blocked fields removed
 */
export function removeBlockedFields(
  obj: Record<string, unknown>,
  blockedFields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (!blockedFields.includes(key)) {
      result[key] = obj[key];
    } else {
      logger.warn('Blocked field removed from request', {
        field: key,
      });
    }
  }

  return result;
}

/**
 * Validate request against Joi schema
 *
 * @param data - Data to validate
 * @param schema - Joi schema
 * @returns Validation result
 */
export function validateWithJoi(
  data: Record<string, unknown>,
  schema: Joi.ObjectSchema
): ValidationResult {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (!error) {
    return {
      isValid: true,
      errors: [],
      sanitized: value as Record<string, unknown>,
    };
  }

  const errors: ValidationErrorDetail[] = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type,
    value: detail.context?.value,
    allowed: detail.context?.valids,
  }));

  return {
    isValid: false,
    errors,
  };
}

/**
 * Request Validator Middleware Factory
 *
 * Creates middleware for validating and sanitizing requests.
 *
 * @param options - Validator options
 * @returns Express middleware function
 *
 * @example
 * // Basic validation with schema
 * app.post('/orders',
 *   validateRequest({
 *     schema: Joi.object({
 *       items: Joi.array().required(),
 *       shipping_address: Joi.string().required(),
 *     }),
 *   }),
 *   createOrderHandler
 * );
 *
 * // Prevent customer ID injection
 * app.use(validateRequest({
 *   customerIdFields: ['customer_id', 'customerId'],
 * }));
 *
 * // Custom validation
 * app.post('/checkout',
 *   validateRequest({
 *     customValidator: (data, req) => {
 *       // Custom validation logic
 *       return { isValid: true, errors: [] };
 *     },
 *   }),
 *   checkoutHandler
 * );
 */
export function validateRequest(options: Partial<RequestValidatorOptions> = {}) {
  const opts: RequestValidatorOptions = { ...DEFAULT_VALIDATOR_OPTIONS, ...options };

  return (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const requestId = (req as any).id || 'unknown';

    try {
      // Validate content type if specified
      if (opts.validateContentType) {
        const expectedType = typeof opts.validateContentType === 'string'
          ? opts.validateContentType
          : 'application/json';

        const contentType = req.get('content-type');

        if (!contentType || !contentType.includes(expectedType)) {
          logger.warn('Invalid content type', {
            requestId,
            expected: expectedType,
            received: contentType,
          });

          res.status(415).json({
            success: false,
            error: {
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: `Content type must be ${expectedType}`,
            },
          });
          return;
        }
      }

      // Process request body if present
      if (req.body && typeof req.body === 'object') {
        let data = { ...req.body };

        // Check for blocked fields
        if (opts.blockedFields && opts.stripBlockedFields) {
          data = removeBlockedFields(data, opts.blockedFields);
        }

        // Check for customer ID fields
        if (opts.customerIdFields && req.securityContext) {
          const authenticatedCustomerId =
            req.securityContext.realm === 'b2b'
              ? req.securityContext.b2bCustomerId
              : req.securityContext.customerId;

          for (const field of opts.customerIdFields) {
            if (field in data && data[field]) {
              const providedId = data[field];

              if (String(providedId) !== String(authenticatedCustomerId)) {
                logger.warn('Customer ID injection attempt detected', {
                  requestId,
                  field,
                  provided: providedId,
                  authenticated: authenticatedCustomerId,
                });

                // Block or strip based on configuration
                delete data[field];
              }
            }
          }
        }

        // Sanitize input
        if (opts.sanitizeInput) {
          data = deepSanitize(data, {
            sanitizeStrings: true,
            checkSqlInjection: opts.checkSqlInjection ?? true,
            checkXss: opts.checkXss ?? true,
          }) as Record<string, unknown>;
        }

        // Validate with schema if provided
        if (opts.schema) {
          const result = validateWithJoi(data, opts.schema);

          if (!result.isValid) {
            logger.warn('Request validation failed', {
              requestId,
              errors: result.errors,
            });

            res.status(400).json({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: result.errors,
              },
            });
            return;
          }

          // Use sanitized value from Joi
          data = result.sanitized!;
        }

        // Custom validation
        if (opts.customValidator) {
          const result = opts.customValidator(data, req);

          if (!result.isValid) {
            logger.warn('Custom validation failed', {
              requestId,
              errors: result.errors,
            });

            res.status(400).json({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: result.errors,
              },
            });
            return;
          }
        }

        // Update request body
        req.body = data;
      }

      // Validate query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = deepSanitize(req.query, {
          sanitizeStrings: true,
          checkSqlInjection: false, // Don't check SQL injection in query strings (may have valid patterns)
          checkXss: true,
        }) as any;
      }

      next();
    } catch (error) {
      logger.error('Request validation error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Request validation failed',
        },
      });
    }
  };
}

/**
 * Schema builder for common validations
 */
export const SchemaBuilder = {
  /**
   * Build cart item schema
   */
  cartItem: () => Joi.object({
    product_id: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).max(1000).required(),
    notes: Joi.string().max(500).allow('', null),
  }),

  /**
   * Build cart schema
   */
  cart: () => Joi.object({
    items: Joi.array().items(SchemaBuilder.cartItem()).min(1).max(100).required(),
  }),

  /**
   * Build checkout schema
   */
  checkout: () => Joi.object({
    items: Joi.array().items(SchemaBuilder.cartItem()).min(1).max(100).required(),
    shipping_address: Joi.object({
      street: Joi.string().max(200).required(),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100).allow(''),
      postal_code: Joi.string().max(20).required(),
      country: Joi.string().max(100).default('Romania'),
    }).required(),
    billing_address: Joi.object({
      street: Joi.string().max(200).required(),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100).allow(''),
      postal_code: Joi.string().max(20).required(),
      country: Joi.string().max(100).default('Romania'),
    }),
    use_different_billing: Joi.boolean().default(false),
    contact_name: Joi.string().max(100).required(),
    contact_phone: Joi.string().max(20).required(),
    payment_method: Joi.string().valid('CREDIT', 'TRANSFER', 'CASH').default('CREDIT'),
    notes: Joi.string().max(1000).allow('', null),
    purchase_order_number: Joi.string().max(50).allow('', null),
    save_address: Joi.boolean().default(false),
    address_label: Joi.string().max(50).allow('', null),
  }),

  /**
   * Build order query schema
   */
  orderQuery: () => Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid(
      'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
      'DELIVERED', 'CANCELLED', 'REFUNDED'
    ),
    date_from: Joi.date().iso(),
    date_to: Joi.date().iso().min(Joi.ref('date_from')),
  }),

  /**
   * Build credit schema
   */
  credit: () => Joi.object({
    amount: Joi.number().positive().max(1000000).required(),
    reference: Joi.string().max(100).required(),
    description: Joi.string().max(500).allow('', null),
  }),
};

/**
 * Prevent customer ID injection middleware
 * Specialized middleware to prevent customer_id from being sent in request body
 *
 * @example
 * app.use('/api/v1/cart', preventCustomerIdInjection());
 */
export function preventCustomerIdInjection() {
  return (req: SecurityRequest, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      next();
      return;
    }

    const customerIdFields = [
      'customer_id', 'customerId', 'b2b_customer_id', 'b2bCustomerId',
      'user_id', 'userId',
    ];

    let foundInvalidField = false;

    for (const field of customerIdFields) {
      if (field in req.body) {
        logger.warn('Customer ID injection attempt', {
          field,
          path: req.path,
          method: req.method,
        });
        delete req.body[field];
        foundInvalidField = true;
      }
    }

    if (foundInvalidField) {
      // Optionally log or notify security team
    }

    next();
  };
}
