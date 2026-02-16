import {
  PurchaseRequisition,
  RequisitionLine,
} from '../../domain/entities/PurchaseRequisition';
import {
  RequisitionResponseDTO,
  RequisitionLineResponseDTO,
} from '../../application/dtos/RequisitionDTOs';

export class RequisitionMapper {
  static toDTO(requisition: PurchaseRequisition): RequisitionResponseDTO {
    return {
      id: requisition.id,
      requisitionNumber: requisition.requisitionNumber,
      departmentId: requisition.departmentId,
      departmentName: requisition.departmentName,
      requestedById: requisition.requestedById,
      requestedByName: requisition.requestedByName,
      requestedByEmail: requisition.requestedByEmail,
      status: requisition.status,
      priority: requisition.priority,
      title: requisition.title,
      description: requisition.description,
      justification: requisition.justification,
      budgetCode: requisition.budgetCode,
      costCenter: requisition.costCenter,
      requiredBy: requisition.requiredBy,
      notes: requisition.notes,
      totalAmount: requisition.getTotalAmount(),
      currency: requisition.currency,
      createdAt: requisition.createdAt,
      updatedAt: requisition.updatedAt,
      convertedToPOId: requisition.convertedToPOId,
      lines: requisition.lines.map((line) => this.lineToDTO(line)),
    };
  }

  private static lineToDTO(line: RequisitionLine): RequisitionLineResponseDTO {
    return {
      id: line.id,
      lineNumber: line.lineNumber,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      estimatedUnitPrice: line.estimatedUnitPrice,
      estimatedTotalPrice: line.getTotalAmount(),
      notes: line.notes,
    };
  }
}
