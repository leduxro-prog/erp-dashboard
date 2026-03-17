import { randomUUID } from 'crypto';

import {
  PurchaseRequisition,
  RequisitionApprovalStep,
  RequisitionLine,
  RequisitionStatus,
} from '../../domain/entities/PurchaseRequisition';
import {
  POLine,
  PORevision,
  POStatus,
  POType,
  PurchaseOrder,
} from '../../domain/entities/PurchaseOrder';
import {
  GoodsReceiptNote,
  GRNLine,
  GRNStatus,
  ReturnItem,
} from '../../domain/entities/GoodsReceiptNote';
import {
  DisputeStatus,
  InvoiceLine,
  InvoiceStatus,
  VendorInvoice,
} from '../../domain/entities/VendorInvoice';
import {
  ExceptionType,
  MatchException,
  MatchExceptionResolution,
  MatchStatus,
  ThreeWayMatch,
} from '../../domain/entities/ThreeWayMatch';
import {
  BudgetPeriod,
  BudgetStatus,
  PurchaseBudget,
} from '../../domain/entities/Budget';
import {
  IBudgetRepository,
} from '../../domain/repositories/IBudgetRepository';
import {
  IGRNRepository,
} from '../../domain/repositories/IGRNRepository';
import {
  IInvoiceRepository,
} from '../../domain/repositories/IInvoiceRepository';
import {
  IMatchRepository,
} from '../../domain/repositories/IMatchRepository';
import {
  IPaginationOptions,
  IPaginatedResult,
  IRequisitionRepository,
} from '../../domain/repositories/IRequisitionRepository';
import {
  IPurchaseOrderRepository,
} from '../../domain/repositories/IPurchaseOrderRepository';

function asDate(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value).getTime();
  }
  return 0;
}

function sortRows<T>(rows: T[], options: IPaginationOptions): T[] {
  const sortBy = options.sortBy || 'createdAt';
  const direction = options.sortOrder === 'ASC' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = (left as any)[sortBy];
    const rightValue = (right as any)[sortBy];

    if (leftValue instanceof Date || rightValue instanceof Date) {
      return (asDate(leftValue) - asDate(rightValue)) * direction;
    }

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue || '').localeCompare(String(rightValue || '')) * direction;
  });
}

function paginate<T>(rows: T[], options: IPaginationOptions): IPaginatedResult<T> {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const sorted = sortRows(rows, options);
  const start = (page - 1) * limit;
  const data = sorted.slice(start, start + limit);

  return {
    data,
    total: sorted.length,
    page,
    limit,
    hasMore: start + limit < sorted.length,
  };
}

export class InMemoryRequisitionRepository implements IRequisitionRepository {
  private readonly store = new Map<string, PurchaseRequisition>();

  async create(requisition: PurchaseRequisition): Promise<PurchaseRequisition> {
    requisition.id = requisition.id || randomUUID();
    requisition.lines = requisition.lines || [];
    requisition.approvals = requisition.approvals || [];
    requisition.createdAt = requisition.createdAt || new Date();
    requisition.updatedAt = requisition.updatedAt || new Date();
    this.store.set(requisition.id, requisition);
    return requisition;
  }

  async findById(id: string): Promise<PurchaseRequisition | null> {
    return this.store.get(id) || null;
  }

  async findByNumber(requisitionNumber: string): Promise<PurchaseRequisition | null> {
    return [...this.store.values()].find((item) => item.requisitionNumber === requisitionNumber) || null;
  }

