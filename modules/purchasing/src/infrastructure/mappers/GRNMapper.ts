import {
  GoodsReceiptNote,
  GRNLine,
  ReturnItem,
} from '../../domain/entities/GoodsReceiptNote';
import {
  GRNResponseDTO,
  GRNLineResponseDTO,
  ReturnItemResponseDTO,
  InspectionResponseDTO,
} from '../../application/dtos/GRNDTOs';

export class GRNMapper {
  static toDTO(grn: GoodsReceiptNote): GRNResponseDTO {
    return {
      id: grn.id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      poNumber: grn.poNumber,
      vendorId: grn.vendorId,
      vendorName: grn.vendorName,
      grn_date: grn.grn_date,
      receiveDate: grn.receiveDate,
      status: grn.status,
      waybillNumber: grn.waybillNumber,
      containerNumber: grn.containerNumber,
      totalQuantity: grn.totalQuantity,
      totalWeight: grn.totalWeight,
      totalVolume: grn.totalVolume,
      currency: grn.currency,
      totalReceivedAmount: grn.getTotalQuantity(),
      notes: grn.notes,
      inspection: grn.inspection ? this.inspectionToDTO(grn.inspection) : undefined,
      receivingDetails: grn.receivingDetails,
      createdAt: grn.createdAt,
      updatedAt: grn.updatedAt,
      lines: grn.lines.map((line) => this.lineToDTO(line)),
      returnedItems: grn.returnedItems.map((item) => this.returnItemToDTO(item)),
    };
  }

  private static inspectionToDTO(inspection: any): InspectionResponseDTO {
    return {
      inspectorId: inspection.inspectorId,
      inspectorName: inspection.inspectorName,
      inspectedAt: inspection.inspectedAt,
      remarks: inspection.remarks,
      qualityOk: inspection.qualityOk,
      defectDetails: inspection.defectDetails,
    };
  }

  private static lineToDTO(line: GRNLine): GRNLineResponseDTO {
    return {
      id: line.id,
      lineNumber: line.lineNumber,
      poLineId: line.poLineId,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      quantityOrdered: line.quantityOrdered,
      quantityReceived: line.quantityReceived,
      quantityRejected: line.quantityRejected,
      unit: line.unit,
      priceOrdered: line.priceOrdered,
      priceReceived: line.priceReceived,
      status: line.status,
      batchNumber: line.batchNumber,
      expiryDate: line.expiryDate,
      serialNumbers: line.serialNumbers,
      remarks: line.remarks,
    };
  }

  private static returnItemToDTO(item: ReturnItem): ReturnItemResponseDTO {
    return {
      id: item.id,
      grnLineId: item.grnLineId,
      productId: item.productId,
      productName: item.productName,
      quantityReturned: item.quantityReturned,
      unit: item.unit,
      reason: item.reason,
      returnDate: item.returnDate,
      status: item.status,
      approvedBy: item.approvedBy,
    };
  }
}
