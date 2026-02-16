export interface CreateArInvoiceLineDTO {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  revenueAccountId: string;
  taxCodeId?: string;
  metadata?: Record<string, any>;
}

export interface CreateArInvoiceDTO {
  organizationId: string;
  customerId: string;
  orderId?: string;
  invoiceDate: Date;
  dueDate: Date;
  currencyCode?: string;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  paymentTerms?: string;
  arAccountId: string;
  revenueAccountId: string;
  lines: CreateArInvoiceLineDTO[];
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface UpdateArInvoiceDTO {
  invoiceDate?: Date;
  dueDate?: Date;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  paymentTerms?: string;
  lines?: CreateArInvoiceLineDTO[];
  metadata?: Record<string, any>;
  updatedBy: string;
}

export interface RecordArPaymentDTO {
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  organizationId: string;
  userId: string;
}

export interface ArInvoiceLineResponseDTO {
  id?: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount?: number;
  revenueAccountId: string;
  taxCodeId?: string;
  metadata?: Record<string, any>;
}

export interface ArInvoiceResponseDTO {
  id: string;
  organizationId: string;
  customerId: string;
  invoiceNumber: string;
  orderId?: string;
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
  arAccountId: string;
  revenueAccountId: string;
  journalEntryId?: string;
  isPosted: boolean;
  lines: ArInvoiceLineResponseDTO[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
