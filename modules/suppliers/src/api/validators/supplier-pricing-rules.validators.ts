import * as Joi from 'joi';

const keySchema = Joi.string().trim().min(1).max(100).required();

export const supplierPricingRuleParamsSchema = Joi.object({
  supplierCode: keySchema,
  categoryKey: keySchema,
});

export const supplierPricingRulesBySupplierParamsSchema = Joi.object({
  supplierCode: keySchema,
});

export const createSupplierPricingRuleSchema = Joi.object({
  supplierCode: keySchema,
  categoryKey: keySchema,
  markupPercent: Joi.number().min(0).max(9999).required(),
  active: Joi.boolean().optional(),
});

export const upsertSupplierPricingRuleSchema = Joi.object({
  markupPercent: Joi.number().min(0).max(9999).required(),
  active: Joi.boolean().optional(),
});

export const setSupplierPricingRuleActiveSchema = Joi.object({
  active: Joi.boolean().required(),
});
