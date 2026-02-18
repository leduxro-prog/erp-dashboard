import Joi from 'joi';

export const createInvoiceSchema = Joi.object({
  orderId: Joi.number().integer().positive().required(),
  customerName: Joi.string().min(2).max(255).required(),
  customerVat: Joi.string().min(5).max(20).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productName: Joi.string().min(2).max(255).required(),
        sku: Joi.string().min(1).max(50).required(),
        quantity: Joi.number().positive().required(),
        unitPrice: Joi.number().positive().required(),
        vatRate: Joi.number().min(0).max(1).required(),
      }),
    )
    .min(1)
    .required(),
  dueDate: Joi.date().iso().required(),
  series: Joi.string().optional().default('FL'),
  currency: Joi.string().optional().default('RON'),
});

export const createProformaSchema = Joi.object({
  orderId: Joi.number().integer().positive().required(),
  customerName: Joi.string().min(2).max(255).required(),
  customerVat: Joi.string().min(5).max(20).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productName: Joi.string().min(2).max(255).required(),
        sku: Joi.string().min(1).max(50).required(),
        quantity: Joi.number().positive().required(),
        unitPrice: Joi.number().positive().required(),
        vatRate: Joi.number().min(0).max(1).required(),
      }),
    )
    .min(1)
    .required(),
  dueDate: Joi.date().iso().required(),
  series: Joi.string().optional().default('PF'),
  currency: Joi.string().optional().default('RON'),
});

export const getInvoiceSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const getProformaSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const syncStockSchema = Joi.object({});

export const registerCatalogProductSchema = Joi.object({
  sku: Joi.string().trim().min(1).max(100).required(),
  name: Joi.string().trim().min(2).max(255).required(),
  price: Joi.number().positive().optional().default(1),
  currency: Joi.string().trim().length(3).optional().default('RON'),
  measuringUnit: Joi.string().trim().min(1).max(50).optional().default('buc'),
  isService: Joi.boolean().optional().default(false),
  isTaxIncluded: Joi.boolean().optional().default(true),
  taxName: Joi.string().trim().min(1).max(100).optional(),
  taxPercentage: Joi.number().min(0).max(100).optional(),
});

export const getWarehousesSchema = Joi.object({});

export const getInvoiceStatusSchema = Joi.object({
  invoiceId: Joi.string().required(),
});

export const markInvoicePaidSchema = Joi.object({
  invoiceId: Joi.number().integer().positive().required(),
  paidAmount: Joi.number().positive().required(),
  paymentDate: Joi.date().iso().required(),
});
