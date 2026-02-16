import Joi from 'joi';

/**
 * Address schema - accepts both object and string formats
 */
const addressSchema = Joi.alternatives().try(
  Joi.object({
    street: Joi.string().max(255).required(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).optional(),
    postal_code: Joi.string().max(20).required(),
    country: Joi.string().max(100).required(),
  }),
  Joi.string().max(500).allow('').optional()
);

/**
 * Schema for B2B customer registration
 */
export const registerB2BCustomerSchema = Joi.object({
  company_name: Joi.string().max(255).required(),
  company_registration_number: Joi.string().max(100).required(),
  reg_com_number: Joi.string().max(100).allow('').optional(),
  industry: Joi.string().max(100).allow('').optional(),
  contact_name: Joi.string().max(255).required(),
  contact_email: Joi.string().email().required(),
  contact_phone: Joi.string().max(20).allow('').optional(),
  billing_address: addressSchema.required(),
  shipping_address: addressSchema.optional(),
  requested_credit_limit: Joi.number().positive().optional(),
  requested_tier: Joi.string().valid('STANDARD', 'PREMIUM', 'ENTERPRISE').optional(),
  payment_terms: Joi.number().integer().positive().optional(),
  tax_id: Joi.string().max(50).allow('').optional(),
  bank_name: Joi.string().max(255).allow('').optional(),
  iban: Joi.string().max(50).allow('').optional(),
  notes: Joi.string().allow('').optional(),
});

/**
 * Schema for listing B2B registrations (admin)
 */
export const listRegistrationsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string()
    .valid('PENDING', 'APPROVED', 'REJECTED')
    .optional(),
  search: Joi.string().optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().optional(),
});

/**
 * Schema for reviewing B2B registration (admin)
 */
export const reviewRegistrationSchema = Joi.object({
  status: Joi.string()
    .valid('APPROVED', 'REJECTED')
    .required(),
  approved_credit_limit: Joi.number().positive().when('status', {
    is: 'APPROVED',
    then: Joi.required(),
  }),
  rejection_reason: Joi.string().when('status', {
    is: 'REJECTED',
    then: Joi.required(),
  }),
  notes: Joi.string().optional(),
});

/**
 * Schema for listing B2B customers
 */
export const listCustomersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().optional(),
  industry: Joi.string().optional(),
  status: Joi.string().optional(),
});

/**
 * Schema for adjusting customer credit limit
 */
export const adjustCreditLimitSchema = Joi.object({
  new_credit_limit: Joi.number().positive().required(),
  reason: Joi.string().optional(),
});

/**
 * Schema for creating a saved cart
 */
export const createSavedCartSchema = Joi.object({
  cart_name: Joi.string().max(255).required(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        sku: Joi.string().max(100).required(),
        quantity: Joi.number().positive().required(),
        unit_price: Joi.number().positive().optional(),
      }),
    )
    .min(1)
    .required(),
  notes: Joi.string().optional(),
});

/**
 * Schema for listing saved carts
 */
export const listSavedCartsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  customer_id: Joi.string().uuid().optional(),
});

/**
 * Schema for converting cart to order
 */
export const convertCartToOrderSchema = Joi.object({
  purchase_order_number: Joi.string().max(100).optional(),
  notes: Joi.string().optional(),
  shipping_address: addressSchema.optional(),
});

/**
 * Schema for creating bulk order
 */
export const createBulkOrderSchema = Joi.object({
  customer_id: Joi.alternatives().try(Joi.string().uuid(), Joi.number().integer()).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.alternatives().try(Joi.string().uuid(), Joi.number().integer()).required(),
        sku: Joi.string().max(100).optional(),
        quantity: Joi.number().positive().required(),
        unit_price: Joi.number().positive().optional(),
      }),
    )
    .min(1)
    .required(),
  purchase_order_number: Joi.string().max(100).optional(),
  notes: Joi.string().optional(),
  shipping_address: addressSchema.optional(),
});

/**
 * Schema for listing bulk orders
 */
export const listBulkOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  customer_id: Joi.alternatives().try(Joi.string().uuid(), Joi.number().integer()).optional(),
  status: Joi.string().optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().optional(),
});

/**
 * Validation middleware factory
 */
export function validationMiddleware(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail) => detail.message),
      });
    }

    req.body = value;
    next();
  };
}

/**
 * Query validation middleware factory
 */
export function queryValidationMiddleware(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail) => detail.message),
      });
    }

    req.query = value;
    next();
  };
}
