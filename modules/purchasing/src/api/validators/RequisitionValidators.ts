import Joi from 'joi';

export const createRequisitionSchema = Joi.object({
  departmentId: Joi.string().uuid().required(),
  departmentName: Joi.string().required(),
  requestedById: Joi.string().uuid().required(),
  requestedByName: Joi.string().required(),
  requestedByEmail: Joi.string().email().required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().required(),
  justification: Joi.string().required(),
  budgetCode: Joi.string().required(),
  costCenter: Joi.string().required(),
  requiredBy: Joi.date().iso().required(),
  notes: Joi.string().optional(),
  currency: Joi.string().length(3).required(),
  lines: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().optional(),
        productCode: Joi.string().optional(),
        productName: Joi.string().required(),
        description: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        unit: Joi.string().required(),
        estimatedUnitPrice: Joi.number().precision(2).positive().required(),
        notes: Joi.string().optional(),
      })
    )
    .min(1)
    .required(),
});

export const submitRequisitionSchema = Joi.object({
  requisitionId: Joi.string().uuid().required(),
  submittedBy: Joi.string().uuid().required(),
});

export const approveRequisitionSchema = Joi.object({
  requisitionId: Joi.string().uuid().required(),
  approverId: Joi.string().uuid().required(),
  approverName: Joi.string().required(),
  approvalLevel: Joi.number().positive().required(),
  comments: Joi.string().optional(),
});

export const rejectRequisitionSchema = Joi.object({
  requisitionId: Joi.string().uuid().required(),
  approverId: Joi.string().uuid().required(),
  approverName: Joi.string().required(),
  rejectionReason: Joi.string().required(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().positive().default(1),
  limit: Joi.number().positive().max(100).default(20),
});
