export interface CreateInvoiceDTO {
  vendorId: string;
  vendorName: string;
  vendorInvoiceNumber: string;
  vendorInvoiceDate: Date;
  invoiceDate: Date;
  poId?: string;
  receivedDate: Date;
  dueDate: Date;
  paymentTermsId?: string;
  paymentTerms?: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  otherCharges: number;
  discountAmount: number;
  notes?: string;
  internalNotes?: string;
  registeredBy: string;
  attachments?: string[];
  lines: CreateInvoiceLineDTO[];
}

export interface CreateInvoiceLineDTO {
  poLineId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  notes?: string;
}

export interface DisputeInvoiceDTO {
  invoiceId: string;
  reason: string;
}

export interface ResolveDisputeDTO {
  invoiceId: string;
  resolution: string;
}

export interface RecordPaymentDTO {
  invoiceId: string;
  paidAmount: number;
  paymentDate: Date;
}

export interface VendorInvoiceResponseDTO {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  vendorId: string;
  vendorName: string;
  vendorInvoiceNumber: string;
  vendorInvoiceDate: Date;
  poId?: string;
  poNumber?: string;
  receivedDate: Date;
  dueDate: Date;
  paymentTerms?: string;
  status: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  otherCharges: number;
  discountAmount: number;
  totalInvoicedAmount: number;
  totalMatchedAmount: number;
  remainingAmount: number;
  paidAmount: number;
  notes?: string;
  internalNotes?: string;
  registeredBy: string;
  matchedAt?: Date;
  matchedBy?: string;
  paidAt?: Date;
  dispatchStatus: string;
  disputeReason?: string;
  disputeResolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLineResponseDTO[];
}

export interface InvoiceLineResponseDTO {
  id: string;
  lineNumber: number;
  poLineId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  matchStatus: string;
  matchedQuantity: number;
  matchedAmount: number;
  notes?: string;
}

export interface PaginatedInvoiceResponseDTO {
  data: VendorInvoiceResponseDTO[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
