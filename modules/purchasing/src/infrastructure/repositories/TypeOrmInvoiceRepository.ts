import { randomUUID } from 'crypto';
import { FindOptionsOrder, LessThan, MoreThanOrEqual, Repository } from 'typeorm';

import {
  DisputeStatus,
  InvoiceLine,
  InvoiceStatus,
  VendorInvoice,
} from '../../domain/entities/VendorInvoice';
import {
  IPaginatedResult,
  IPaginationOptions,
} from '../../domain/repositories/IRequisitionRepository';
import { IInvoiceRepository } from '../../domain/repositories/IInvoiceRepository';
import { VendorInvoiceEntity } from '../entities/VendorInvoiceEntity';

export class TypeOrmInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly repository: Repository<VendorInvoiceEntity>) {}

  async create(invoice: VendorInvoice): Promise<VendorInvoice> {
    invoice.id = invoice.id || randomUUID();
    const saved = await this.repository.save(this.toEntity(invoice));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<VendorInvoice | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(invoiceNumber: string): Promise<VendorInvoice | null> {
    const entity = await this.repository.findOne({ where: { invoiceNumber } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByVendorInvoiceNumber(vendorId: string, vendorInvoiceNumber: string): Promise<VendorInvoice | null> {
    const rows = await this.repository.find({ where: { vendorId } });
    const match = rows.find((row) => {
      const payload = (row.payload || {}) as Record<string, unknown>;
      return payload.vendorInvoiceNumber === vendorInvoiceNumber;
    });
    return match ? this.toDomain(match) : null;
  }

  async findByVendor(vendorId: string, options: IPaginationOptions): Promise<IPaginatedResult<VendorInvoice>> {
    return this.findPaginated({ vendorId }, options);
  }

  async findByPO(poId: string): Promise<VendorInvoice[]> {
    const rows = await this.repository.find({ where: { poId } });
    return rows.map((row) => this.toDomain(row));
  }

  async findByStatus(status: InvoiceStatus, options: IPaginationOptions): Promise<IPaginatedResult<VendorInvoice>> {
    return this.findPaginated({ status }, options);
  }

  async findByDisputeStatus(
    status: DisputeStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<VendorInvoice>> {
    const all = await this.repository.find();
    const filtered = all
      .map((row) => this.toDomain(row))
      .filter((invoice) => invoice.dispatchStatus === status);
    return this.paginateInMemory(filtered, options);
  }

  async findDueSoon(days: number): Promise<VendorInvoice[]> {
    const now = new Date();
    const max = new Date(now);
    max.setDate(max.getDate() + days);
    const rows = await this.repository.find({
      where: {
        dueDate: MoreThanOrEqual(now),
      },
    });
    return rows
      .map((row) => this.toDomain(row))
      .filter((invoice) => invoice.dueDate <= max);
  }

  async findOverdue(): Promise<VendorInvoice[]> {
    const rows = await this.repository.find({
      where: {
        dueDate: LessThan(new Date()),
      },
    });
    return rows
      .map((row) => this.toDomain(row))
      .filter((invoice) => invoice.status !== InvoiceStatus.PAID);
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<VendorInvoice>> {
    return this.findPaginated({}, options);
  }

  async update(id: string, updates: Partial<VendorInvoice>): Promise<void> {
    const invoice = await this.findById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    Object.assign(invoice, updates, { updatedAt: new Date() });
    await this.repository.save(this.toEntity(invoice));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async addLine(invoiceId: string, line: InvoiceLine): Promise<void> {
    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    line.id = line.id || randomUUID();
    invoice.lines = invoice.lines || [];
    invoice.lines.push(line);
    invoice.updatedAt = new Date();
    await this.repository.save(this.toEntity(invoice));
  }

  async updateLine(invoiceId: string, lineId: string, updates: Partial<InvoiceLine>): Promise<void> {
    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    invoice.lines = (invoice.lines || []).map((line) => {
      if (line.id !== lineId) {
        return line;
      }
      Object.assign(line, updates, { updatedAt: new Date() });
      return line;
    });
    invoice.updatedAt = new Date();
    await this.repository.save(this.toEntity(invoice));
  }

  async removeLine(invoiceId: string, lineId: string): Promise<void> {
    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    invoice.lines = (invoice.lines || []).filter((line) => line.id !== lineId);
    invoice.updatedAt = new Date();
    await this.repository.save(this.toEntity(invoice));
  }

  async getLines(invoiceId: string): Promise<InvoiceLine[]> {
    const invoice = await this.findById(invoiceId);
    return invoice?.lines || [];
  }

  async addMatchReference(invoiceId: string, matchId: string): Promise<void> {
    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    invoice.matchReferences = invoice.matchReferences || [];
    if (!invoice.matchReferences.includes(matchId)) {
      invoice.matchReferences.push(matchId);
      invoice.updatedAt = new Date();
      await this.repository.save(this.toEntity(invoice));
    }
  }

  async removeMatchReference(invoiceId: string, matchId: string): Promise<void> {
    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    invoice.matchReferences = (invoice.matchReferences || []).filter((item) => item !== matchId);
    invoice.updatedAt = new Date();
    await this.repository.save(this.toEntity(invoice));
  }

  async getMatchReferences(invoiceId: string): Promise<string[]> {
    const invoice = await this.findById(invoiceId);
    return invoice?.matchReferences || [];
  }

  async existsByNumber(invoiceNumber: string): Promise<boolean> {
    return (await this.repository.count({ where: { invoiceNumber } })) > 0;
  }

  async countByVendor(vendorId: string): Promise<number> {
    return this.repository.count({ where: { vendorId } });
  }

  async countByStatus(status: InvoiceStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async countDuplicate(vendorId: string, vendorInvoiceNumber: string): Promise<number> {
    const rows = await this.repository.find({ where: { vendorId } });
    return rows.filter((row) => {
      const payload = (row.payload || {}) as Record<string, unknown>;
      return payload.vendorInvoiceNumber === vendorInvoiceNumber;
    }).length;
  }

  private async findPaginated(
    where: Partial<VendorInvoiceEntity>,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<VendorInvoice>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortKey = this.resolveSortField(options.sortBy);
    const order: FindOptionsOrder<VendorInvoiceEntity> = {
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

  private paginateInMemory(rows: VendorInvoice[], options: IPaginationOptions): IPaginatedResult<VendorInvoice> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);
    return {
      data,
      total: rows.length,
      page,
      limit,
      hasMore: start + limit < rows.length,
    };
  }

  private resolveSortField(sortBy?: string): keyof VendorInvoiceEntity {
    const allowed: Array<keyof VendorInvoiceEntity> = [
      'createdAt',
      'updatedAt',
      'dueDate',
      'invoiceDate',
      'invoiceNumber',
      'status',
    ];
    if (sortBy && allowed.includes(sortBy as keyof VendorInvoiceEntity)) {
      return sortBy as keyof VendorInvoiceEntity;
    }
    return 'createdAt';
  }

  private toEntity(invoice: VendorInvoice): VendorInvoiceEntity {
    return this.repository.create({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendorId: invoice.vendorId,
      poId: invoice.poId || null,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      payload: {
        ...invoice,
        lines: (invoice.lines || []).map((line) => ({ ...line })),
        matchReferences: invoice.matchReferences || [],
      },
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    });
  }

  private toDomain(entity: VendorInvoiceEntity): VendorInvoice {
    const payload = (entity.payload || {}) as Record<string, any>;
    return new VendorInvoice({
      ...payload,
      id: entity.id,
      invoiceNumber: entity.invoiceNumber,
      vendorId: entity.vendorId,
      poId: entity.poId || undefined,
      status: entity.status as InvoiceStatus,
      invoiceDate: entity.invoiceDate,
      dueDate: entity.dueDate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lines: (payload.lines || []).map((line: Record<string, any>) => new InvoiceLine(line)),
      matchReferences: payload.matchReferences || [],
    });
  }
}
