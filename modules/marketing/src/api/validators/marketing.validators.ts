import Joi from 'joi';

/**
 * Campaign creation schema
 */
export const createCampaignSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  campaign_type: Joi.string()
    .valid('EMAIL', 'SMS', 'SOCIAL', 'PUSH', 'DISPLAY', 'AFFILIATE')
    .required(),
  status: Joi.string()
    .valid('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')
    .optional()
    .default('DRAFT'),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  budget: Joi.number().positive().optional(),
  target_audience: Joi.object({
    age_range: Joi.object({
      min: Joi.number().optional(),
      max: Joi.number().optional(),
    }).optional(),
    regions: Joi.array().items(Joi.string()).optional(),
    interests: Joi.array().items(Joi.string()).optional(),
    segments: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  channels: Joi.array().items(Joi.string()).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  metadata: Joi.object().optional(),
});

/**
 * Campaign update schema
 */
export const updateCampaignSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  description: Joi.string().optional(),
  budget: Joi.number().positive().optional(),
  target_audience: Joi.object().optional(),
  channels: Joi.array().items(Joi.string()).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  metadata: Joi.object().optional(),
});

/**
 * Campaign activation/pause schema
 */
export const campaignActionSchema = Joi.object({
  reason: Joi.string().optional(),
  notes: Joi.string().optional(),
});

/**
 * Email sequence schemas
 */
export const createEmailSequenceSchema = Joi.object({
  campaign_id: Joi.string().required(),
  name: Joi.string().max(255).required(),
  trigger_event: Joi.string().required(),
  steps: Joi.array()
    .items(
      Joi.object({
        order: Joi.number().integer().min(0).required(),
        delay_days: Joi.number().integer().min(0).optional(),
        delay_hours: Joi.number().integer().min(0).max(23).optional(),
        template_id: Joi.string().required(),
        subject: Joi.string().max(255).optional(),
        body: Joi.string().required(),
        condition: Joi.string()
          .valid('IF_OPENED_PREVIOUS', 'IF_NOT_OPENED', 'IF_CLICKED', 'ALWAYS')
          .optional(),
      }),
    )
    .min(1)
    .required(),
});

export const listEmailSequencesSchema = Joi.object({
  campaign_id: Joi.string().optional(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED').optional(),
  trigger_event: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const updateEmailSequenceSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED').optional(),
  steps: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        order: Joi.number().integer().min(0).required(),
        delay_days: Joi.number().integer().min(0).optional(),
        delay_hours: Joi.number().integer().min(0).max(23).optional(),
        condition: Joi.string()
          .valid('IF_OPENED_PREVIOUS', 'IF_NOT_OPENED', 'IF_CLICKED', 'ALWAYS')
          .optional(),
      }),
    )
    .optional(),
});

export const deleteEmailSequenceSchema = Joi.object({});

/**
 * Campaign completion schema
 */
export const campaignCompletionSchema = Joi.object({
  notes: Joi.string().optional(),
  results: Joi.object().optional(),
});

/**
 * List campaigns schema
 */
export const listCampaignsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  status: Joi.string()
    .valid('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')
    .optional(),
  campaign_type: Joi.string().optional(),
  search: Joi.string().optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
});

/**
 * Discount code creation schema
 */
export const createDiscountCodeSchema = Joi.object({
  code: Joi.string().uppercase().alphanum().max(20).required(),
  discount_type: Joi.string()
    .valid('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO')
    .required(),
  discount_value: Joi.number().positive().required(),
  max_usage: Joi.number().positive().optional(),
  usage_limit_per_customer: Joi.number().positive().optional().default(1),
  minimum_order_value: Joi.number().positive().optional(),
  valid_from: Joi.date().required(),
  valid_until: Joi.date().required(),
  applicable_products: Joi.array().items(Joi.string().uuid()).optional(),
  applicable_categories: Joi.array().items(Joi.string()).optional(),
  excluded_products: Joi.array().items(Joi.string().uuid()).optional(),
  max_discount_amount: Joi.number().positive().optional(),
  campaign_id: Joi.string().uuid().optional(),
  description: Joi.string().optional(),
  is_stackable: Joi.boolean().optional().default(false),
});

/**
 * Bulk discount code generation schema
 */
export const bulkDiscountCodeSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(10000).required(),
  code_prefix: Joi.string().uppercase().alphanum().max(10).required(),
  discount_type: Joi.string()
    .valid('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO')
    .required(),
  discount_value: Joi.number().positive().required(),
  max_usage: Joi.number().positive().optional(),
  usage_limit_per_customer: Joi.number().positive().optional().default(1),
  minimum_order_value: Joi.number().positive().optional(),
  valid_from: Joi.date().required(),
  valid_until: Joi.date().required(),
  campaign_id: Joi.string().uuid().optional(),
});

