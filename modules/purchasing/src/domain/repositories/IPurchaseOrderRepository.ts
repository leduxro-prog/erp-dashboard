import {
  PurchaseOrder,
  POLine,
  PORevision,
  POStatus,
  POType,
} from '../entities/PurchaseOrder';
import { IPaginationOptions, IPaginatedResult } from './IRequisitionRepository';

export interface IPurchaseOrderRepository {
  create(po: PurchaseOrder): Promise<PurchaseOrder>;
  findById(id: string): Promise<PurchaseOrder | null>;
  findByNumber(poNumber: string): Promise<PurchaseOrder | null>;
  findByVendor(
    vendorId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseOrder>>;
  findByStatus(
    status: POStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseOrder>>;
  findByType(
    type: POType,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseOrder>>;
  findByRequisition(requisitionId: string): Promise<PurchaseOrder | null>;
  findAll(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseOrder>>;
  update(id: string, updates: Partial<PurchaseOrder>): Promise<void>;
  delete(id: string): Promise<void>;

  // Line operations
  addLine(poId: string, line: POLine): Promise<void>;
  updateLine(poId: string, lineId: string, updates: Partial<POLine>): Promise<void>;
  removeLine(poId: string, lineId: string): Promise<void>;
  getLines(poId: string): Promise<POLine[]>;

  // Revision operations
  createRevision(revision: PORevision): Promise<PORevision>;
  getRevisions(poId: string): Promise<PORevision[]>;
  updateRevision(
    revisionId: string,
    updates: Partial<PORevision>
  ): Promise<void>;

  // Reference tracking
  addGRNReference(poId: string, grnId: string): Promise<void>;
  removeGRNReference(poId: string, grnId: string): Promise<void>;
  getGRNReferences(poId: string): Promise<string[]>;

  addInvoiceReference(poId: string, invoiceId: string): Promise<void>;
  removeInvoiceReference(poId: string, invoiceId: string): Promise<void>;
  getInvoiceReferences(poId: string): Promise<string[]>;

  // Utility
  existsByNumber(poNumber: string): Promise<boolean>;
  countByVendor(vendorId: string): Promise<number>;
  countByStatus(status: POStatus): Promise<number>;
}
