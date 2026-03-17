import { randomUUID } from 'crypto';
import { FindOptionsOrder, Repository } from 'typeorm';

import {
  GoodsReceiptNote,
  GRNLine,
  GRNStatus,
  ReturnItem,
} from '../../domain/entities/GoodsReceiptNote';
import {
  IPaginatedResult,
  IPaginationOptions,
} from '../../domain/repositories/IRequisitionRepository';
import { IGRNRepository } from '../../domain/repositories/IGRNRepository';
import { GoodsReceiptNoteEntity } from '../entities/GoodsReceiptNoteEntity';

export class TypeOrmGRNRepository implements IGRNRepository {
  constructor(private readonly repository: Repository<GoodsReceiptNoteEntity>) {}

  async create(grn: GoodsReceiptNote): Promise<GoodsReceiptNote> {
    grn.id = grn.id || randomUUID();
    const saved = await this.repository.save(this.toEntity(grn));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<GoodsReceiptNote | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(grnNumber: string): Promise<GoodsReceiptNote | null> {
    const entity = await this.repository.findOne({ where: { grnNumber } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByPO(poId: string): Promise<GoodsReceiptNote[]> {
    const rows = await this.repository.find({ where: { poId } });
    return rows.map((row) => this.toDomain(row));
  }

  async findByVendor(vendorId: string, options: IPaginationOptions): Promise<IPaginatedResult<GoodsReceiptNote>> {
    return this.findPaginated({ vendorId }, options);
  }

  async findByStatus(status: GRNStatus, options: IPaginationOptions): Promise<IPaginatedResult<GoodsReceiptNote>> {
    return this.findPaginated({ status }, options);
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<GoodsReceiptNote>> {
    return this.findPaginated({}, options);
  }

  async update(id: string, updates: Partial<GoodsReceiptNote>): Promise<void> {
    const grn = await this.findById(id);
    if (!grn) {
      throw new Error('GRN not found');
    }
    Object.assign(grn, updates, { updatedAt: new Date() });
    await this.repository.save(this.toEntity(grn));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async addLine(grnId: string, line: GRNLine): Promise<void> {
    const grn = await this.findById(grnId);
    if (!grn) {
      throw new Error('GRN not found');
    }
    line.id = line.id || randomUUID();
    grn.lines = grn.lines || [];
    grn.lines.push(line);
    grn.updatedAt = new Date();
    await this.repository.save(this.toEntity(grn));
  }

  async updateLine(grnId: string, lineId: string, updates: Partial<GRNLine>): Promise<void> {
    const grn = await this.findById(grnId);
    if (!grn) {
      throw new Error('GRN not found');
    }
    grn.lines = (grn.lines || []).map((line) => {
      if (line.id !== lineId) {
        return line;
      }
      Object.assign(line, updates, { updatedAt: new Date() });
      return line;
    });
    grn.updatedAt = new Date();
    await this.repository.save(this.toEntity(grn));
  }

  async removeLine(grnId: string, lineId: string): Promise<void> {
    const grn = await this.findById(grnId);
    if (!grn) {
      throw new Error('GRN not found');
    }
    grn.lines = (grn.lines || []).filter((line) => line.id !== lineId);
    grn.updatedAt = new Date();
    await this.repository.save(this.toEntity(grn));
  }

  async getLines(grnId: string): Promise<GRNLine[]> {
    const grn = await this.findById(grnId);
    return grn?.lines || [];
  }

  async addReturnItem(grnId: string, item: ReturnItem): Promise<void> {
    const grn = await this.findById(grnId);
    if (!grn) {
      throw new Error('GRN not found');
    }
    item.id = item.id || randomUUID();
    grn.returnedItems = grn.returnedItems || [];
    grn.returnedItems.push(item);
    grn.updatedAt = new Date();
    await this.repository.save(this.toEntity(grn));
  }

  async updateReturnItem(grnId: string, returnId: string, updates: Partial<ReturnItem>): Promise<void> {
    const grn = await this.findById(grnId);
    if (!grn) {
      throw new Error('GRN not found');
    }
    grn.returnedItems = (grn.returnedItems || []).map((item) => {
      if (item.id !== returnId) {
        return item;
      }
      Object.assign(item, updates, { updatedAt: new Date() });
      return item;
    });
    grn.updatedAt = new Date();
    await this.repository.save(this.toEntity(grn));
  }

  async removeReturnItem(grnId: string, returnId: string): Promise<void> {
    const grn = await this.findById(grnId);
    if (!grn) {
      throw new Error('GRN not found');
    }
    grn.returnedItems = (grn.returnedItems || []).filter((item) => item.id !== returnId);
    grn.updatedAt = new Date();
    await this.repository.save(this.toEntity(grn));
  }

  async getReturnItems(grnId: string): Promise<ReturnItem[]> {
    const grn = await this.findById(grnId);
    return grn?.returnedItems || [];
  }

  async getReturnItemsByStatus(status: string): Promise<ReturnItem[]> {
    const rows = await this.repository.find();
    const result: ReturnItem[] = [];
    rows.forEach((row) => {
      const grn = this.toDomain(row);
      result.push(...(grn.returnedItems || []).filter((item) => item.status === status));
    });
    return result;
  }

  async existsByNumber(grnNumber: string): Promise<boolean> {
    return (await this.repository.count({ where: { grnNumber } })) > 0;
  }

  async countByPO(poId: string): Promise<number> {
    return this.repository.count({ where: { poId } });
  }

  async countByStatus(status: GRNStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  private async findPaginated(
    where: Partial<GoodsReceiptNoteEntity>,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<GoodsReceiptNote>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortKey = this.resolveSortField(options.sortBy);
    const order: FindOptionsOrder<GoodsReceiptNoteEntity> = {
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

  private resolveSortField(sortBy?: string): keyof GoodsReceiptNoteEntity {
    const allowed: Array<keyof GoodsReceiptNoteEntity> = [
      'createdAt',
      'updatedAt',
      'receiveDate',
      'grnNumber',
      'status',
    ];
    if (sortBy && allowed.includes(sortBy as keyof GoodsReceiptNoteEntity)) {
      return sortBy as keyof GoodsReceiptNoteEntity;
    }
    return 'createdAt';
  }

  private toEntity(grn: GoodsReceiptNote): GoodsReceiptNoteEntity {
    return this.repository.create({
      id: grn.id,
      grnNumber: grn.grnNumber,
      poId: grn.poId,
      vendorId: grn.vendorId,
      status: grn.status,
      receiveDate: grn.receiveDate || null,
      payload: {
        ...grn,
        lines: (grn.lines || []).map((line) => ({ ...line })),
        returnedItems: (grn.returnedItems || []).map((item) => ({ ...item })),
      },
      createdAt: grn.createdAt,
      updatedAt: grn.updatedAt,
    });
  }

  private toDomain(entity: GoodsReceiptNoteEntity): GoodsReceiptNote {
    const payload = (entity.payload || {}) as Record<string, any>;
    return new GoodsReceiptNote({
      ...payload,
      id: entity.id,
      grnNumber: entity.grnNumber,
      poId: entity.poId,
      vendorId: entity.vendorId,
      status: entity.status as GRNStatus,
      receiveDate: entity.receiveDate || payload.receiveDate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lines: (payload.lines || []).map((line: Record<string, any>) => new GRNLine(line)),
      returnedItems: (payload.returnedItems || []).map((item: Record<string, any>) => new ReturnItem(item)),
    });
  }
}
