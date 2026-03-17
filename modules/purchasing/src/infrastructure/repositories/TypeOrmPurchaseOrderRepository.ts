import { randomUUID } from 'crypto';
import { FindOptionsOrder, Repository } from 'typeorm';

import {
  POLine,
  PORevision,
  POStatus,
  POType,
  PurchaseOrder,
} from '../../domain/entities/PurchaseOrder';
import {
  IPaginatedResult,
  IPaginationOptions,
} from '../../domain/repositories/IRequisitionRepository';
import { IPurchaseOrderRepository } from '../../domain/repositories/IPurchaseOrderRepository';
import { PurchaseOrderEntity } from '../entities/PurchaseOrderEntity';

export class TypeOrmPurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly repository: Repository<PurchaseOrderEntity>) {}

  async create(po: PurchaseOrder): Promise<PurchaseOrder> {
    po.id = po.id || randomUUID();
    const saved = await this.repository.save(this.toEntity(po));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<PurchaseOrder | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(poNumber: string): Promise<PurchaseOrder | null> {
    const entity = await this.repository.findOne({ where: { poNumber } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByVendor(vendorId: string, options: IPaginationOptions): Promise<IPaginatedResult<PurchaseOrder>> {
    return this.findPaginated({ vendorId }, options);
  }

  async findByStatus(status: POStatus, options: IPaginationOptions): Promise<IPaginatedResult<PurchaseOrder>> {
    return this.findPaginated({ status }, options);
  }

  async findByType(type: POType, options: IPaginationOptions): Promise<IPaginatedResult<PurchaseOrder>> {
    return this.findPaginated({ type }, options);
  }

  async findByRequisition(requisitionId: string): Promise<PurchaseOrder | null> {
    const entity = await this.repository.findOne({ where: { requisitionId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<PurchaseOrder>> {
    return this.findPaginated({}, options);
  }

  async update(id: string, updates: Partial<PurchaseOrder>): Promise<void> {
    const po = await this.findById(id);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    Object.assign(po, updates, { updatedAt: new Date() });
    await this.repository.save(this.toEntity(po));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async addLine(poId: string, line: POLine): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    line.id = line.id || randomUUID();
    po.lines = po.lines || [];
    po.lines.push(line);
    po.updatedAt = new Date();
    await this.repository.save(this.toEntity(po));
  }

  async updateLine(poId: string, lineId: string, updates: Partial<POLine>): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.lines = (po.lines || []).map((line) => {
      if (line.id !== lineId) {
        return line;
      }
      Object.assign(line, updates, { updatedAt: new Date() });
      return line;
    });
    po.updatedAt = new Date();
    await this.repository.save(this.toEntity(po));
  }

  async removeLine(poId: string, lineId: string): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.lines = (po.lines || []).filter((line) => line.id !== lineId);
    po.updatedAt = new Date();
    await this.repository.save(this.toEntity(po));
  }

  async getLines(poId: string): Promise<POLine[]> {
    const po = await this.findById(poId);
    return po?.lines || [];
  }

  async createRevision(revision: PORevision): Promise<PORevision> {
    const po = await this.findById(revision.poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    revision.id = revision.id || randomUUID();
    po.revisions = po.revisions || [];
    po.revisions.push(revision);
    po.updatedAt = new Date();
    await this.repository.save(this.toEntity(po));
    return revision;
  }

  async getRevisions(poId: string): Promise<PORevision[]> {
    const po = await this.findById(poId);
    return po?.revisions || [];
  }

  async updateRevision(revisionId: string, updates: Partial<PORevision>): Promise<void> {
    const [row] = await this.repository.find({
      where: {},
      take: 1,
    });
    if (!row) {
      return;
    }
    const all = await this.repository.find();
    for (const item of all) {
      const po = this.toDomain(item);
      po.revisions = (po.revisions || []).map((revision) =>
        revision.id === revisionId ? ({ ...revision, ...updates } as PORevision) : revision,
      );
      await this.repository.save(this.toEntity(po));
    }
  }

  async addGRNReference(poId: string, grnId: string): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.grnReferences = po.grnReferences || [];
    if (!po.grnReferences.includes(grnId)) {
      po.grnReferences.push(grnId);
      po.updatedAt = new Date();
      await this.repository.save(this.toEntity(po));
    }
  }

  async removeGRNReference(poId: string, grnId: string): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.grnReferences = (po.grnReferences || []).filter((item) => item !== grnId);
    po.updatedAt = new Date();
    await this.repository.save(this.toEntity(po));
  }

  async getGRNReferences(poId: string): Promise<string[]> {
    const po = await this.findById(poId);
    return po?.grnReferences || [];
  }

  async addInvoiceReference(poId: string, invoiceId: string): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.invoiceReferences = po.invoiceReferences || [];
    if (!po.invoiceReferences.includes(invoiceId)) {
      po.invoiceReferences.push(invoiceId);
      po.updatedAt = new Date();
      await this.repository.save(this.toEntity(po));
    }
  }

  async removeInvoiceReference(poId: string, invoiceId: string): Promise<void> {
    const po = await this.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }
    po.invoiceReferences = (po.invoiceReferences || []).filter((item) => item !== invoiceId);
    po.updatedAt = new Date();
    await this.repository.save(this.toEntity(po));
  }

  async getInvoiceReferences(poId: string): Promise<string[]> {
    const po = await this.findById(poId);
    return po?.invoiceReferences || [];
  }

  async existsByNumber(poNumber: string): Promise<boolean> {
    return (await this.repository.count({ where: { poNumber } })) > 0;
  }

  async countByVendor(vendorId: string): Promise<number> {
    return this.repository.count({ where: { vendorId } });
  }

  async countByStatus(status: POStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  private async findPaginated(
    where: Partial<PurchaseOrderEntity>,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseOrder>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortKey = this.resolveSortField(options.sortBy);
    const order: FindOptionsOrder<PurchaseOrderEntity> = {
      [sortKey]: options.sortOrder || 'DESC',
    };

    const [rows, total] = await this.repository.findAndCount({
      where: where as any,
      order,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => this.toDomain(row)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  private resolveSortField(sortBy?: string): keyof PurchaseOrderEntity {
    const allowed: Array<keyof PurchaseOrderEntity> = [
      'createdAt',
      'updatedAt',
      'requiredByDate',
      'poNumber',
      'status',
    ];
    if (sortBy && allowed.includes(sortBy as keyof PurchaseOrderEntity)) {
      return sortBy as keyof PurchaseOrderEntity;
    }
    return 'createdAt';
  }

  private toEntity(po: PurchaseOrder): PurchaseOrderEntity {
    return this.repository.create({
      id: po.id,
      poNumber: po.poNumber,
      requisitionId: po.requisitionId || null,
      vendorId: po.vendorId,
      status: po.status,
      type: po.type,
      requiredByDate: po.requiredByDate || null,
      payload: {
        ...po,
        lines: (po.lines || []).map((line) => ({ ...line })),
        revisions: (po.revisions || []).map((revision) => ({ ...revision })),
        grnReferences: po.grnReferences || [],
        invoiceReferences: po.invoiceReferences || [],
      },
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
    });
  }

  private toDomain(entity: PurchaseOrderEntity): PurchaseOrder {
    const payload = (entity.payload || {}) as Record<string, any>;
    return new PurchaseOrder({
      ...payload,
      id: entity.id,
      poNumber: entity.poNumber,
      requisitionId: entity.requisitionId || undefined,
      vendorId: entity.vendorId,
      status: entity.status as POStatus,
      type: entity.type as POType,
      requiredByDate: entity.requiredByDate || payload.requiredByDate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lines: (payload.lines || []).map((line: Record<string, any>) => new POLine(line)),
      revisions: (payload.revisions || []).map((revision: Record<string, any>) => new PORevision(revision)),
      grnReferences: payload.grnReferences || [],
      invoiceReferences: payload.invoiceReferences || [],
    });
  }
}
