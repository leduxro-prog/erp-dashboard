import Joi from 'joi';

export const createChartOfAccountSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  code: Joi.string().max(50).required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  accountType: Joi.string()
    .valid('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_ASSET', 'CONTRA_LIABILITY')
    .required(),
  parentAccountId: Joi.string().uuid().optional(),
  isHeader: Joi.boolean().optional(),
  costCenterCode: Joi.string().optional(),
  taxApplicable: Joi.boolean().optional(),
  accumulatedDepreciation: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});

export const createJournalEntryLineSchema = Joi.object({
  lineNumber: Joi.number().required(),
  accountId: Joi.string().uuid().required(),
  costCenterId: Joi.string().uuid().optional(),
  taxCodeId: Joi.string().uuid().optional(),
  description: Joi.string().optional(),
  debitAmount: Joi.number().min(0).required(),
  creditAmount: Joi.number().min(0).required(),
  quantity: Joi.number().optional(),
  unitPrice: Joi.number().optional(),
  referenceNumber: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const createJournalEntrySchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  fiscalPeriodId: Joi.string().uuid().required(),
  entryDate: Joi.date().required(),
  referenceType: Joi.string().optional(),
  referenceId: Joi.string().optional(),
  description: Joi.string().required(),
  lines: Joi.array().items(createJournalEntryLineSchema).min(2).required(),
  metadata: Joi.object().optional(),
});

export const createArInvoiceLineSchema = Joi.object({
  lineNumber: Joi.number().required(),
  description: Joi.string().required(),
  quantity: Joi.number().min(0).required(),
  unitPrice: Joi.number().min(0).required(),
  amount: Joi.number().min(0).required(),
  taxAmount: Joi.number().optional(),
  revenueAccountId: Joi.string().uuid().required(),
  taxCodeId: Joi.string().uuid().optional(),
  metadata: Joi.object().optional(),
});

export const createArInvoiceSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  customerId: Joi.string().uuid().required(),
  orderId: Joi.string().uuid().optional(),
  invoiceDate: Joi.date().required(),
  dueDate: Joi.date().required(),
  currencyCode: Joi.string().max(3).optional(),
  discountPercent: Joi.number().min(0).max(100).optional(),
  taxCodeId: Joi.string().uuid().optional(),
  notes: Joi.string().optional(),
  paymentTerms: Joi.string().optional(),
  arAccountId: Joi.string().uuid().required(),
  revenueAccountId: Joi.string().uuid().required(),
  lines: Joi.array().items(createArInvoiceLineSchema).min(1).required(),
  metadata: Joi.object().optional(),
});

export const createApInvoiceLineSchema = Joi.object({
  lineNumber: Joi.number().required(),
  description: Joi.string().required(),
  quantity: Joi.number().min(0).required(),
  unitPrice: Joi.number().min(0).required(),
  amount: Joi.number().min(0).required(),
  taxAmount: Joi.number().optional(),
  expenseAccountId: Joi.string().uuid().required(),
  taxCodeId: Joi.string().uuid().optional(),
  costCenterId: Joi.string().uuid().optional(),
  poLineId: Joi.string().optional(),
  grnLineId: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

export const createApInvoiceSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  vendorId: Joi.string().uuid().required(),
  invoiceNumber: Joi.string().required(),
  poNumber: Joi.string().optional(),
  grnNumber: Joi.string().optional(),
  invoiceDate: Joi.date().required(),
  dueDate: Joi.date().required(),
  currencyCode: Joi.string().max(3).optional(),
  discountPercent: Joi.number().min(0).max(100).optional(),
  taxCodeId: Joi.string().uuid().optional(),
  notes: Joi.string().optional(),
  paymentTerms: Joi.string().optional(),
  apAccountId: Joi.string().uuid().required(),
  expenseAccountId: Joi.string().uuid().required(),
  lines: Joi.array().items(createApInvoiceLineSchema).min(1).required(),
  metadata: Joi.object().optional(),
});

export const createFiscalPeriodSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  periodName: Joi.string().required(),
  fiscalYear: Joi.string().regex(/^\d{4}$/).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  metadata: Joi.object().optional(),
});

export const recordPaymentSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  amount: Joi.number().min(0).required(),
  paymentDate: Joi.date().required(),
  paymentMethod: Joi.string().required(),
  referenceNumber: Joi.string().optional(),
  notes: Joi.string().optional(),
});

export const threeWayMatchSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  poAmount: Joi.number().optional(),
  grnAmount: Joi.number().optional(),
  tolerancePercent: Joi.number().min(0).optional(),
});
