import { randomUUID } from 'crypto';

import {
  ApInvoice,
  ApInvoiceStatus,
  ThreeWayMatchStatus,
} from '../../domain/entities/ApInvoice';
import { IApInvoiceRepository } from '../../domain/repositories/IApInvoiceRepository';

interface PurchasingInvoiceApprovedEvent {
  invoiceId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  dueDate?: string;
  totalAmount: number;
  currency: string;
  approvedAt: string;
}

export class OnPurchasingInvoiceApproved {
  constructor(private readonly apInvoiceRepository: IApInvoiceRepository) {}

  async handle(event: PurchasingInvoiceApprovedEvent): Promise<void> {
    const organizationId =
      process.env.DEFAULT_ORGANIZATION_ID || '00000000-0000-0000-0000-000000000001';
    const apAccountId =
      process.env.DEFAULT_AP_ACCOUNT_ID || '00000000-0000-0000-0000-000000000101';
    const expenseAccountId =
      process.env.DEFAULT_EXPENSE_ACCOUNT_ID || '00000000-0000-0000-0000-000000000201';

    const existing = await this.apInvoiceRepository.findByNumber(event.invoiceNumber, organizationId);
    if (existing) {
      return;
    }

    const approvedAt = new Date(event.approvedAt || new Date().toISOString());
    const dueDate = event.dueDate
      ? new Date(event.dueDate)
      : new Date(approvedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const invoice = new ApInvoice({
      id: randomUUID(),
      organizationId,
      vendorId: event.vendorId,
      invoiceNumber: event.invoiceNumber,
      invoiceDate: approvedAt,
      dueDate,
      currencyCode: event.currency || 'RON',
      subtotal: event.totalAmount,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: event.totalAmount,
      amountPaid: 0,
      amountDue: event.totalAmount,
      status: ApInvoiceStatus.RECEIVED,
      apAccountId,
      expenseAccountId,
      threeWayMatchStatus: ThreeWayMatchStatus.PENDING,
      isPosted: false,
      lines: [
        {
          id: randomUUID(),
          lineNumber: 1,
          description: `Purchasing invoice ${event.invoiceNumber}`,
          quantity: 1,
          unitPrice: event.totalAmount,
          amount: event.totalAmount,
          taxAmount: 0,
          expenseAccountId,
          metadata: {
            sourceEvent: 'purchasing.invoice.approved',
          },
        },
      ],
      metadata: {
        source: 'purchasing.invoice.approved',
        purchasingInvoiceId: event.invoiceId,
        vendorName: event.vendorName,
      },
      createdBy: 'system:purchasing-event',
      updatedBy: 'system:purchasing-event',
      createdAt: approvedAt,
      updatedAt: approvedAt,
    });

    await this.apInvoiceRepository.create(invoice);
  }
}
