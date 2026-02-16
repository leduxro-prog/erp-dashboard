import {
  VendorInvoice,
  InvoiceLine,
  InvoiceStatus,
  DisputeStatus,
} from '../entities/VendorInvoice';
import { IPaginationOptions, IPaginatedResult } from './IRequisitionRepository';

export interface IInvoiceRepository {
  create(invoice: VendorInvoice): Promise<VendorInvoice>;
  findById(id: string): Promise<VendorInvoice | null>;
  findByNumber(invoiceNumber: string): Promise<VendorInvoice | null>;
  findByVendorInvoiceNumber(
    vendorId: string,
    vendorInvoiceNumber: string
  ): Promise<VendorInvoice | null>;
  findByVendor(
    vendorId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<VendorInvoice>>;
  findByPO(poId: string): Promise<VendorInvoice[]>;
  findByStatus(
    status: InvoiceStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<VendorInvoice>>;
  findByDisputeStatus(
    status: DisputeStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<VendorInvoice>>;
  findDueSoon(days: number): Promise<VendorInvoice[]>;
  findOverdue(): Promise<VendorInvoice[]>;
  findAll(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<VendorInvoice>>;
  update(id: string, updates: Partial<VendorInvoice>): Promise<void>;
  delete(id: string): Promise<void>;

  // Line operations
  addLine(invoiceId: string, line: InvoiceLine): Promise<void>;
  updateLine(
    invoiceId: string,
    lineId: string,
    updates: Partial<InvoiceLine>
  ): Promise<void>;
  removeLine(invoiceId: string, lineId: string): Promise<void>;
  getLines(invoiceId: string): Promise<InvoiceLine[]>;

  // Match references
  addMatchReference(invoiceId: string, matchId: string): Promise<void>;
  removeMatchReference(invoiceId: string, matchId: string): Promise<void>;
  getMatchReferences(invoiceId: string): Promise<string[]>;

  // Utility
  existsByNumber(invoiceNumber: string): Promise<boolean>;
  countByVendor(vendorId: string): Promise<number>;
  countByStatus(status: InvoiceStatus): Promise<number>;
  countDuplicate(
    vendorId: string,
    vendorInvoiceNumber: string
  ): Promise<number>;
}
