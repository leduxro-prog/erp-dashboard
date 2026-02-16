import Joi from 'joi';

export const getProductPricingSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
});

export const calculateOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required(),
      }),
    )
    .min(1)
    .required(),
  customerId: Joi.number().integer().positive().optional(),
});

export const getTierPricingSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
});

export const createPromotionSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
  promotionalPrice: Joi.number().positive().required(),
  validFrom: Joi.date().iso().required(),
  validUntil: Joi.date().iso().min(Joi.ref('validFrom')).required(),
  reason: Joi.string().max(255).optional(),
});

export const deactivatePromotionSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const listPromotionsSchema = Joi.object({
  page: Joi.number().integer().positive().default(1).optional(),
  limit: Joi.number().integer().positive().max(100).default(20).optional(),
});

export const validationMiddleware = (schema: Joi.Schema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(
      { ...req.params, ...req.query, ...req.body },
      {
        abortEarly: false,
        stripUnknown: true,
      },
    );

    if (error) {
      const messages = error.details.map(d => `${d.path.join('.')}: ${d.message}`);
      res.status(400).json({
        error: 'Validation error',
        details: messages,
      });
      return;
    }

    // Attach validated data to request
    req.validated = value;
    next();
  };
};
