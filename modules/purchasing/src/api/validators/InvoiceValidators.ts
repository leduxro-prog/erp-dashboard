import Joi from 'joi';

export const createInvoiceSchema = Joi.object({
  vendorId: Joi.string().uuid().required(),
  vendorName: Joi.string().required(),
  vendorInvoiceNumber: Joi.string().required(),
  vendorInvoiceDate: Joi.date().iso().required(),
  invoiceDate: Joi.date().iso().required(),
  poId: Joi.string().uuid().optional(),
  receivedDate: Joi.date().iso().required(),
  dueDate: Joi.date().iso().required(),
  paymentTermsId: Joi.string().uuid().optional(),
  paymentTerms: Joi.string().optional(),
  currency: Joi.string().length(3).required(),
  subtotalAmount: Joi.number().precision(2).positive().required(),
  taxAmount: Joi.number().precision(2).default(0),
  shippingAmount: Joi.number().precision(2).default(0),
  otherCharges: Joi.number().precision(2).default(0),
  discountAmount: Joi.number().precision(2).default(0),
  notes: Joi.string().optional(),
  internalNotes: Joi.string().optional(),
  registeredBy: Joi.string().uuid().required(),
  attachments: Joi.array().items(Joi.string()).optional(),
  lines: Joi.array()
    .items(
      Joi.object({
        poLineId: Joi.string().uuid().optional(),
        description: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().required(),
        unitPrice: Joi.number().precision(2).positive().required(),
        taxRate: Joi.number().precision(2).default(0),
        notes: Joi.string().optional(),
      })
    )
    .min(1)
    .required(),
});

export const disputeInvoiceSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  reason: Joi.string().required(),
});

export const resolveDisputeSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  resolution: Joi.string().required(),
});

export const recordPaymentSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  paidAmount: Joi.number().precision(2).positive().required(),
  paymentDate: Joi.date().iso().required(),
});
