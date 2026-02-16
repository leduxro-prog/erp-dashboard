export enum ApInvoiceStatus {
  DRAFT = 'DRAFT',
  RECEIVED = 'RECEIVED',
  MATCHED = 'MATCHED',
  UNMATCHED = 'UNMATCHED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ThreeWayMatchStatus {
  PENDING = 'PENDING',
  COMPLETE = 'COMPLETE',
  VARIANCE = 'VARIANCE',
}

export interface ApInvoiceLine {
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

export class ApInvoice {
  id!: string;
  organizationId!: string;
  vendorId!: string;
  invoiceNumber!: string;
  poNumber?: string;
  grnNumber?: string;
  invoiceDate!: Date;
  dueDate!: Date;
  currencyCode!: string;
  subtotal!: number;
  taxAmount!: number;
  discountAmount!: number;
  totalAmount!: number;
  amountPaid!: number;
  amountDue!: number;
  status!: ApInvoiceStatus;
  paymentTerms?: string;
  discountPercent?: number;
  taxCodeId?: string;
  notes?: string;
  apAccountId!: string;
  expenseAccountId!: string;
  journalEntryId?: string;
  threeWayMatchStatus!: ThreeWayMatchStatus;
  matchVariancePercent?: number;
  isPosted!: boolean;
  lines!: ApInvoiceLine[];
  metadata!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: string;
  updatedBy!: string;

  constructor(data: Partial<ApInvoice>) {
    Object.assign(this, data);
    this.currencyCode = this.currencyCode ?? 'RON';
    this.subtotal = this.subtotal ?? 0;
    this.taxAmount = this.taxAmount ?? 0;
    this.discountAmount = this.discountAmount ?? 0;
    this.totalAmount = this.totalAmount ?? 0;
    this.amountPaid = this.amountPaid ?? 0;
    this.amountDue = this.amountDue ?? 0;
    this.status = this.status ?? ApInvoiceStatus.DRAFT;
    this.threeWayMatchStatus = this.threeWayMatchStatus ?? ThreeWayMatchStatus.PENDING;
    this.isPosted = this.isPosted ?? false;
    this.lines = this.lines ?? [];
    this.metadata = this.metadata ?? {};
  }

  validate(): void {
    if (!this.organizationId) throw new Error('Organization ID is required');
    if (!this.vendorId) throw new Error('Vendor ID is required');
    if (!this.invoiceNumber) throw new Error('Invoice number is required');
    if (!this.invoiceDate) throw new Error('Invoice date is required');
    if (!this.dueDate) throw new Error('Due date is required');
    if (!this.apAccountId) throw new Error('AP account ID is required');
    if (!this.expenseAccountId) throw new Error('Expense account ID is required');
    if (!this.lines || this.lines.length === 0)
      throw new Error('Invoice must have at least one line');

    let calculatedSubtotal = 0;
    this.lines.forEach((line, index) => {
      if (!line.description) throw new Error(`Line ${index + 1}: Description is required`);
      if (line.quantity <= 0) throw new Error(`Line ${index + 1}: Quantity must be greater than 0`);
      if (line.unitPrice <= 0)
        throw new Error(`Line ${index + 1}: Unit price must be greater than 0`);
      if (!line.expenseAccountId)
        throw new Error(`Line ${index + 1}: Expense account ID is required`);
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

  recordPayment(amount: number, discountTaken: number = 0): void {
    if (amount < 0) throw new Error('Payment amount cannot be negative');
    if (discountTaken < 0) throw new Error('Discount cannot be negative');

    const totalDeduction = amount + discountTaken;
    if (totalDeduction > this.amountDue) throw new Error('Payment and discount exceed amount due');

    this.amountPaid += amount;
    if (discountTaken > 0) {
      this.discountAmount += discountTaken;
    }
    this.amountDue = this.calculateAmountDue();

    if (Math.abs(this.amountDue) < 0.01) {
      this.status = ApInvoiceStatus.PAID;
    } else if (this.amountPaid > 0) {
      this.status = ApInvoiceStatus.PARTIALLY_PAID;
    }
  }

  canBeReceived(): boolean {
    return this.status === ApInvoiceStatus.DRAFT;
  }

  canBeMatched(): boolean {
    return this.status === ApInvoiceStatus.RECEIVED && !!this.poNumber && !!this.grnNumber;
  }

  canBeCancelled(): boolean {
    return [ApInvoiceStatus.DRAFT, ApInvoiceStatus.RECEIVED].includes(this.status);
  }

  canRecordPayment(): boolean {
    return [
      ApInvoiceStatus.MATCHED,
      ApInvoiceStatus.PARTIALLY_PAID,
      ApInvoiceStatus.OVERDUE,
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

  addLine(line: ApInvoiceLine): void {
    line.lineNumber = (this.lines?.length ?? 0) + 1;
    this.lines = this.lines ?? [];
    this.lines.push(line);
  }

  removeLine(lineNumber: number): void {
    this.lines = this.lines?.filter((l) => l.lineNumber !== lineNumber) ?? [];
  }

  getEarlyPaymentDiscount(paymentDate: Date): number {
    if (!this.paymentTerms || !this.discountPercent) return 0;

    const match = this.paymentTerms.match(/(\d+)/);
    if (!match) return 0;

    const discountDays = parseInt(match[0], 10);
    const discountDeadline = new Date(this.invoiceDate);
    discountDeadline.setDate(discountDeadline.getDate() + discountDays);

    if (paymentDate <= discountDeadline) {
      return (this.totalAmount * this.discountPercent) / 100;
    }
    return 0;
  }
}
