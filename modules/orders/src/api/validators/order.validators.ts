import Joi from 'joi';

export const createOrderSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  customer_name: Joi.string().max(255).required(),
  customer_email: Joi.string().email().required(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        sku: Joi.string().max(100).required(),
        product_name: Joi.string().max(255).required(),
        quantity: Joi.number().positive().required(),
        unit_price: Joi.number().positive().required(),
        source_warehouse_id: Joi.string().uuid().optional(),
      })
    )
    .min(1)
    .required(),
  billing_address: Joi.object().optional(),
  shipping_address: Joi.object().optional(),
  discount_amount: Joi.number().min(0).optional(),
  shipping_cost: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).optional(),
  payment_terms: Joi.string().max(50).optional(),
  notes: Joi.string().optional(),
});

export const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ON_HOLD')
    .required(),
  notes: Joi.string().optional(),
});

export const listOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().optional(),
  customerId: Joi.string().uuid().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  search: Joi.string().optional(),
});

export const partialDeliverySchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        item_id: Joi.string().uuid().required(),
        quantity_delivered: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),
});

export const cancelOrderSchema = Joi.object({
  reason: Joi.string().required(),
});

export function validateRequest(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    req.validatedBody = value;
    next();
  };
}
