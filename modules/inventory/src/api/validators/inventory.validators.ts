import Joi from 'joi';

export const checkStockSchema = Joi.object({
  productIds: Joi.array()
    .items(Joi.string().uuid().required())
    .min(1)
    .max(100)
    .required(),
});

export const reserveStockSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
        warehouse_id: Joi.string().uuid().required(),
      }).required(),
    )
    .min(1)
    .max(100)
    .required(),
  expiresAt: Joi.date().iso().min('now').required(),
});

export const adjustStockSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  warehouseId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().required(),
  reason: Joi.string().max(500).required(),
});

export const getMovementsSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  offset: Joi.number().integer().min(0).optional(),
});
