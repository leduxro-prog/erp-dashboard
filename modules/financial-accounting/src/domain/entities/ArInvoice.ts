export enum ArInvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  CREDIT_MEMO = 'CREDIT_MEMO',
}

export interface ArInvoiceLine {
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

export class ArInvoice {
  id!: string;
  organizationId!: string;
  customerId!: string;
  invoiceNumber!: string;
  orderId?: string;
  invoiceDate!: Date;
  dueDate!: Date;
  currencyCode!: string;
  subtotal!: number;
  taxAmount!: number;
  discountAmount!: number;
  totalAmount!: number;
  amountPaid!: number;
  amountDue!: number;
  status!: ArInvoiceStatus;
  paymentTerms?: string;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  arAccountId!: string;
  revenueAccountId!: string;
  journalEntryId?: string;
  isPosted!: boolean;
  lines!: ArInvoiceLine[];
  metadata!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: string;
  updatedBy!: string;

  constructor(data: Partial<ArInvoice>) {
    Object.assign(this, data);
    this.currencyCode = this.currencyCode ?? 'RON';
    this.subtotal = this.subtotal ?? 0;
    this.taxAmount = this.taxAmount ?? 0;
    this.discountAmount = this.discountAmount ?? 0;
    this.totalAmount = this.totalAmount ?? 0;
    this.amountPaid = this.amountPaid ?? 0;
    this.amountDue = this.amountDue ?? 0;
    this.status = this.status ?? ArInvoiceStatus.DRAFT;
    this.isPosted = this.isPosted ?? false;
    this.lines = this.lines ?? [];
    this.metadata = this.metadata ?? {};
  }

  validate(): void {
    if (!this.organizationId) throw new Error('Organization ID is required');
    if (!this.customerId) throw new Error('Customer ID is required');
    if (!this.invoiceNumber) throw new Error('Invoice number is required');
    if (!this.invoiceDate) throw new Error('Invoice date is required');
    if (!this.dueDate) throw new Error('Due date is required');
    if (!this.arAccountId) throw new Error('AR account ID is required');
    if (!this.revenueAccountId) throw new Error('Revenue account ID is required');
    if (!this.lines || this.lines.length === 0)
      throw new Error('Invoice must have at least one line');

    let calculatedSubtotal = 0;
    this.lines.forEach((line, index) => {
      if (!line.description) throw new Error(`Line ${index + 1}: Description is required`);
      if (line.quantity <= 0) throw new Error(`Line ${index + 1}: Quantity must be greater than 0`);
      if (line.unitPrice <= 0)
        throw new Error(`Line ${index + 1}: Unit price must be greater than 0`);
      if (!line.revenueAccountId)
        throw new Error(`Line ${index + 1}: Revenue account ID is required`);
      calculatedSubtotal += line.amount;
    });

    this.subtotal = calculatedSubtotal;
    if (this.discountPercent) {
      this.discountAmount = (this.subtotal * this.discountPercent) / 100;
    }
    this.totalAmount = this.subtotal - this.discountAmount + (this.taxAmount || 0);
    this.amountDue = this.totalAmount - this.amountPaid;
  }

  calculateAmountDue(): number {
    return this.totalAmount - this.amountPaid;
  }

  recordPayment(amount: number): void {
    if (amount < 0) throw new Error('Payment amount cannot be negative');
    if (amount > this.amountDue) throw new Error('Payment exceeds amount due');

    this.amountPaid += amount;
    this.amountDue = this.calculateAmountDue();

    if (Math.abs(this.amountDue) < 0.01) {
      this.status = ArInvoiceStatus.PAID;
    } else if (this.amountPaid > 0) {
      this.status = ArInvoiceStatus.PARTIALLY_PAID;
    }
  }

  canBeIssued(): boolean {
    return this.status === ArInvoiceStatus.DRAFT;
  }

  canBeCancelled(): boolean {
    return [ArInvoiceStatus.DRAFT, ArInvoiceStatus.ISSUED].includes(this.status);
  }

  canRecordPayment(): boolean {
    return [
      ArInvoiceStatus.ISSUED,
      ArInvoiceStatus.PARTIALLY_PAID,
      ArInvoiceStatus.OVERDUE,
    ].includes(this.status);
  }

  isOverdue(asOfDate: Date = new Date()): boolean {
    return asOfDate > this.dueDate && this.amountDue > 0;
  }

  getDaysOverdue(asOfDate: Date = new Date()): number {
    if (!this.isOverdue(asOfDate)) return 0;
    return Math.floor((asOfDate.getTime() - this.dueDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  getAgingBucket(asOfDate: Date = new Date()): '0-30' | '31-60' | '61-90' | '91-120' | '120+' {
    const daysOverdue = this.getDaysOverdue(asOfDate);
    if (daysOverdue <= 30) return '0-30';
    if (daysOverdue <= 60) return '31-60';
    if (daysOverdue <= 90) return '61-90';
    if (daysOverdue <= 120) return '91-120';
    return '120+';
  }

  addLine(line: ArInvoiceLine): void {
    line.lineNumber = (this.lines?.length ?? 0) + 1;
    this.lines = this.lines ?? [];
    this.lines.push(line);
  }

  removeLine(lineNumber: number): void {
    this.lines = this.lines?.filter((l) => l.lineNumber !== lineNumber) ?? [];
  }
}
