import Joi from 'joi';

export const createThreeWayMatchSchema = Joi.object({
  poId: Joi.string().uuid().required(),
  grnId: Joi.string().uuid().required(),
  invoiceId: Joi.string().uuid().required(),
  matchedBy: Joi.string().uuid().required(),
  tolerances: Joi.object({
    quantityVariancePercent: Joi.number().precision(2).optional(),
    priceVariancePercent: Joi.number().precision(2).optional(),
    amountVarianceAmount: Joi.number().precision(2).optional(),
    amountVariancePercent: Joi.number().precision(2).optional(),
  }).optional(),
});

export const resolveExceptionSchema = Joi.object({
  matchId: Joi.string().uuid().required(),
  exceptionId: Joi.string().uuid().required(),
  action: Joi.string()
    .valid('approve', 'reject', 'request_vendor_adjustment')
    .required(),
  reason: Joi.string().required(),
  approvedBy: Joi.string().uuid().required(),
  adjustmentAmount: Joi.number().precision(2).optional(),
});
