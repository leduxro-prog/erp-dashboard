import {
  VendorInvoice,
  InvoiceStatus,
  DisputeStatus,
} from '../entities/VendorInvoice';
import { IInvoiceRepository } from '../repositories/IInvoiceRepository';

export class InvoiceService {
  constructor(private invoiceRepository: IInvoiceRepository) {}

  async registerInvoice(invoice: VendorInvoice): Promise<VendorInvoice> {
    // Check for duplicates
    const existingCount = await this.invoiceRepository.countDuplicate(
      invoice.vendorId,
      invoice.vendorInvoiceNumber
    );

    if (existingCount > 0) {
      throw new Error(
        'Invoice with same vendor invoice number already exists'
      );
    }

    invoice.status = InvoiceStatus.REGISTERED;
    invoice.registeredBy = invoice.registeredBy || 'system';
    const created = await this.invoiceRepository.create(invoice);
    return created;
  }

  async markAsMatched(
    invoiceId: string,
    matchId: string,
    matchedBy: string
  ): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = InvoiceStatus.MATCHED;
    invoice.matchedAt = new Date();
    invoice.matchedBy = matchedBy;

    await this.invoiceRepository.addMatchReference(invoiceId, matchId);
    await this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.MATCHED,
      matchedAt: invoice.matchedAt,
      matchedBy,
    });
  }

  async markAsPartiallyMatched(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = InvoiceStatus.PARTIALLY_MATCHED;
    invoice.matchedAt = new Date();

    await this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.PARTIALLY_MATCHED,
      matchedAt: invoice.matchedAt,
    });
  }

  async markAsUnmatched(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = InvoiceStatus.UNMATCHED;
    await this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.UNMATCHED,
    });
  }

  async disputeInvoice(
    invoiceId: string,
    reason: string
  ): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (!invoice.canDispute()) {
      throw new Error('Invoice cannot be disputed in its current status');
    }

    invoice.dispatchStatus = DisputeStatus.PENDING;
    invoice.disputeReason = reason;

    await this.invoiceRepository.update(invoiceId, {
      dispatchStatus: DisputeStatus.PENDING,
      disputeReason: reason,
    });
  }

  async resolveDispute(
    invoiceId: string,
    resolution: string
  ): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.dispatchStatus !== DisputeStatus.PENDING) {
      throw new Error('No pending dispute found');
    }

    invoice.dispatchStatus = DisputeStatus.RESOLVED;
    invoice.disputeResolvedAt = new Date();

    await this.invoiceRepository.update(invoiceId, {
      dispatchStatus: DisputeStatus.RESOLVED,
      disputeResolvedAt: invoice.disputeResolvedAt,
    });
  }

  async approveForPayment(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (!invoice.canApproveForPayment()) {
      throw new Error(
        'Invoice cannot be approved for payment in its current status'
      );
    }

    invoice.status = InvoiceStatus.APPROVED_FOR_PAYMENT;
    await this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.APPROVED_FOR_PAYMENT,
    });
  }

  async recordPayment(
    invoiceId: string,
    paidAmount: number,
    paymentDate: Date
  ): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (!invoice.canPay()) {
      throw new Error('Invoice is not approved for payment');
    }

    if (paidAmount > invoice.getRemainingAmount()) {
      throw new Error(
        `Payment amount (${paidAmount}) exceeds remaining balance (${invoice.getRemainingAmount()})`
      );
    }

    invoice.paidAmount += paidAmount;
    const newStatus =
      Math.abs(invoice.paidAmount - invoice.totalInvoicedAmount) < 0.01
        ? InvoiceStatus.PAID
        : InvoiceStatus.APPROVED_FOR_PAYMENT;

    await this.invoiceRepository.update(invoiceId, {
      paidAmount: invoice.paidAmount,
      paidAt: paymentDate,
      status: newStatus,
    });
  }

  async cancelInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new Error('Cannot cancel a paid invoice');
    }

    invoice.status = InvoiceStatus.CANCELLED;
    await this.invoiceRepository.update(invoiceId, {
      status: InvoiceStatus.CANCELLED,
    });

    // Remove match references
    const matches = await this.invoiceRepository.getMatchReferences(invoiceId);
    for (const matchId of matches) {
      await this.invoiceRepository.removeMatchReference(invoiceId, matchId);
    }
  }

  generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now() % 100000;
    return `INV-${year}${month}-${String(timestamp).padStart(5, '0')}`;
  }

  calculateEarlyPaymentDiscount(invoice: VendorInvoice): number {
    if (!invoice.earlyPaymentDiscount) return 0;

    const today = new Date();
    const discountEnd = invoice.earlyPaymentDiscount.applicableUntil;

    if (today > discountEnd) return 0;

    return invoice.earlyPaymentDiscount.discountAmount;
  }

  getDaysUntilDue(invoice: VendorInvoice): number {
    const today = new Date();
    const dueDate = invoice.dueDate;
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
}
