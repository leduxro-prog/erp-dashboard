import * as Joi from 'joi';

export const supplierListSchema = Joi.object({
  activeOnly: Joi.boolean().optional(),
});

export const getSupplierProductsSchema = Joi.object({
  supplierId: Joi.number().integer().positive().required(),
  search: Joi.string().max(100).optional(),
  minStock: Joi.number().integer().min(0).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  limit: Joi.number().integer().min(1).max(500).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const createSkuMappingSchema = Joi.object({
  supplierId: Joi.number().integer().positive().required(),
  supplierSku: Joi.string().trim().min(1).max(100).required(),
  internalProductId: Joi.number().integer().positive().required(),
  internalSku: Joi.string().trim().min(1).max(100).required(),
});

export const deleteSkuMappingSchema = Joi.object({
  mappingId: Joi.number().integer().positive().required(),
});

export const placeSupplierOrderSchema = Joi.object({
  supplierId: Joi.number().integer().positive().required(),
  orderId: Joi.number().integer().positive().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        supplierSku: Joi.string().trim().min(1).required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

export const triggerSyncSchema = Joi.object({
  supplierId: Joi.number().integer().positive().optional(),
});

export const getSupplierOrdersSchema = Joi.object({
  supplierId: Joi.number().integer().positive().required(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const getUnmappedSkusSchema = Joi.object({
  supplierId: Joi.number().integer().positive().required(),
});
