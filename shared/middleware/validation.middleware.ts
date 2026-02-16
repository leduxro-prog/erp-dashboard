/**
 * Validation Middleware
 * Provides reusable validation middleware for request body, query params, and path params
 * Uses Joi schemas for consistent validation across all modules
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('validation-middleware');

/**
 * Validation error response
 */
export interface ValidationErrorResponse {
  error: string;
  message: string;
  details: Array<{
    field: string;
    message: string;
  }>;
  statusCode: number;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  context?: Record<string, any>;
}

/**
 * Format Joi validation error
 */
function formatValidationError(error: Joi.ValidationError): ValidationErrorResponse {
  const details = error.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message,
  }));

  return {
    error: 'Validation Error',
    message: `Request validation failed: ${error.message}`,
    details,
    statusCode: 400,
  };
}

/**
 * Create body validation middleware
 * Validates request body against Joi schema
 *
 * @param schema - Joi schema to validate against
 * @param options - Validation options
 * @returns Express middleware
 *
 * @example
 * router.post('/orders', validateBody(createOrderSchema), handler);
 */
export function validateBody(schema: Joi.Schema, options: ValidationOptions = {}) {
  const validationOptions: Joi.ValidationOptions = {
    stripUnknown: options.stripUnknown ?? true,
    abortEarly: options.abortEarly ?? false,
    presence: 'required',
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, validationOptions);

    if (error) {
      logger.warn('Body validation failed', {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      res.status(400).json(formatValidationError(error));
      return;
    }

    // Replace body with validated/sanitized value
    req.body = value;
    (req as any).validatedBody = value;
    next();
  };
}

/**
 * Create query parameters validation middleware
 * Validates request query string against Joi schema
 *
 * @param schema - Joi schema to validate against
 * @param options - Validation options
 * @returns Express middleware
 *
 * @example
 * router.get('/orders', validateQuery(listOrdersQuerySchema), handler);
 */
export function validateQuery(schema: Joi.Schema, options: ValidationOptions = {}) {
  const validationOptions: Joi.ValidationOptions = {
    stripUnknown: options.stripUnknown ?? true,
    abortEarly: options.abortEarly ?? false,
    presence: 'optional',
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, validationOptions);

    if (error) {
      logger.warn('Query validation failed', {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      res.status(400).json(formatValidationError(error));
      return;
    }

    // Replace query with validated/sanitized value
    req.query = value as any;
    (req as any).validatedQuery = value;
    next();
  };
}

/**
 * Create path parameters validation middleware
 * Validates request URL parameters against Joi schema
 *
 * @param schema - Joi schema to validate against
 * @param options - Validation options
 * @returns Express middleware
 *
 * @example
 * router.get('/orders/:id', validateParams(getOrderParamsSchema), handler);
 */
export function validateParams(schema: Joi.Schema, options: ValidationOptions = {}) {
  const validationOptions: Joi.ValidationOptions = {
    stripUnknown: options.stripUnknown ?? true,
    abortEarly: options.abortEarly ?? false,
    presence: 'required',
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, validationOptions);

    if (error) {
      logger.warn('Params validation failed', {
        path: req.path,
        method: req.method,
        error: error.message,
      });

      res.status(400).json(formatValidationError(error));
      return;
    }

    // Replace params with validated/sanitized value
    req.params = value as any;
    next();
  };
}

/**
 * Create combined validation middleware
 * Validates body, query, and params together
 *
 * @param schemas - Object containing body, query, and params schemas
 * @param options - Validation options
 * @returns Express middleware
 *
 * @example
 * router.put('/orders/:id', validateRequest({
 *   params: updateOrderParamsSchema,
 *   body: updateOrderBodySchema,
 *   query: updateOrderQuerySchema
 * }), handler);
 */
export function validateRequest(
  schemas: {
    body?: Joi.Schema;
    query?: Joi.Schema;
    params?: Joi.Schema;
  },
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Validate body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        stripUnknown: options.stripUnknown ?? true,
        abortEarly: options.abortEarly ?? false,
      });

      if (error) {
        logger.warn('Request body validation failed', {
          path: req.path,
          error: error.message,
        });
        res.status(400).json(formatValidationError(error));
        return;
      }

      req.body = value;
    }

    // Validate query
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        stripUnknown: options.stripUnknown ?? true,
        abortEarly: options.abortEarly ?? false,
      });

      if (error) {
        logger.warn('Request query validation failed', {
          path: req.path,
          error: error.message,
        });
        res.status(400).json(formatValidationError(error));
        return;
      }

      req.query = value as any;
    }

    // Validate params
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        stripUnknown: options.stripUnknown ?? true,
        abortEarly: options.abortEarly ?? false,
      });

      if (error) {
        logger.warn('Request params validation failed', {
          path: req.path,
          error: error.message,
        });
        res.status(400).json(formatValidationError(error));
        return;
      }

      req.params = value as any;
    }

    next();
  };
}

/**
 * Common schema patterns for reuse
 */
export const CommonSchemas = {
  /**
   * Pagination query schema
   */
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),

  /**
   * Sorting query schema
   */
  sorting: Joi.object({
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc').optional(),
  }),

  /**
   * Filtering query schema (basic)
   */
  filtering: Joi.object({
    search: Joi.string().max(255).optional(),
    status: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),

  /**
   * ID parameter schema
   */
  idParam: Joi.object({
    id: Joi.alternatives()
      .try(
        Joi.number().integer().positive(),
        Joi.string().guid({ version: 'uuidv4' })
      )
      .required(),
  }),

  /**
   * UUID parameter schema
   */
  uuidParam: Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required(),
  }),
};
