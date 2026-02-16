import Joi from 'joi';

export const createGRNSchema = Joi.object({
  poId: Joi.string().uuid().required(),
  vendorId: Joi.string().uuid().required(),
  vendorName: Joi.string().required(),
  receiveDate: Joi.date().iso().required(),
  waybillNumber: Joi.string().optional(),
  containerNumber: Joi.string().optional(),
  totalQuantity: Joi.number().positive().required(),
  totalWeight: Joi.number().optional(),
  totalVolume: Joi.number().optional(),
  currency: Joi.string().length(3).required(),
  notes: Joi.string().optional(),
  receivingDetails: Joi.object({
    receivedAt: Joi.date().iso().required(),
    receivedBy: Joi.string().uuid().required(),
    receiverName: Joi.string().required(),
    location: Joi.string().required(),
    remarks: Joi.string().optional(),
  }).required(),
  lines: Joi.array()
    .items(
      Joi.object({
        poLineId: Joi.string().uuid().required(),
        lineNumber: Joi.number().positive().required(),
        productId: Joi.string().uuid().required(),
        productCode: Joi.string().required(),
        productName: Joi.string().required(),
        quantityOrdered: Joi.number().positive().required(),
        quantityReceived: Joi.number().min(0).required(),
        quantityRejected: Joi.number().min(0).default(0),
        unit: Joi.string().required(),
        priceOrdered: Joi.number().precision(2).positive().required(),
        priceReceived: Joi.number().precision(2).positive().required(),
        batchNumber: Joi.string().optional(),
        expiryDate: Joi.date().iso().optional(),
        serialNumbers: Joi.array().items(Joi.string()).optional(),
        remarks: Joi.string().optional(),
      })
    )
    .min(1)
    .required(),
});

export const inspectGRNSchema = Joi.object({
  grnId: Joi.string().uuid().required(),
  inspectorId: Joi.string().uuid().required(),
  inspectorName: Joi.string().required(),
  qualityOk: Joi.boolean().required(),
  remarks: Joi.string().optional(),
  defectDetails: Joi.string().optional(),
});

export const requestReturnSchema = Joi.object({
  grnId: Joi.string().uuid().required(),
  grnLineId: Joi.string().uuid().required(),
  quantityToReturn: Joi.number().positive().required(),
  reason: Joi.string().required(),
});
