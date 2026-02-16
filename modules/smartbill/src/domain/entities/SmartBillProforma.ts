import { InvoiceItem } from './SmartBillInvoice';

export type ProformaStatus = 'draft' | 'issued' | 'sent' | 'converted' | 'cancelled';

/**
 * SmartBill API proforma statuses
 */
export type SmartBillApiProformaStatus = 'draft' | 'sent' | 'converted' | 'canceled';

/**
 * Map SmartBill API status to internal status
 */
export function mapSmartBillProformaStatus(status: SmartBillApiProformaStatus): ProformaStatus {
  const statusMap: Record<SmartBillApiProformaStatus, ProformaStatus> = {
    draft: 'draft',
    sent: 'sent',
    converted: 'converted',
    canceled: 'cancelled',
  };
  return statusMap[status] || 'draft';
}

export class SmartBillProforma {
  constructor(
    public readonly id: number | undefined,
    public readonly orderId: string,
    public smartBillId: string | undefined,
    public proformaNumber: string | undefined,
    public readonly series: string = 'PF',
    public readonly customerName: string,
    public readonly customerVat: string,
    public readonly items: InvoiceItem[],
    public readonly totalWithoutVat: number,
    public readonly vatAmount: number,
    public readonly totalWithVat: number,
    public readonly currency: string = 'RON',
    public status: ProformaStatus = 'draft',
    public readonly issueDate: Date = new Date(),
    public readonly dueDate: Date,
    public readonly createdAt: Date = new Date(),
    // Track the SmartBill API status
    public smartBillStatus: SmartBillApiProformaStatus | null = null,
  ) {
    if (items.length === 0) throw new Error('Proforma must have at least one item');
    if (totalWithVat <= 0) throw new Error('Proforma total must be positive');
  }

  markIssued(smartBillId: string, proformaNumber: string, smartBillStatus?: SmartBillApiProformaStatus): void {
    this.smartBillId = smartBillId;
    this.proformaNumber = proformaNumber;
    this.smartBillStatus = smartBillStatus || 'sent';
    this.status = mapSmartBillProformaStatus(this.smartBillStatus);
  }

  markSent(): void {
    this.smartBillStatus = 'sent';
    this.status = 'sent';
  }

  markConverted(): void {
    this.smartBillStatus = 'converted';
    this.status = 'converted';
  }

  markCancelled(): void {
    this.smartBillStatus = 'canceled';
    this.status = 'cancelled';
  }

  /**
   * Update status from SmartBill API
   */
  updateFromSmartBillStatus(smartBillStatus: SmartBillApiProformaStatus): void {
    this.smartBillStatus = smartBillStatus;
    this.status = mapSmartBillProformaStatus(smartBillStatus);
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
  ): SmartBillProforma {
    const totalWithoutVat = items.reduce((sum, i) => sum + i.totalWithoutVat, 0);
    const vatAmount = items.reduce((sum, i) => sum + i.vatAmount, 0);
    return new SmartBillProforma(
      undefined,
      orderId,
      undefined,
      undefined,
      'PF',
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