  async findByDepartment(
    departmentId: string,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseRequisition>> {
    return paginate(
      [...this.store.values()].filter((item) => item.departmentId === departmentId),
      options,
    );
  }

  async findByStatus(
    status: RequisitionStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseRequisition>> {
    return paginate(
      [...this.store.values()].filter((item) => item.status === status),
      options,
    );
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<PurchaseRequisition>> {
    return paginate([...this.store.values()], options);
  }

  async update(id: string, updates: Partial<PurchaseRequisition>): Promise<void> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('Requisition not found');
    }
    Object.assign(current, updates, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async addLine(requisitionId: string, line: RequisitionLine): Promise<void> {
    const current = this.store.get(requisitionId);
    if (!current) {
      throw new Error('Requisition not found');
    }
    line.id = line.id || randomUUID();
    current.lines = current.lines || [];
    current.lines.push(line);
    current.updatedAt = new Date();
  }

  async updateLine(
    requisitionId: string,
    lineId: string,
    updates: Partial<RequisitionLine>,
  ): Promise<void> {
    const current = this.store.get(requisitionId);
    if (!current) {
      throw new Error('Requisition not found');
    }
    current.lines = (current.lines || []).map((line) =>
      line.id === lineId ? ({ ...line, ...updates, updatedAt: new Date() } as RequisitionLine) : line,
    );
    current.updatedAt = new Date();
  }

  async removeLine(requisitionId: string, lineId: string): Promise<void> {
    const current = this.store.get(requisitionId);
    if (!current) {
      throw new Error('Requisition not found');
    }
    current.lines = (current.lines || []).filter((line) => line.id !== lineId);
    current.updatedAt = new Date();
  }

  async addApprovalStep(
    requisitionId: string,
    approval: RequisitionApprovalStep,
  ): Promise<void> {
    const current = this.store.get(requisitionId);
    if (!current) {
      throw new Error('Requisition not found');
    }
    approval.id = approval.id || randomUUID();
    current.approvals = current.approvals || [];
    current.approvals.push(approval);
    current.updatedAt = new Date();
  }

  async updateApprovalStep(
    requisitionId: string,
    approvalId: string,
    updates: Partial<RequisitionApprovalStep>,
  ): Promise<void> {
    const current = this.store.get(requisitionId);
    if (!current) {
      throw new Error('Requisition not found');
    }
    current.approvals = (current.approvals || []).map((step) =>
      step.id === approvalId ? ({ ...step, ...updates } as RequisitionApprovalStep) : step,
    );
    current.updatedAt = new Date();
  }

  async getApprovalSteps(requisitionId: string): Promise<RequisitionApprovalStep[]> {
    const current = this.store.get(requisitionId);
    return current?.approvals || [];
  }

  async existsByNumber(requisitionNumber: string): Promise<boolean> {
    return [...this.store.values()].some((item) => item.requisitionNumber === requisitionNumber);
  }

  async countByDepartment(departmentId: string): Promise<number> {
    return [...this.store.values()].filter((item) => item.departmentId === departmentId).length;
  }
}

export class InMemoryPurchaseOrderRepository implements IPurchaseOrderRepository {
  private readonly store = new Map<string, PurchaseOrder>();

  async create(po: PurchaseOrder): Promise<PurchaseOrder> {
    po.id = po.id || randomUUID();
    po.lines = po.lines || [];
    po.revisions = po.revisions || [];
    po.grnReferences = po.grnReferences || [];
    po.invoiceReferences = po.invoiceReferences || [];
    po.createdAt = po.createdAt || new Date();
    po.updatedAt = po.updatedAt || new Date();
    this.store.set(po.id, po);
    return po;
  }

  async findById(id: string): Promise<PurchaseOrder | null> {
    return this.store.get(id) || null;
  }

  async findByNumber(poNumber: string): Promise<PurchaseOrder | null> {
    return [...this.store.values()].find((item) => item.poNumber === poNumber) || null;
  }

  async findByVendor(
    vendorId: string,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseOrder>> {
    return paginate(
      [...this.store.values()].filter((item) => item.vendorId === vendorId),
      options,
    );
  }

  async findByStatus(
    status: POStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseOrder>> {
    return paginate(
      [...this.store.values()].filter((item) => item.status === status),
      options,
    );
  }

  async findByType(
    type: POType,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseOrder>> {
    return paginate(
      [...this.store.values()].filter((item) => item.type === type),
      options,
    );
  }

  async findByRequisition(requisitionId: string): Promise<PurchaseOrder | null> {
    return [...this.store.values()].find((item) => item.requisitionId === requisitionId) || null;
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<PurchaseOrder>> {
    return paginate([...this.store.values()], options);
  }

  async update(id: string, updates: Partial<PurchaseOrder>): Promise<void> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('Purchase order not found');
    }
    Object.assign(current, updates, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async addLine(poId: string, line: POLine): Promise<void> {
    const current = this.store.get(poId);
    if (!current) {
      throw new Error('Purchase order not found');
    }
    line.id = line.id || randomUUID();
    current.lines = current.lines || [];
    current.lines.push(line);
    current.updatedAt = new Date();
  }

  async updateLine(poId: string, lineId: string, updates: Partial<POLine>): Promise<void> {
    const current = this.store.get(poId);
    if (!current) {
      throw new Error('Purchase order not found');
    }
    current.lines = (current.lines || []).map((line) =>
      line.id === lineId ? ({ ...line, ...updates, updatedAt: new Date() } as POLine) : line,
    );
    current.updatedAt = new Date();
  }

  async removeLine(poId: string, lineId: string): Promise<void> {
    const current = this.store.get(poId);
    if (!current) {
      throw new Error('Purchase order not found');
    }
    current.lines = (current.lines || []).filter((line) => line.id !== lineId);
    current.updatedAt = new Date();
  }

  async getLines(poId: string): Promise<POLine[]> {
    return this.store.get(poId)?.lines || [];
  }

  async createRevision(revision: PORevision): Promise<PORevision> {
    const po = this.store.get(revision.poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    revision.id = revision.id || randomUUID();
    po.revisions = po.revisions || [];
    po.revisions.push(revision);
    po.updatedAt = new Date();
    return revision;
  }

  async getRevisions(poId: string): Promise<PORevision[]> {
    return this.store.get(poId)?.revisions || [];
  }

  async updateRevision(revisionId: string, updates: Partial<PORevision>): Promise<void> {
    for (const po of this.store.values()) {
      po.revisions = (po.revisions || []).map((revision) =>
        revision.id === revisionId ? ({ ...revision, ...updates } as PORevision) : revision,
      );
    }
  }

  async addGRNReference(poId: string, grnId: string): Promise<void> {
    const po = this.store.get(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.grnReferences = po.grnReferences || [];
    if (!po.grnReferences.includes(grnId)) {
      po.grnReferences.push(grnId);
    }
  }

  async removeGRNReference(poId: string, grnId: string): Promise<void> {
    const po = this.store.get(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.grnReferences = (po.grnReferences || []).filter((id) => id !== grnId);
  }

  async getGRNReferences(poId: string): Promise<string[]> {
    return this.store.get(poId)?.grnReferences || [];
  }

  async addInvoiceReference(poId: string, invoiceId: string): Promise<void> {
    const po = this.store.get(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.invoiceReferences = po.invoiceReferences || [];
    if (!po.invoiceReferences.includes(invoiceId)) {
      po.invoiceReferences.push(invoiceId);
    }
  }

  async removeInvoiceReference(poId: string, invoiceId: string): Promise<void> {
    const po = this.store.get(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.invoiceReferences = (po.invoiceReferences || []).filter((id) => id !== invoiceId);
  }

  async getInvoiceReferences(poId: string): Promise<string[]> {
    return this.store.get(poId)?.invoiceReferences || [];
  }

  async existsByNumber(poNumber: string): Promise<boolean> {
    return [...this.store.values()].some((po) => po.poNumber === poNumber);
  }

  async countByVendor(vendorId: string): Promise<number> {
    return [...this.store.values()].filter((po) => po.vendorId === vendorId).length;
  }

  async countByStatus(status: POStatus): Promise<number> {
    return [...this.store.values()].filter((po) => po.status === status).length;
  }
}

export class InMemoryGRNRepository implements IGRNRepository {
  private readonly store = new Map<string, GoodsReceiptNote>();

  async create(grn: GoodsReceiptNote): Promise<GoodsReceiptNote> {
    grn.id = grn.id || randomUUID();
    grn.lines = grn.lines || [];
    grn.returnedItems = grn.returnedItems || [];
    grn.createdAt = grn.createdAt || new Date();
    grn.updatedAt = grn.updatedAt || new Date();
    this.store.set(grn.id, grn);
    return grn;
  }

  async findById(id: string): Promise<GoodsReceiptNote | null> {
    return this.store.get(id) || null;
  }

  async findByNumber(grnNumber: string): Promise<GoodsReceiptNote | null> {
    return [...this.store.values()].find((item) => item.grnNumber === grnNumber) || null;
  }

  async findByPO(poId: string): Promise<GoodsReceiptNote[]> {
    return [...this.store.values()].filter((item) => item.poId === poId);
  }

  async findByVendor(
    vendorId: string,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<GoodsReceiptNote>> {
    return paginate(
      [...this.store.values()].filter((item) => item.vendorId === vendorId),
      options,
    );
  }

  async findByStatus(
    status: GRNStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<GoodsReceiptNote>> {
    return paginate(
      [...this.store.values()].filter((item) => item.status === status),
      options,
    );
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<GoodsReceiptNote>> {
    return paginate([...this.store.values()], options);
  }

  async update(id: string, updates: Partial<GoodsReceiptNote>): Promise<void> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('GRN not found');
    }
    Object.assign(current, updates, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async addLine(grnId: string, line: GRNLine): Promise<void> {
    const current = this.store.get(grnId);
    if (!current) {
      throw new Error('GRN not found');
    }
    line.id = line.id || randomUUID();
    current.lines = current.lines || [];
    current.lines.push(line);
    current.updatedAt = new Date();
  }

  async updateLine(grnId: string, lineId: string, updates: Partial<GRNLine>): Promise<void> {
    const current = this.store.get(grnId);
    if (!current) {
      throw new Error('GRN not found');
    }
    current.lines = (current.lines || []).map((line) =>
      line.id === lineId ? ({ ...line, ...updates, updatedAt: new Date() } as GRNLine) : line,
    );
    current.updatedAt = new Date();
  }

  async removeLine(grnId: string, lineId: string): Promise<void> {
    const current = this.store.get(grnId);
    if (!current) {
      throw new Error('GRN not found');
    }
    current.lines = (current.lines || []).filter((line) => line.id !== lineId);
    current.updatedAt = new Date();
  }

  async getLines(grnId: string): Promise<GRNLine[]> {
    return this.store.get(grnId)?.lines || [];
  }

  async addReturnItem(grnId: string, item: ReturnItem): Promise<void> {
    const current = this.store.get(grnId);
    if (!current) {
      throw new Error('GRN not found');
    }
    item.id = item.id || randomUUID();
    current.returnedItems = current.returnedItems || [];
    current.returnedItems.push(item);
    current.updatedAt = new Date();
  }

  async updateReturnItem(
    grnId: string,
    returnId: string,
    updates: Partial<ReturnItem>,
  ): Promise<void> {
    const current = this.store.get(grnId);
    if (!current) {
      throw new Error('GRN not found');
    }
    current.returnedItems = (current.returnedItems || []).map((item) =>
      item.id === returnId ? ({ ...item, ...updates, updatedAt: new Date() } as ReturnItem) : item,
    );
    current.updatedAt = new Date();
  }

  async removeReturnItem(grnId: string, returnId: string): Promise<void> {
    const current = this.store.get(grnId);
    if (!current) {
      throw new Error('GRN not found');
    }
    current.returnedItems = (current.returnedItems || []).filter((item) => item.id !== returnId);
    current.updatedAt = new Date();
  }

  async getReturnItems(grnId: string): Promise<ReturnItem[]> {
    return this.store.get(grnId)?.returnedItems || [];
  }

  async getReturnItemsByStatus(status: string): Promise<ReturnItem[]> {
    const results: ReturnItem[] = [];
    for (const grn of this.store.values()) {
      results.push(...(grn.returnedItems || []).filter((item) => item.status === status));
    }
    return results;
  }

  async existsByNumber(grnNumber: string): Promise<boolean> {
    return [...this.store.values()].some((grn) => grn.grnNumber === grnNumber);
  }

  async countByPO(poId: string): Promise<number> {
    return [...this.store.values()].filter((grn) => grn.poId === poId).length;
  }

  async countByStatus(status: GRNStatus): Promise<number> {
    return [...this.store.values()].filter((grn) => grn.status === status).length;
  }
}

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private readonly store = new Map<string, VendorInvoice>();

  async create(invoice: VendorInvoice): Promise<VendorInvoice> {
    invoice.id = invoice.id || randomUUID();
    invoice.lines = invoice.lines || [];
    invoice.matchReferences = invoice.matchReferences || [];
    invoice.createdAt = invoice.createdAt || new Date();
    invoice.updatedAt = invoice.updatedAt || new Date();
    this.store.set(invoice.id, invoice);
    return invoice;
  }

  async findById(id: string): Promise<VendorInvoice | null> {
    return this.store.get(id) || null;
  }

  async findByNumber(invoiceNumber: string): Promise<VendorInvoice | null> {
    return [...this.store.values()].find((item) => item.invoiceNumber === invoiceNumber) || null;
  }

  async findByVendorInvoiceNumber(
    vendorId: string,
    vendorInvoiceNumber: string,
  ): Promise<VendorInvoice | null> {
    return [...this.store.values()].find(
      (item) => item.vendorId === vendorId && item.vendorInvoiceNumber === vendorInvoiceNumber,
    ) || null;
  }

  async findByVendor(
    vendorId: string,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<VendorInvoice>> {
    return paginate(
      [...this.store.values()].filter((item) => item.vendorId === vendorId),
      options,
    );
  }

  async findByPO(poId: string): Promise<VendorInvoice[]> {
    return [...this.store.values()].filter((item) => item.poId === poId);
  }

  async findByStatus(
    status: InvoiceStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<VendorInvoice>> {
    return paginate(
      [...this.store.values()].filter((item) => item.status === status),
      options,
    );
  }

  async findByDisputeStatus(
    status: DisputeStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<VendorInvoice>> {
    return paginate(
      [...this.store.values()].filter((item) => item.dispatchStatus === status),
      options,
    );
  }

  async findDueSoon(days: number): Promise<VendorInvoice[]> {
    const now = new Date();
    const max = new Date(now);
    max.setDate(max.getDate() + days);
    return [...this.store.values()].filter(
      (item) => item.dueDate >= now && item.dueDate <= max,
    );
  }

  async findOverdue(): Promise<VendorInvoice[]> {
    const now = new Date();
    return [...this.store.values()].filter((item) => item.dueDate < now && item.status !== InvoiceStatus.PAID);
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<VendorInvoice>> {
    return paginate([...this.store.values()], options);
  }

  async update(id: string, updates: Partial<VendorInvoice>): Promise<void> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('Invoice not found');
    }
    Object.assign(current, updates, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async addLine(invoiceId: string, line: InvoiceLine): Promise<void> {
    const current = this.store.get(invoiceId);
    if (!current) {
      throw new Error('Invoice not found');
    }
    line.id = line.id || randomUUID();
    current.lines = current.lines || [];
    current.lines.push(line);
    current.updatedAt = new Date();
  }

  async updateLine(
    invoiceId: string,
    lineId: string,
    updates: Partial<InvoiceLine>,
  ): Promise<void> {
    const current = this.store.get(invoiceId);
    if (!current) {
      throw new Error('Invoice not found');
    }
    current.lines = (current.lines || []).map((line) =>
      line.id === lineId ? ({ ...line, ...updates, updatedAt: new Date() } as InvoiceLine) : line,
    );
    current.updatedAt = new Date();
  }

  async removeLine(invoiceId: string, lineId: string): Promise<void> {
    const current = this.store.get(invoiceId);
    if (!current) {
      throw new Error('Invoice not found');
    }
    current.lines = (current.lines || []).filter((line) => line.id !== lineId);
    current.updatedAt = new Date();
  }

  async getLines(invoiceId: string): Promise<InvoiceLine[]> {
    return this.store.get(invoiceId)?.lines || [];
  }

  async addMatchReference(invoiceId: string, matchId: string): Promise<void> {
    const current = this.store.get(invoiceId);
    if (!current) {
      throw new Error('Invoice not found');
    }
    current.matchReferences = current.matchReferences || [];
    if (!current.matchReferences.includes(matchId)) {
      current.matchReferences.push(matchId);
    }
  }

  async removeMatchReference(invoiceId: string, matchId: string): Promise<void> {
    const current = this.store.get(invoiceId);
    if (!current) {
      throw new Error('Invoice not found');
    }
    current.matchReferences = (current.matchReferences || []).filter((id) => id !== matchId);
  }

  async getMatchReferences(invoiceId: string): Promise<string[]> {
    return this.store.get(invoiceId)?.matchReferences || [];
  }

  async existsByNumber(invoiceNumber: string): Promise<boolean> {
    return [...this.store.values()].some((invoice) => invoice.invoiceNumber === invoiceNumber);
  }

  async countByVendor(vendorId: string): Promise<number> {
    return [...this.store.values()].filter((invoice) => invoice.vendorId === vendorId).length;
  }

  async countByStatus(status: InvoiceStatus): Promise<number> {
    return [...this.store.values()].filter((invoice) => invoice.status === status).length;
  }

  async countDuplicate(vendorId: string, vendorInvoiceNumber: string): Promise<number> {
    return [...this.store.values()].filter(
      (invoice) =>
        invoice.vendorId === vendorId &&
        invoice.vendorInvoiceNumber === vendorInvoiceNumber,
    ).length;
  }
}

export class InMemoryMatchRepository implements IMatchRepository {
  private readonly store = new Map<string, ThreeWayMatch>();
  private readonly resolutions = new Map<string, MatchExceptionResolution[]>();

  async create(match: ThreeWayMatch): Promise<ThreeWayMatch> {
    match.id = match.id || randomUUID();
    match.exceptions = match.exceptions || [];
    match.createdAt = match.createdAt || new Date();
    match.updatedAt = match.updatedAt || new Date();
    this.store.set(match.id, match);
    return match;
  }

  async findById(id: string): Promise<ThreeWayMatch | null> {
    return this.store.get(id) || null;
  }

  async findByPO(poId: string): Promise<ThreeWayMatch[]> {
    return [...this.store.values()].filter((item) => item.poId === poId);
  }

  async findByGRN(grnId: string): Promise<ThreeWayMatch | null> {
    return [...this.store.values()].find((item) => item.grnId === grnId) || null;
  }

  async findByInvoice(invoiceId: string): Promise<ThreeWayMatch | null> {
    return [...this.store.values()].find((item) => item.invoiceId === invoiceId) || null;
  }

  async findByStatus(
    status: MatchStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<ThreeWayMatch>> {
    return paginate(
      [...this.store.values()].filter((item) => item.status === status),
      options,
    );
  }

  async findWithExceptions(options: IPaginationOptions): Promise<IPaginatedResult<ThreeWayMatch>> {
    return paginate(
      [...this.store.values()].filter((item) => (item.exceptions || []).length > 0),
      options,
    );
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<ThreeWayMatch>> {
    return paginate([...this.store.values()], options);
  }

  async update(id: string, updates: Partial<ThreeWayMatch>): Promise<void> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('Match not found');
    }
    Object.assign(current, updates, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async addException(matchId: string, exception: MatchException): Promise<void> {
    const current = this.store.get(matchId);
    if (!current) {
      throw new Error('Match not found');
    }
    exception.id = exception.id || randomUUID();
    current.exceptions = current.exceptions || [];
    current.exceptions.push(exception);
    current.updatedAt = new Date();
  }

  async updateException(exceptionId: string, updates: Partial<MatchException>): Promise<void> {
    for (const match of this.store.values()) {
      match.exceptions = (match.exceptions || []).map((exception) =>
        exception.id === exceptionId
          ? ({ ...exception, ...updates, updatedAt: new Date() } as MatchException)
          : exception,
      );
      match.updatedAt = new Date();
    }
  }

  async removeException(matchId: string, exceptionId: string): Promise<void> {
    const current = this.store.get(matchId);
    if (!current) {
      throw new Error('Match not found');
    }
    current.exceptions = (current.exceptions || []).filter((exception) => exception.id !== exceptionId);
    current.updatedAt = new Date();
  }

  async getExceptions(matchId: string): Promise<MatchException[]> {
    return this.store.get(matchId)?.exceptions || [];
  }

  async getExceptionsByType(type: ExceptionType): Promise<MatchException[]> {
    const results: MatchException[] = [];
    for (const match of this.store.values()) {
      results.push(...(match.exceptions || []).filter((exception) => exception.type === type));
    }
    return results;
  }

  async getPendingExceptions(): Promise<MatchException[]> {
    const results: MatchException[] = [];
    for (const match of this.store.values()) {
      results.push(...(match.exceptions || []).filter((exception) => exception.status === 'pending'));
    }
    return results;
  }

  async createResolution(
    resolution: MatchExceptionResolution,
  ): Promise<MatchExceptionResolution> {
    resolution.id = resolution.id || randomUUID();
    const list = this.resolutions.get(resolution.exceptionId) || [];
    list.push(resolution);
    this.resolutions.set(resolution.exceptionId, list);
    return resolution;
  }

  async getResolutions(exceptionId: string): Promise<MatchExceptionResolution[]> {
    return this.resolutions.get(exceptionId) || [];
  }

  async countByStatus(status: MatchStatus): Promise<number> {
    return [...this.store.values()].filter((match) => match.status === status).length;
  }

  async countWithExceptions(): Promise<number> {
    return [...this.store.values()].filter((match) => (match.exceptions || []).length > 0).length;
  }
}

export class InMemoryBudgetRepository implements IBudgetRepository {
  private readonly store = new Map<string, PurchaseBudget>();

  async create(budget: PurchaseBudget): Promise<PurchaseBudget> {
    budget.id = budget.id || randomUUID();
    budget.createdAt = budget.createdAt || new Date();
    budget.updatedAt = budget.updatedAt || new Date();
    this.store.set(budget.id, budget);
    return budget;
  }

  async findById(id: string): Promise<PurchaseBudget | null> {
    return this.store.get(id) || null;
  }

  async findByCode(budgetCode: string): Promise<PurchaseBudget | null> {
    return [...this.store.values()].find((item) => item.budgetCode === budgetCode) || null;
  }

  async findByDepartment(
    departmentId: string,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseBudget>> {
    return paginate(
      [...this.store.values()].filter((item) => item.departmentId === departmentId),
      options,
    );
  }

  async findByStatus(
    status: BudgetStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseBudget>> {
    return paginate(
      [...this.store.values()].filter((item) => item.status === status),
      options,
    );
  }

  async findByPeriod(
    period: BudgetPeriod,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseBudget>> {
    return paginate(
      [...this.store.values()].filter((item) => item.period === period),
      options,
    );
  }

  async findActive(departmentId?: string): Promise<PurchaseBudget[]> {
    return [...this.store.values()].filter(
      (item) =>
        item.status === BudgetStatus.ACTIVE &&
        (!departmentId || item.departmentId === departmentId),
    );
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<PurchaseBudget>> {
    return paginate([...this.store.values()], options);
  }

  async update(id: string, updates: Partial<PurchaseBudget>): Promise<void> {
    const current = this.store.get(id);
    if (!current) {
      throw new Error('Budget not found');
    }
    Object.assign(current, updates, { updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async existsByCode(budgetCode: string): Promise<boolean> {
    return [...this.store.values()].some((item) => item.budgetCode === budgetCode);
  }

  async countByDepartment(departmentId: string): Promise<number> {
    return [...this.store.values()].filter((item) => item.departmentId === departmentId).length;
  }

  async countByStatus(status: BudgetStatus): Promise<number> {
    return [...this.store.values()].filter((item) => item.status === status).length;
  }
}
