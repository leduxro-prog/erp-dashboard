export enum InvoiceStatus {
  DRAFT = 'draft',
  REGISTERED = 'registered',
  MATCHED = 'matched',
  PARTIALLY_MATCHED = 'partially_matched',
  UNMATCHED = 'unmatched',
  DISPUTED = 'disputed',
  APPROVED_FOR_PAYMENT = 'approved_for_payment',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum DisputeStatus {
  NONE = 'none',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

export interface EarlyPaymentDiscount {
  discountPercentage: number;
  discountAmount: number;
  daysBeforeDueDate: number;
  applicableFrom: Date;
  applicableUntil: Date;
}

export class VendorInvoice {
  id!: string;
  invoiceNumber!: string;
  invoiceDate!: Date;
  vendorId!: string;
  vendorName!: string;
  vendorInvoiceNumber!: string;
  vendorInvoiceDate!: Date;
  poId?: string;
  poNumber?: string;
  receivedDate!: Date;
  dueDate!: Date;
  paymentTermsId?: string;
  paymentTerms?: string;
  status!: InvoiceStatus;
  currency!: string;
  subtotalAmount!: number;
  taxAmount!: number;
  shippingAmount!: number;
  otherCharges!: number;
  discountAmount!: number;
  totalInvoicedAmount!: number;
  totalMatchedAmount!: number;
  remainingAmount!: number;
  notes?: string;
  internalNotes?: string;
  attachments?: string[]; // File paths/URLs
  registeredBy!: string;
  matchedAt?: Date;
  matchedBy?: string;
  paidAt?: Date;
  paidAmount!: number;
  createdAt!: Date;
  updatedAt!: Date;
  dispatchStatus!: DisputeStatus;
  disputeReason?: string;
  disputeResolvedAt?: Date;
  earlyPaymentDiscount?: EarlyPaymentDiscount;
  lines!: InvoiceLine[];
  matchReferences!: string[]; // 3-Way Match IDs

  constructor(data: Partial<VendorInvoice>) {
    Object.assign(this, data);
    this.lines = data.lines || [];
    this.matchReferences = data.matchReferences || [];
  }

  canRegister(): boolean {
    return this.status === InvoiceStatus.DRAFT;
  }

  canMatch(): boolean {
    return [
      InvoiceStatus.REGISTERED,
      InvoiceStatus.UNMATCHED,
      InvoiceStatus.PARTIALLY_MATCHED,
    ].includes(this.status);
  }

  canDispute(): boolean {
    return ![InvoiceStatus.PAID, InvoiceStatus.CANCELLED].includes(
      this.status
    );
  }

  canApproveForPayment(): boolean {
    return [InvoiceStatus.MATCHED, InvoiceStatus.PARTIALLY_MATCHED].includes(
      this.status
    ) && this.dispatchStatus !== DisputeStatus.PENDING;
  }

  canPay(): boolean {
    return this.status === InvoiceStatus.APPROVED_FOR_PAYMENT;
  }

  getTotalAmount(): number {
    return (
      this.subtotalAmount +
      this.taxAmount +
      this.shippingAmount +
      this.otherCharges -
      this.discountAmount
    );
  }

  getRemainingAmount(): number {
    return this.totalInvoicedAmount - this.paidAmount;
  }

  getEarlyPaymentDiscountAmount(): number {
    if (!this.earlyPaymentDiscount) return 0;
    const today = new Date();
    if (today >= this.earlyPaymentDiscount.applicableUntil) return 0;
    return this.earlyPaymentDiscount.discountAmount;
  }

  isOverdue(): boolean {
    return new Date() > this.dueDate;
  }
}

export class InvoiceLine {
  id!: string;
  invoiceId!: string;
  lineNumber!: number;
  poLineId?: string;
  description!: string;
  quantity!: number;
  unit!: string;
  unitPrice!: number;
  totalAmount!: number;
  taxRate!: number;
  taxAmount!: number;
  matchStatus!: 'matched' | 'partial_match' | 'unmatched';
  matchedQuantity!: number;
  matchedAmount!: number;
  notes?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<InvoiceLine>) {
    Object.assign(this, data);
  }

  getTotalAmount(): number {
    return this.quantity * this.unitPrice;
  }

  getTotalWithTax(): number {
    return this.getTotalAmount() + this.taxAmount;
  }

  getVariance(poLineAmount: number): number {
    return this.getTotalAmount() - poLineAmount;
  }

  getVariancePercentage(poLineAmount: number): number {
    if (poLineAmount === 0) return 0;
    return (this.getVariance(poLineAmount) / poLineAmount) * 100;
  }
}
