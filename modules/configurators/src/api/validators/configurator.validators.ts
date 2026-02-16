import Joi from 'joi';

/**
 * Schema for creating a new configurator session
 */
export const createSessionSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  customer_id: Joi.string().uuid().optional(),
  currency: Joi.string().length(3).optional(),
  notes: Joi.string().optional(),
});

/**
 * Schema for adding a component to session
 */
export const addComponentSchema = Joi.object({
  component_id: Joi.string().uuid().required(),
  component_type: Joi.string().max(100).required(),
  quantity: Joi.number().positive().default(1),
  configuration: Joi.object().optional(),
  metadata: Joi.object().optional(),
});

/**
 * Schema for updating a component in session
 */
export const updateComponentSchema = Joi.object({
  quantity: Joi.number().positive().optional(),
  configuration: Joi.object().optional(),
  metadata: Joi.object().optional(),
});

/**
 * Schema for validating configuration
 */
export const validateConfigurationSchema = Joi.object({
  strict_mode: Joi.boolean().default(false),
});

/**
 * Schema for calculating price
 */
export const calculatePriceSchema = Joi.object({
  apply_discounts: Joi.boolean().default(true),
  include_taxes: Joi.boolean().default(true),
  customer_id: Joi.string().uuid().optional(),
});

/**
 * Schema for completing configuration
 */
export const completeConfigurationSchema = Joi.object({
  save_as_template: Joi.boolean().default(false),
  template_name: Joi.string().max(255).when('save_as_template', {
    is: true,
    then: Joi.required(),
  }),
  customer_notes: Joi.string().optional(),
});

/**
 * Schema for converting to quote
 */
export const convertToQuoteSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  quote_validity_days: Joi.number().integer().min(1).default(30),
  notes: Joi.string().optional(),
});

/**
 * Schema for catalog retrieval query
 */
export const getCatalogSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().optional(),
  filter: Joi.object().optional(),
});

/**
 * Validation middleware factory
 * Creates middleware that validates request body against schema
 */
export function validationMiddleware(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: messages,
      });
    }

    req.validatedBody = value;
    next();
  };
}

/**
 * Validation middleware for query parameters
 */
export function queryValidationMiddleware(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: messages,
      });
    }

    req.validatedQuery = value;
    next();
  };
}
