import Joi from 'joi';

export const createTemplateSchema = Joi.object({
  name: Joi.string().required().min(3).max(255),
  description: Joi.string().required().min(10).max(1000),
  entityType: Joi.string().required().min(3).max(100),
  steps: Joi.array()
    .required()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        order: Joi.number().required().min(0),
        type: Joi.string().valid('sequential', 'parallel').required(),
        approvers: Joi.array()
          .required()
          .items(
            Joi.object({
              id: Joi.string().required(),
              type: Joi.string().valid('user', 'role').required(),
              value: Joi.string().required(),
            }),
          ),
        requireAll: Joi.boolean().required(),
        timeout: Joi.number().optional(),
        escalationRule: Joi.object({
          escalateAfterMinutes: Joi.number().required(),
          escalateTo: Joi.string().required(),
          notifyInterval: Joi.number().required(),
        }).optional(),
        conditions: Joi.array().optional(),
      }),
    )
    .min(1),
});

export const updateTemplateSchema = Joi.object({
  name: Joi.string().optional().min(3).max(255),
  description: Joi.string().optional().min(10).max(1000),
  steps: Joi.array().optional(),
  isActive: Joi.boolean().optional(),
});

export const createInstanceSchema = Joi.object({
  templateId: Joi.string().required(),
  entityType: Joi.string().required().min(3).max(100),
  entityId: Joi.string().required(),
  metadata: Joi.object().optional(),
});

export const approveSchema = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required(),
  comment: Joi.string().optional().max(1000),
});

export const escalateSchema = Joi.object({
  reason: Joi.string().required().min(5).max(1000),
});

export const delegateSchema = Joi.object({
  toUserId: Joi.string().required(),
  reason: Joi.string().optional().max(1000),
  expiresAt: Joi.date().required(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().default(1).min(1),
  limit: Joi.number().default(20).min(1).max(100),
});