/**
 * List discount codes schema
 */
export const listDiscountCodesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  code: Joi.string().optional(),
  campaign_id: Joi.string().uuid().optional(),
  status: Joi.string().valid('ACTIVE', 'EXPIRED', 'USED_UP', 'INACTIVE').optional(),
  search: Joi.string().optional(),
});

/**
 * Validate discount code schema
 */
export const validateDiscountCodeSchema = Joi.object({
  code: Joi.string().uppercase().alphanum().required(),
  order_value: Joi.number().positive().required(),
  product_ids: Joi.array().items(Joi.string().uuid()).optional(),
  customer_id: Joi.string().uuid().optional(),
});

/**
 * Apply discount code schema
 */
export const applyDiscountCodeSchema = Joi.object({
  code: Joi.string().uppercase().alphanum().required(),
  order_id: Joi.string().uuid().required(),
  customer_id: Joi.string().uuid().optional(),
});

// ─── WS-A: Campaign Orchestrator Validators ──────────────────

/**
 * Add campaign step schema
 */
export const addCampaignStepSchema = Joi.object({
  step_type: Joi.string()
    .valid(
      'SEND_EMAIL',
      'SEND_SMS',
      'SEND_WHATSAPP',
      'SEND_PUSH',
      'WAIT',
      'CONDITION',
      'SPLIT',
      'WEBHOOK',
    )
    .required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  channel: Joi.string().valid('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'SOCIAL', 'DISPLAY').optional(),
  template_id: Joi.string().max(255).optional(),
  template_data: Joi.object().optional(),
  delay_minutes: Joi.number().integer().min(0).optional().default(0),
  condition_rules: Joi.object().optional(),
  split_config: Joi.object().optional(),
  webhook_url: Joi.string().uri().max(512).optional(),
  metadata: Joi.object().optional(),
});

/**
 * Preview audience schema
 */
export const previewAudienceSchema = Joi.object({
  segment_id: Joi.string().uuid().optional(),
  filter_criteria: Joi.object({
    tiers: Joi.array().items(Joi.string()).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    min_purchase_history_days: Joi.number().integer().min(0).optional(),
    min_total_spent: Joi.number().min(0).optional(),
    max_total_spent: Joi.number().min(0).optional(),
    purchased_categories: Joi.array().items(Joi.string()).optional(),
    regions: Joi.array().items(Joi.string()).optional(),
    consented_channels: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  channels: Joi.array().items(Joi.string()).optional(),
});

/**
 * Schedule campaign schema
 */
export const scheduleCampaignSchema = Joi.object({
  scheduled_at: Joi.date().iso().required(),
  timezone: Joi.string().max(100).optional().default('Europe/Bucharest'),
});

/**
 * Get campaign deliveries schema (query params)
 */
export const getCampaignDeliveriesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  status: Joi.string()
    .valid(
      'QUEUED',
      'SENDING',
      'SENT',
      'DELIVERED',
      'OPENED',
      'CLICKED',
      'BOUNCED',
      'FAILED',
      'UNSUBSCRIBED',
      'RETRYING',
    )
    .optional(),
  channel: Joi.string().valid('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'SOCIAL', 'DISPLAY').optional(),
});

// ─── WS-D: Attribution Analytics Validators ──────────────────

/**
 * Get attribution analytics schema (query params)
 */
export const getAttributionAnalyticsSchema = Joi.object({
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  campaign_id: Joi.string().uuid().optional(),
  channel: Joi.string().valid('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'SOCIAL', 'DISPLAY').optional(),
  group_by: Joi.string().valid('channel', 'campaign').optional(),
});

/**
 * Get funnel analytics schema (query params)
 */
export const getFunnelAnalyticsSchema = Joi.object({
  campaign_id: Joi.string().uuid().required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
});

/**
 * Validation middleware for requests
 */
export function validateRequest(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    // Validate body
    const { error: bodyError, value: bodyValue } = schema.validate(req.body);
    if (bodyError) {
      return res.status(400).json({
        error: bodyError.details[0].message,
        code: 'VALIDATION_ERROR',
      });
    }
    req.validatedBody = bodyValue;

    // Validate query if applicable
    const queryError = schema.validate(req.query).error;
    if (queryError && req.method === 'GET') {
      return res.status(400).json({
        error: queryError.details[0].message,
        code: 'VALIDATION_ERROR',
      });
    }

    next();
  };
}
