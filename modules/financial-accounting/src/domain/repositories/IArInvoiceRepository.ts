import { ArInvoice, ArInvoiceStatus } from '../entities/ArInvoice';

export interface IArInvoiceRepository {
  create(invoice: ArInvoice): Promise<ArInvoice>;
  update(invoice: ArInvoice): Promise<ArInvoice>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<ArInvoice | null>;
  findByNumber(invoiceNumber: string, organizationId: string): Promise<ArInvoice | null>;
  findByCustomer(customerId: string, organizationId: string): Promise<ArInvoice[]>;
  findByStatus(status: ArInvoiceStatus, organizationId: string): Promise<ArInvoice[]>;
  findByDateRange(startDate: Date, endDate: Date, organizationId: string): Promise<ArInvoice[]>;
  findOverdue(organizationId: string, asOfDate?: Date): Promise<ArInvoice[]>;
  findUnpaid(organizationId: string): Promise<ArInvoice[]>;
  findByOrder(orderId: string, organizationId: string): Promise<ArInvoice | null>;
  getNextInvoiceNumber(organizationId: string): Promise<string>;
  getAgeingSummary(organizationId: string, asOfDate?: Date): Promise<Map<string, number>>;
}
