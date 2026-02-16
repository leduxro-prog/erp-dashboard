import Joi from 'joi';

export const addFavoriteSchema = Joi.object({
  product_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Product ID must be a number',
      'any.required': 'Product ID is required'
    })
});

export const addAllToCartSchema = Joi.object({
  quantities: Joi.object().pattern(
    Joi.string().pattern(/^\d+$/),
    Joi.number().integer().min(1).max(1000)
  ).optional()
});
