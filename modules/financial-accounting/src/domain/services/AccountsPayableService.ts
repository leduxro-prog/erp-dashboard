import { ApInvoice, ApInvoiceStatus, ThreeWayMatchStatus } from '../entities/ApInvoice';
import { IApInvoiceRepository } from '../repositories/IApInvoiceRepository';

export interface AgingAnalysis {
  vendorId: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120Plus: number;
  totalDue: number;
}

export interface ThreeWayMatchResult {
  invoiceId: string;
  isMatched: boolean;
  matchStatus: ThreeWayMatchStatus;
  poAmount?: number;
  grnAmount?: number;
  invoiceAmount: number;
  variance?: number;
  variancePercent?: number;
}

export class AccountsPayableService {
  constructor(private apInvoiceRepository: IApInvoiceRepository) {}

  async receiveInvoice(invoice: ApInvoice, userId: string): Promise<ApInvoice> {
    if (!invoice.canBeReceived()) {
      throw new Error('Invoice cannot be received in its current status');
    }

    invoice.status = ApInvoiceStatus.RECEIVED;
    invoice.updatedBy = userId;

    return this.apInvoiceRepository.update(invoice);
  }

  async recordPayment(
    invoiceId: string,
    amount: number,
    organizationId: string,
    userId: string,
    discountTaken: number = 0,
  ): Promise<ApInvoice> {
    const invoice = await this.apInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.canRecordPayment()) {
      throw new Error('Payment cannot be recorded for this invoice in its current status');
    }

    invoice.recordPayment(amount, discountTaken);
    invoice.updatedBy = userId;

    return this.apInvoiceRepository.update(invoice);
  }

  async cancelInvoice(invoiceId: string, organizationId: string, userId: string): Promise<ApInvoice> {
    const invoice = await this.apInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.canBeCancelled()) {
      throw new Error('Invoice cannot be cancelled in its current status');
    }

    invoice.status = ApInvoiceStatus.CANCELLED;
    invoice.updatedBy = userId;

    return this.apInvoiceRepository.update(invoice);
  }

  async performThreeWayMatch(
    invoiceId: string,
    poAmount: number | null,
    grnAmount: number | null,
    organizationId: string,
    userId: string,
    tolerancePercent: number = 2,
  ): Promise<ThreeWayMatchResult> {
    const invoice = await this.apInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const invoiceAmount = invoice.totalAmount;
    let isMatched = true;
    let variancePercent = 0;

    if (poAmount && grnAmount) {
      const maxVariance = (invoiceAmount * tolerancePercent) / 100;
      const variance = Math.abs(invoiceAmount - grnAmount);

      if (variance > maxVariance) {
        isMatched = false;
        variancePercent = (variance / invoiceAmount) * 100;
        invoice.threeWayMatchStatus = ThreeWayMatchStatus.VARIANCE;
        invoice.matchVariancePercent = variancePercent;
      } else {
        invoice.threeWayMatchStatus = ThreeWayMatchStatus.COMPLETE;
        invoice.status = ApInvoiceStatus.MATCHED;
      }
    } else {
      invoice.threeWayMatchStatus = ThreeWayMatchStatus.PENDING;
    }

    invoice.updatedBy = userId;
    await this.apInvoiceRepository.update(invoice);

    return {
      invoiceId,
      isMatched,
      matchStatus: invoice.threeWayMatchStatus,
      poAmount: poAmount || undefined,
      grnAmount: grnAmount || undefined,
      invoiceAmount,
      variance: poAmount && grnAmount ? Math.abs(invoiceAmount - grnAmount) : undefined,
      variancePercent: variancePercent > 0 ? variancePercent : undefined,
    };
  }

  async getAgingAnalysis(vendorId: string, organizationId: string, asOfDate: Date = new Date()): Promise<AgingAnalysis> {
    const invoices = await this.apInvoiceRepository.findByVendor(vendorId, organizationId);

    const paidAndCancelledInvoices = invoices.filter(
      inv => [ApInvoiceStatus.PAID, ApInvoiceStatus.CANCELLED].includes(inv.status),
    );

    const unpaidInvoices = invoices.filter(
      inv => ![ApInvoiceStatus.PAID, ApInvoiceStatus.CANCELLED].includes(inv.status),
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
      vendorId,
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
    const overdueInvoices = await this.apInvoiceRepository.findOverdue(organizationId, asOfDate);
    const agingMap = new Map<string, AgingAnalysis>();

    const vendorMap = new Map<string, ApInvoice[]>();
    for (const invoice of overdueInvoices) {
      const existing = vendorMap.get(invoice.vendorId) || [];
      vendorMap.set(invoice.vendorId, [...existing, invoice]);
    }

    for (const [vendorId] of vendorMap) {
      const analysis = await this.getAgingAnalysis(vendorId, organizationId, asOfDate);
      agingMap.set(vendorId, analysis);
    }

    return agingMap;
  }

  async getVendorStatement(
    vendorId: string,
    organizationId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    invoices: ApInvoice[];
    totalReceived: number;
    totalPaid: number;
    totalDue: number;
  }> {
    const invoices = await this.apInvoiceRepository.findByVendor(vendorId, organizationId);

    const filteredInvoices = invoices.filter(
      inv => inv.invoiceDate >= fromDate && inv.invoiceDate <= toDate,
    );

    const totalReceived = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalDue = filteredInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);

    return {
      invoices: filteredInvoices,
      totalReceived,
      totalPaid,
      totalDue,
    };
  }

  async getEarlyPaymentOpportunities(
    organizationId: string,
    asOfDate: Date = new Date(),
  ): Promise<{ invoiceId: string; discount: number; discountPercent: number; dueDate: Date }[]> {
    const unpaidInvoices = await this.apInvoiceRepository.findUnpaid(organizationId);

    const opportunities = unpaidInvoices
      .map(inv => {
        const discount = inv.getEarlyPaymentDiscount(asOfDate);
        if (discount > 0) {
          return {
            invoiceId: inv.id,
            discount,
            discountPercent: inv.discountPercent || 0,
            dueDate: inv.dueDate,
          };
        }
        return null;
      })
      .filter((opp): opp is { invoiceId: string; discount: number; discountPercent: number; dueDate: Date } => opp !== null);

    return opportunities;
  }

  async getPaymentSchedule(invoiceId: string, organizationId: string): Promise<Array<{
    scheduleNumber: number;
    dueDate: Date;
    amount: number;
    discountPercent?: number;
    discountAmount: number;
    isPaid: boolean;
  }>> {
    const invoice = await this.apInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const schedules = invoice.lines.map((_, index) => ({
      scheduleNumber: index + 1,
      dueDate: invoice.dueDate,
      amount: invoice.totalAmount / invoice.lines.length,
      discountPercent: invoice.discountPercent,
      discountAmount: invoice.discountAmount,
      isPaid: false,
    }));

    return schedules;
  }

  async getUnmatchedInvoices(organizationId: string): Promise<ApInvoice[]> {
    return this.apInvoiceRepository.findUnmatched(organizationId);
  }

  async suggestPaymentAmount(invoiceId: string, organizationId: string, paymentDate: Date): Promise<number> {
    const invoice = await this.apInvoiceRepository.findById(invoiceId, organizationId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const discount = invoice.getEarlyPaymentDiscount(paymentDate);
    const baseAmount = invoice.amountDue;

    return baseAmount - discount;
  }
}
