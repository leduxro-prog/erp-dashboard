import { ArInvoice, ArInvoiceStatus } from '../entities/ArInvoice';
import { IArInvoiceRepository } from '../repositories/IArInvoiceRepository';

export interface AgingAnalysis {
  customerId: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120Plus: number;
  totalDue: number;
}

export class AccountsReceivableService {
  constructor(private arInvoiceRepository: IArInvoiceRepository) {}

  async issueInvoice(invoice: ArInvoice, userId: string): Promise<ArInvoice> {
    if (!invoice.canBeIssued()) {
      throw new Error('Invoice cannot be issued in its current status');
    }

    invoice.status = ArInvoiceStatus.ISSUED;
    invoice.updatedBy = userId;

    return this.arInvoiceRepository.update(invoice);
  }

  async recordPayment(invoiceId: string, amount: number, organizationId: string, userId: string): Promise<ArInvoice> {
    const invoice = await this.arInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.canRecordPayment()) {
      throw new Error('Payment cannot be recorded for this invoice in its current status');
    }

    invoice.recordPayment(amount);
    invoice.updatedBy = userId;

    return this.arInvoiceRepository.update(invoice);
  }

  async cancelInvoice(invoiceId: string, organizationId: string, userId: string): Promise<ArInvoice> {
    const invoice = await this.arInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.canBeCancelled()) {
      throw new Error('Invoice cannot be cancelled in its current status');
    }

    invoice.status = ArInvoiceStatus.CANCELLED;
    invoice.updatedBy = userId;

    return this.arInvoiceRepository.update(invoice);
  }

  async getAgingAnalysis(customerId: string, organizationId: string, asOfDate: Date = new Date()): Promise<AgingAnalysis> {
    const invoices = await this.arInvoiceRepository.findByCustomer(customerId, organizationId);

    const paidAndCancelledInvoices = invoices.filter(
      inv => [ArInvoiceStatus.PAID, ArInvoiceStatus.CANCELLED].includes(inv.status),
    );

    const unpaidInvoices = invoices.filter(
      inv => ![ArInvoiceStatus.PAID, ArInvoiceStatus.CANCELLED].includes(inv.status),
    );

    let current = 0;
    let days30 = 0;
    let days60 = 0;
    let days90 = 0;
    let days120Plus = 0;

    for (const invoice of unpaidInvoices) {
      const daysOverdue = invoice.getDaysOverdue(asOfDate);
      const amountDue = invoice.amountDue;

      if (daysOverdue <= 30) {
        current += amountDue;
      } else if (daysOverdue <= 60) {
        days30 += amountDue;
      } else if (daysOverdue <= 90) {
        days60 += amountDue;
      } else if (daysOverdue <= 120) {
        days90 += amountDue;
      } else {
        days120Plus += amountDue;
      }
    }

    const totalDue = current + days30 + days60 + days90 + days120Plus;

    return {
      customerId,
      current,
      days30,
      days60,
      days90,
      days120Plus,
      totalDue,
    };
  }

  async getAgingAnalysisByOrganization(
    organizationId: string,
    asOfDate: Date = new Date(),
  ): Promise<Map<string, AgingAnalysis>> {
    const overdueInvoices = await this.arInvoiceRepository.findOverdue(organizationId, asOfDate);
    const agingMap = new Map<string, AgingAnalysis>();

    const customerMap = new Map<string, ArInvoice[]>();
    for (const invoice of overdueInvoices) {
      const existing = customerMap.get(invoice.customerId) || [];
      customerMap.set(invoice.customerId, [...existing, invoice]);
    }

    for (const [customerId] of customerMap) {
      const analysis = await this.getAgingAnalysis(customerId, organizationId, asOfDate);
      agingMap.set(customerId, analysis);
    }

    return agingMap;
  }

  async getDunningCandidates(organizationId: string, asOfDate: Date = new Date()): Promise<ArInvoice[]> {
    const overdueInvoices = await this.arInvoiceRepository.findOverdue(organizationId, asOfDate);
    return overdueInvoices.filter(
      inv => inv.getDaysOverdue(asOfDate) > 0 && inv.amountDue > 0,
    );
  }

  async getCustomerStatement(
    customerId: string,
    organizationId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    invoices: ArInvoice[];
    totalIssued: number;
    totalPaid: number;
    totalDue: number;
  }> {
    const invoices = await this.arInvoiceRepository.findByCustomer(customerId, organizationId);

    const filteredInvoices = invoices.filter(
      inv => inv.invoiceDate >= fromDate && inv.invoiceDate <= toDate,
    );

    const totalIssued = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalDue = filteredInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);

    return {
      invoices: filteredInvoices,
      totalIssued,
      totalPaid,
      totalDue,
    };
  }

  async applyCredit(invoiceId: string, creditAmount: number, organizationId: string, userId: string): Promise<ArInvoice> {
    const invoice = await this.arInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (creditAmount < 0) {
      throw new Error('Credit amount cannot be negative');
    }

    if (creditAmount > invoice.amountDue) {
      throw new Error('Credit amount cannot exceed amount due');
    }

    invoice.recordPayment(creditAmount);
    invoice.updatedBy = userId;

    return this.arInvoiceRepository.update(invoice);
  }

  async getCustomerCreditLimit(customerId: string, organizationId: string): Promise<number> {
    const invoices = await this.arInvoiceRepository.findByCustomer(customerId, organizationId);
    const totalDue = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    return totalDue;
  }
}
