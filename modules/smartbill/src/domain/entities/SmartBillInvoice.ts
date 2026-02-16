export interface InvoiceItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalWithoutVat: number;
  vatAmount: number;
}

export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled';

/**
 * SmartBill API invoice statuses
 */
export type SmartBillApiInvoiceStatus = 'draft' | 'sent' | 'paid' | 'canceled' | 'storno';

/**
 * Map SmartBill API status to internal status
 */
export function mapSmartBillInvoiceStatus(status: SmartBillApiInvoiceStatus): InvoiceStatus {
  const statusMap: Record<SmartBillApiInvoiceStatus, InvoiceStatus> = {
    draft: 'draft',
    sent: 'sent',
    paid: 'paid',
    canceled: 'cancelled',
    storno: 'cancelled',
  };
  return statusMap[status] || 'draft';
}

export class SmartBillInvoice {
  constructor(
    public readonly id: number | undefined,
    public readonly orderId: string,
    public smartBillId: string | undefined,
    public invoiceNumber: string | undefined,
    public readonly series: string = 'FL',
    public readonly customerName: string,
    public readonly customerVat: string,
    public readonly items: InvoiceItem[],
    public readonly totalWithoutVat: number,
    public readonly vatAmount: number,
    public readonly totalWithVat: number,
    public readonly currency: string = 'RON',
    public status: InvoiceStatus = 'draft',
    public readonly issueDate: Date = new Date(),
    public readonly dueDate: Date,
    public readonly createdAt: Date = new Date(),
    public paidAmount: number = 0,
    public paymentDate: Date | null = null,
    // Track the SmartBill API status
    public smartBillStatus: SmartBillApiInvoiceStatus | null = null,
  ) {
    if (items.length === 0) throw new Error('Invoice must have at least one item');
    if (totalWithVat <= 0) throw new Error('Invoice total must be positive');
  }

  markIssued(smartBillId: string, invoiceNumber: string, smartBillStatus?: SmartBillApiInvoiceStatus): void {
    this.smartBillId = smartBillId;
    this.invoiceNumber = invoiceNumber;
    this.smartBillStatus = smartBillStatus || 'sent';
    this.status = mapSmartBillInvoiceStatus(this.smartBillStatus);
  }

  markSent(): void {
    this.smartBillStatus = 'sent';
    this.status = 'sent';
  }

  markPaid(amount?: number, date?: Date): void {
    this.smartBillStatus = 'paid';
    this.status = 'paid';
    this.paidAmount = amount ?? this.totalWithVat;
    this.paymentDate = date ?? new Date();
  }

  markCancelled(): void {
    this.smartBillStatus = 'canceled';
    this.status = 'cancelled';
  }

  /**
   * Update status from SmartBill API
   */
  updateFromSmartBillStatus(smartBillStatus: SmartBillApiInvoiceStatus): void {
    this.smartBillStatus = smartBillStatus;
    this.status = mapSmartBillInvoiceStatus(smartBillStatus);
  }

  static calculateVat(amount: number, vatRate: number = 0.21): number {
    return Math.round(amount * vatRate * 100) / 100;
  }

  static createFromOrder(
    orderId: string,
    customerName: string,
    customerVat: string,
    items: InvoiceItem[],
    dueDate: Date,
  ): SmartBillInvoice {
    const totalWithoutVat = items.reduce((sum, i) => sum + i.totalWithoutVat, 0);
    const vatAmount = items.reduce((sum, i) => sum + i.vatAmount, 0);
    return new SmartBillInvoice(
      undefined,
      orderId,
      undefined,
      undefined,
      'FL',
      customerName,
      customerVat,
      items,
      totalWithoutVat,
      vatAmount,
      totalWithoutVat + vatAmount,
      'RON',
      'draft',
      new Date(),
      dueDate,
    );
  }
}
