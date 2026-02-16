import Joi from 'joi';

export const createPurchaseOrderSchema = Joi.object({
  vendorId: Joi.string().uuid().required(),
  vendorName: Joi.string().required(),
  vendorCode: Joi.string().required(),
  requisitionId: Joi.string().uuid().optional(),
  issuedDate: Joi.date().iso().required(),
  requiredByDate: Joi.date().iso().required(),
  paymentTermsId: Joi.string().uuid().optional(),
  paymentTerms: Joi.string().optional(),
  incoTerms: Joi.string().optional(),
  shippingDetails: Joi.object({
    addressId: Joi.string().uuid().required(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().required(),
    deliveryInstructions: Joi.string().optional(),
  }).required(),
  contact: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    department: Joi.string().required(),
  }).required(),
  currency: Joi.string().length(3).required(),
  taxAmount: Joi.number().precision(2).default(0),
  shippingCost: Joi.number().precision(2).default(0),
  discountAmount: Joi.number().precision(2).default(0),
  discountPercentage: Joi.number().precision(2).default(0),
  notes: Joi.string().optional(),
  internalNotes: Joi.string().optional(),
  createdBy: Joi.string().uuid().required(),
  lines: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        productCode: Joi.string().required(),
        productName: Joi.string().required(),
        description: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().required(),
        unitPrice: Joi.number().precision(2).positive().required(),
        taxRate: Joi.number().precision(2).default(0),
        notes: Joi.string().optional(),
        glAccountCode: Joi.string().optional(),
        costCenter: Joi.string().optional(),
      })
    )
    .min(1)
    .required(),
});

export const approvePurchaseOrderSchema = Joi.object({
  poId: Joi.string().uuid().required(),
  approvedBy: Joi.string().uuid().required(),
});

export const sendPurchaseOrderSchema = Joi.object({
  poId: Joi.string().uuid().required(),
  comments: Joi.string().optional(),
});

export const amendPurchaseOrderSchema = Joi.object({
  poId: Joi.string().uuid().required(),
  changes: Joi.object().required(),
  reason: Joi.string().required(),
  amendedBy: Joi.string().uuid().required(),
});

export const updatePOLineSchema = Joi.object({
  poId: Joi.string().uuid().required(),
  lineId: Joi.string().uuid().required(),
  updates: Joi.object({
    quantity: Joi.number().positive().optional(),
    unitPrice: Joi.number().precision(2).positive().optional(),
    taxRate: Joi.number().precision(2).optional(),
    notes: Joi.string().optional(),
  }).required(),
});
