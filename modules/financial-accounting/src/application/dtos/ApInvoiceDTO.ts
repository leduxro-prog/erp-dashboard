export interface CreateApInvoiceLineDTO {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  expenseAccountId: string;
  taxCodeId?: string;
  costCenterId?: string;
  poLineId?: string;
  grnLineId?: string;
  metadata?: Record<string, any>;
}

export interface CreateApInvoiceDTO {
  organizationId: string;
  vendorId: string;
  invoiceNumber: string;
  poNumber?: string;
  grnNumber?: string;
  invoiceDate: Date;
  dueDate: Date;
  currencyCode?: string;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  paymentTerms?: string;
  apAccountId: string;
  expenseAccountId: string;
  lines: CreateApInvoiceLineDTO[];
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface UpdateApInvoiceDTO {
  invoiceDate?: Date;
  dueDate?: Date;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  paymentTerms?: string;
  lines?: CreateApInvoiceLineDTO[];
  metadata?: Record<string, any>;
  updatedBy: string;
}

export interface RecordApPaymentDTO {
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  discountTaken?: number;
  referenceNumber?: string;
  notes?: string;
  organizationId: string;
  userId: string;
}

export interface ThreeWayMatchDTO {
  invoiceId: string;
  poAmount?: number;
  grnAmount?: number;
  tolerancePercent?: number;
  organizationId: string;
  userId: string;
}

export interface ApInvoiceLineResponseDTO {
  id?: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  expenseAccountId: string;
  taxCodeId?: string;
  costCenterId?: string;
  poLineId?: string;
  grnLineId?: string;
  metadata?: Record<string, any>;
}

export interface ApInvoiceResponseDTO {
  id: string;
  organizationId: string;
  vendorId: string;
  invoiceNumber: string;
  poNumber?: string;
  grnNumber?: string;
  invoiceDate: Date;
  dueDate: Date;
  currencyCode: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  paymentTerms?: string;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  apAccountId: string;
  expenseAccountId: string;
  journalEntryId?: string;
  threeWayMatchStatus: string;
  matchVariancePercent?: number;
  isPosted: boolean;
  lines: ApInvoiceLineResponseDTO[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
