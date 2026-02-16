import Joi from 'joi';

/**
 * Schema for sending WhatsApp message
 */
export const sendMessageSchema = Joi.object({
  recipient_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  message_type: Joi.string()
    .valid('TEXT', 'IMAGE', 'DOCUMENT', 'TEMPLATE')
    .default('TEXT'),
  content: Joi.string().required(),
  media_url: Joi.string().uri().when('message_type', {
    is: Joi.string().valid('IMAGE', 'DOCUMENT'),
    then: Joi.required(),
  }),
  template_name: Joi.string().max(255).when('message_type', {
    is: 'TEMPLATE',
    then: Joi.required(),
  }),
  template_params: Joi.array().items(Joi.string()).when('message_type', {
    is: 'TEMPLATE',
    then: Joi.optional(),
  }),
  metadata: Joi.object().optional(),
});

/**
 * Schema for listing messages
 */
export const listMessagesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  conversation_id: Joi.string().uuid().optional(),
  phone_number: Joi.string().optional(),
  status: Joi.string()
    .valid('SENT', 'DELIVERED', 'READ', 'FAILED')
    .optional(),
  message_type: Joi.string().optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().optional(),
});

/**
 * Schema for WhatsApp webhook (from WhatsApp)
 */
export const webhookSchema = Joi.object({
  object: Joi.string().required(),
  entry: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        changes: Joi.array()
          .items(
            Joi.object({
              value: Joi.object({
                messaging_product: Joi.string().required(),
                metadata: Joi.object({
                  display_phone_number: Joi.string().required(),
                  phone_number_id: Joi.string().required(),
                }).optional(),
                messages: Joi.array().items(Joi.object()).optional(),
                statuses: Joi.array().items(Joi.object()).optional(),
              }).required(),
              field: Joi.string().required(),
            }),
          )
          .required(),
      }),
    )
    .required(),
});

/**
 * Schema for listing conversations
 */
export const listConversationsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string()
    .valid('ACTIVE', 'RESOLVED', 'ARCHIVED')
    .optional(),
  assigned_to: Joi.string().uuid().optional(),
  search: Joi.string().optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().optional(),
});

/**
 * Schema for assigning conversation
 */
export const assignConversationSchema = Joi.object({
  assigned_to: Joi.string().uuid().required(),
  priority: Joi.string()
    .valid('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    .default('MEDIUM'),
  notes: Joi.string().optional(),
});

/**
 * Schema for resolving conversation
 */
export const resolveConversationSchema = Joi.object({
  resolution_type: Joi.string()
    .valid('RESOLVED', 'CLOSED', 'ESCALATED')
    .required(),
  resolution_notes: Joi.string().optional(),
  resolution_time_minutes: Joi.number().positive().optional(),
  customer_satisfaction: Joi.number().integer().min(1).max(5).optional(),
});

/**
 * Schema for listing templates
 */
export const listTemplatesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().optional(),
  category: Joi.string().optional(),
  status: Joi.string()
    .valid('APPROVED', 'PENDING', 'REJECTED')
    .optional(),
});

/**
 * Schema for creating template
 */
export const createTemplateSchema = Joi.object({
  template_name: Joi.string().max(255).required(),
  category: Joi.string()
    .valid('MARKETING', 'NOTIFICATION', 'AUTHENTICATION', 'TRANSACTIONAL', 'OTP')
    .required(),
  content: Joi.string().required(),
  parameters: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string()
          .valid('TEXT', 'CURRENCY', 'DATE_TIME')
          .required(),
      }),
    )
    .optional(),
  language: Joi.string().default('en'),
  example_values: Joi.object().optional(),
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
