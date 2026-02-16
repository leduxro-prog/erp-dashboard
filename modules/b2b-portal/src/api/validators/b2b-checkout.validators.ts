import Joi from 'joi';

const addressSchema = Joi.object({
  street: Joi.string().max(255).required(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).optional(),
  postal_code: Joi.string().max(20).required(),
  country: Joi.string().max(100).default('Romania'),
});

export const checkoutAddressSchema = Joi.alternatives().try(
  addressSchema,
  Joi.string().max(500).allow('').optional()
);

export const createB2BOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.alternatives().try(Joi.string(), Joi.number().integer()).required(),
        sku: Joi.string().max(100).optional(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),
  shipping_address: checkoutAddressSchema.required(),
  billing_address: checkoutAddressSchema.optional(),
  use_different_billing: Joi.boolean().default(false),
  contact_name: Joi.string().max(255).required(),
  contact_phone: Joi.string().max(30).required(),
  payment_method: Joi.string().valid('CREDIT', 'TRANSFER', 'CASH').default('CREDIT'),
  notes: Joi.string().max(1000).allow('').optional(),
  purchase_order_number: Joi.string().max(100).allow('').optional(),
  save_address: Joi.boolean().default(false),
  address_label: Joi.string().max(100).when('save_address', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

export const validateStockSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.alternatives().try(Joi.string(), Joi.number().integer()).required(),
        quantity: Joi.number().integer().positive().required(),
      })
    )
    .min(1)
    .required(),
});

export const saveCustomerAddressSchema = Joi.object({
  label: Joi.string().max(100).required(),
  address: checkoutAddressSchema.required(),
  is_default: Joi.boolean().default(false),
  address_type: Joi.string().valid('shipping', 'billing', 'both').default('both'),
});
