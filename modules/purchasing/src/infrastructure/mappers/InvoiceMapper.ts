import { VendorInvoice, InvoiceLine } from '../../domain/entities/VendorInvoice';
import {
  VendorInvoiceResponseDTO,
  InvoiceLineResponseDTO,
} from '../../application/dtos/InvoiceDTOs';

export class InvoiceMapper {
  static toDTO(invoice: VendorInvoice): VendorInvoiceResponseDTO {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      vendorId: invoice.vendorId,
      vendorName: invoice.vendorName,
      vendorInvoiceNumber: invoice.vendorInvoiceNumber,
      vendorInvoiceDate: invoice.vendorInvoiceDate,
      poId: invoice.poId,
      poNumber: invoice.poNumber,
      receivedDate: invoice.receivedDate,
      dueDate: invoice.dueDate,
      paymentTerms: invoice.paymentTerms,
      status: invoice.status,
      currency: invoice.currency,
      subtotalAmount: invoice.subtotalAmount,
      taxAmount: invoice.taxAmount,
      shippingAmount: invoice.shippingAmount,
      otherCharges: invoice.otherCharges,
      discountAmount: invoice.discountAmount,
      totalInvoicedAmount: invoice.getTotalAmount(),
      totalMatchedAmount: invoice.totalMatchedAmount,
      remainingAmount: invoice.getRemainingAmount(),
      paidAmount: invoice.paidAmount,
      notes: invoice.notes,
      internalNotes: invoice.internalNotes,
      registeredBy: invoice.registeredBy,
      matchedAt: invoice.matchedAt,
      matchedBy: invoice.matchedBy,
      paidAt: invoice.paidAt,
      dispatchStatus: invoice.dispatchStatus,
      disputeReason: invoice.disputeReason,
      disputeResolvedAt: invoice.disputeResolvedAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      lines: invoice.lines.map((line) => this.lineToDTO(line)),
    };
  }

  private static lineToDTO(line: InvoiceLine): InvoiceLineResponseDTO {
    return {
      id: line.id,
      lineNumber: line.lineNumber,
      poLineId: line.poLineId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      totalAmount: line.getTotalAmount(),
      taxRate: line.taxRate,
      taxAmount: line.taxAmount,
      matchStatus: line.matchStatus,
      matchedQuantity: line.matchedQuantity,
      matchedAmount: line.matchedAmount,
      notes: line.notes,
    };
  }
}
