import { ApInvoice, ApInvoiceStatus } from '../entities/ApInvoice';

export interface IApInvoiceRepository {
  create(invoice: ApInvoice): Promise<ApInvoice>;
  update(invoice: ApInvoice): Promise<ApInvoice>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<ApInvoice | null>;
  findByNumber(invoiceNumber: string, organizationId: string): Promise<ApInvoice | null>;
  findByVendor(vendorId: string, organizationId: string): Promise<ApInvoice[]>;
  findByStatus(status: ApInvoiceStatus, organizationId: string): Promise<ApInvoice[]>;
  findByDateRange(startDate: Date, endDate: Date, organizationId: string): Promise<ApInvoice[]>;
  findOverdue(organizationId: string, asOfDate?: Date): Promise<ApInvoice[]>;
  findUnpaid(organizationId: string): Promise<ApInvoice[]>;
  findUnmatched(organizationId: string): Promise<ApInvoice[]>;
  findByPoNumber(poNumber: string, organizationId: string): Promise<ApInvoice[]>;
  getNextInvoiceNumber(organizationId: string): Promise<string>;
  getAgeingSummary(organizationId: string, asOfDate?: Date): Promise<Map<string, number>>;
}
