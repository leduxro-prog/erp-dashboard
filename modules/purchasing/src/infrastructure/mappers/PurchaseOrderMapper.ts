import {
  PurchaseOrder,
  POLine,
  PORevision,
} from '../../domain/entities/PurchaseOrder';
import {
  PurchaseOrderResponseDTO,
  POLineResponseDTO,
  PORevisionResponseDTO,
} from '../../application/dtos/PurchaseOrderDTOs';

export class PurchaseOrderMapper {
  static toDTO(po: PurchaseOrder): PurchaseOrderResponseDTO {
    return {
      id: po.id,
      poNumber: po.poNumber,
      requisitionId: po.requisitionId,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      vendorCode: po.vendorCode,
      status: po.status,
      type: po.type,
      issuedDate: po.issuedDate,
      requiredByDate: po.requiredByDate,
      paymentTerms: po.paymentTerms,
      incoTerms: po.incoTerms,
      shippingDetails: po.shippingDetails,
      contact: po.contact,
      currency: po.currency,
      totalAmount: po.totalAmount,
      taxAmount: po.taxAmount,
      shippingCost: po.shippingCost,
      discountAmount: po.discountAmount,
      discountPercentage: po.discountPercentage,
      notes: po.notes,
      internalNotes: po.internalNotes,
      createdBy: po.createdBy,
      approvedBy: po.approvedBy,
      approvedAt: po.approvedAt,
      sentAt: po.sentAt,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      lines: po.lines.map((line) => this.lineToDTO(line)),
      revisions: po.revisions.map((rev) => this.revisionToDTO(rev)),
    };
  }

  private static lineToDTO(line: POLine): POLineResponseDTO {
    return {
      id: line.id,
      lineNumber: line.lineNumber,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      totalPrice: line.getTotalAmount(),
      status: line.status,
      taxRate: line.taxRate,
      taxAmount: line.taxAmount,
      notes: line.notes,
      glAccountCode: line.glAccountCode,
      costCenter: line.costCenter,
    };
  }

  private static revisionToDTO(revision: PORevision): PORevisionResponseDTO {
    return {
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      changedFields: revision.changedFields,
      reason: revision.reason,
      createdBy: revision.createdBy,
      createdAt: revision.createdAt,
      status: revision.status,
      approvedBy: revision.approvedBy,
      approvedAt: revision.approvedAt,
    };
  }
}
