export enum QuoteStatus {
  PENDING = 'pending',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REJECTED = 'rejected',
}

export interface QuoteItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BillingAddress {
  street: string;
  city: string;
  postcode: string;
  country: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  postcode: string;
  country: string;
}

export class Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: QuoteStatus;
  items: QuoteItem[];
  billingAddress: BillingAddress;
  shippingAddress: ShippingAddress;
  subtotal!: number;
  discountAmount!: number;
  discountPercentage: number;
  taxRate: number = 0.21;
  taxAmount!: number;
  grandTotal!: number;
  currency: string = 'RON';
  paymentTerms: string;
  deliveryEstimate: string;
  validityDays: number = 15;
  validUntil: Date;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    quoteNumber: string,
    customerId: string,
    customerName: string,
    customerEmail: string,
    items: QuoteItem[],
    billingAddress: BillingAddress,
    shippingAddress: ShippingAddress,
    paymentTerms: string,
    deliveryEstimate: string,
    createdBy: string,
    discountPercentage: number = 0,
    validityDays: number = 15,
    notes?: string,
  ) {
    this.id = id;
    this.quoteNumber = quoteNumber;
    this.customerId = customerId;
    this.customerName = customerName;
    this.customerEmail = customerEmail;
    this.status = QuoteStatus.PENDING;
    this.items = items;
    this.billingAddress = billingAddress;
    this.shippingAddress = shippingAddress;
    this.paymentTerms = paymentTerms;
    this.deliveryEstimate = deliveryEstimate;
    this.createdBy = createdBy;
    this.validityDays = validityDays;
    this.notes = notes;
    this.discountPercentage = discountPercentage;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    this.calculateTotals();

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validityDays);
    this.validUntil = validUntilDate;
  }

  calculateTotals(): void {
    this.subtotal = this.items.reduce((sum, item) => sum + item.lineTotal, 0);
    this.discountAmount = this.subtotal * (this.discountPercentage / 100);
    const subtotalAfterDiscount = this.subtotal - this.discountAmount;
    this.taxAmount = subtotalAfterDiscount * this.taxRate;
    this.grandTotal = subtotalAfterDiscount + this.taxAmount;
  }

  send(): void {
    if (this.status !== QuoteStatus.PENDING) {
      throw new Error('Only pending quotes can be sent');
    }
    this.status = QuoteStatus.SENT;
    this.sentAt = new Date();
    this.updatedAt = new Date();
  }

  accept(): void {
    if (this.status !== QuoteStatus.SENT) {
      throw new Error('Only sent quotes can be accepted');
    }
    this.status = QuoteStatus.ACCEPTED;
    this.acceptedAt = new Date();
    this.updatedAt = new Date();
  }

  reject(reason: string): void {
    if (this.status !== QuoteStatus.SENT) {
      throw new Error('Only sent quotes can be rejected');
    }
    this.status = QuoteStatus.REJECTED;
    this.rejectedAt = new Date();
    this.rejectionReason = reason;
    this.updatedAt = new Date();
  }

  expire(): void {
    if (this.status !== QuoteStatus.SENT && this.status !== QuoteStatus.PENDING) {
      throw new Error('Cannot expire quotes in terminal states');
    }
    this.status = QuoteStatus.EXPIRED;
    this.updatedAt = new Date();
  }

  isExpired(): boolean {
    return this.status === QuoteStatus.EXPIRED || new Date() > this.validUntil;
  }

  daysUntilExpiry(): number {
    const now = new Date();
    const diffTime = this.validUntil.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  needsReminder(daysBefore: number): boolean {
    if (this.status !== QuoteStatus.SENT && this.status !== QuoteStatus.PENDING) {
      return false;
    }
    const daysLeft = this.daysUntilExpiry();
    return daysLeft === daysBefore && daysLeft > 0;
  }

  convertToOrderData(): any {
    return {
      quoteId: this.id,
      quoteNumber: this.quoteNumber,
      customerId: this.customerId,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      items: this.items.map(item => ({
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      billingAddress: this.billingAddress,
      shippingAddress: this.shippingAddress,
      subtotal: this.subtotal,
      discountAmount: this.discountAmount,
      discountPercentage: this.discountPercentage,
      taxAmount: this.taxAmount,
      grandTotal: this.grandTotal,
      currency: this.currency,
      paymentTerms: this.paymentTerms,
      deliveryEstimate: this.deliveryEstimate,
      notes: this.notes,
    };
  }

  static generateQuoteNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `QTE-${year}${month}${day}-${random}`;
  }
}
