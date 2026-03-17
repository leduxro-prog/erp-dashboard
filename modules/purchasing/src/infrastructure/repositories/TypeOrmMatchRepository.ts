import { randomUUID } from 'crypto';
import { FindOptionsOrder, Repository } from 'typeorm';

import {
  ExceptionType,
  MatchException,
  MatchExceptionResolution,
  MatchStatus,
  ThreeWayMatch,
} from '../../domain/entities/ThreeWayMatch';
import {
  IPaginatedResult,
  IPaginationOptions,
} from '../../domain/repositories/IRequisitionRepository';
import { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { ThreeWayMatchEntity } from '../entities/ThreeWayMatchEntity';

export class TypeOrmMatchRepository implements IMatchRepository {
  private readonly resolutionStore = new Map<string, MatchExceptionResolution[]>();

  constructor(private readonly repository: Repository<ThreeWayMatchEntity>) {}

  async create(match: ThreeWayMatch): Promise<ThreeWayMatch> {
    match.id = match.id || randomUUID();
    const saved = await this.repository.save(this.toEntity(match));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<ThreeWayMatch | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByPO(poId: string): Promise<ThreeWayMatch[]> {
    const rows = await this.repository.find({ where: { poId } });
    return rows.map((row) => this.toDomain(row));
  }

  async findByGRN(grnId: string): Promise<ThreeWayMatch | null> {
    const entity = await this.repository.findOne({ where: { grnId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByInvoice(invoiceId: string): Promise<ThreeWayMatch | null> {
    const entity = await this.repository.findOne({ where: { invoiceId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByStatus(status: MatchStatus, options: IPaginationOptions): Promise<IPaginatedResult<ThreeWayMatch>> {
    return this.findPaginated({ status }, options);
  }

  async findWithExceptions(options: IPaginationOptions): Promise<IPaginatedResult<ThreeWayMatch>> {
    const all = await this.repository.find();
    const filtered = all
      .map((row) => this.toDomain(row))
      .filter((match) => (match.exceptions || []).length > 0);
    return this.paginateInMemory(filtered, options);
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<ThreeWayMatch>> {
    return this.findPaginated({}, options);
  }

  async update(id: string, updates: Partial<ThreeWayMatch>): Promise<void> {
    const match = await this.findById(id);
    if (!match) {
      throw new Error('Match not found');
    }
    Object.assign(match, updates, { updatedAt: new Date() });
    await this.repository.save(this.toEntity(match));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async addException(matchId: string, exception: MatchException): Promise<void> {
    const match = await this.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }
    exception.id = exception.id || randomUUID();
    match.exceptions = match.exceptions || [];
    match.exceptions.push(exception);
    match.updatedAt = new Date();
    await this.repository.save(this.toEntity(match));
  }

  async updateException(exceptionId: string, updates: Partial<MatchException>): Promise<void> {
    const rows = await this.repository.find();
    for (const row of rows) {
      const match = this.toDomain(row);
      let changed = false;
      match.exceptions = (match.exceptions || []).map((exception) => {
        if (exception.id !== exceptionId) {
          return exception;
        }
        changed = true;
        return { ...exception, ...updates, updatedAt: new Date() } as MatchException;
      });
      if (changed) {
        match.updatedAt = new Date();
        await this.repository.save(this.toEntity(match));
      }
    }
  }

  async removeException(matchId: string, exceptionId: string): Promise<void> {
    const match = await this.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }
    match.exceptions = (match.exceptions || []).filter((exception) => exception.id !== exceptionId);
    match.updatedAt = new Date();
    await this.repository.save(this.toEntity(match));
  }

  async getExceptions(matchId: string): Promise<MatchException[]> {
    const match = await this.findById(matchId);
    return match?.exceptions || [];
  }

  async getExceptionsByType(type: ExceptionType): Promise<MatchException[]> {
    const rows = await this.repository.find();
    const result: MatchException[] = [];
    rows.forEach((row) => {
      const match = this.toDomain(row);
      result.push(...(match.exceptions || []).filter((exception) => exception.type === type));
    });
    return result;
  }

  async getPendingExceptions(): Promise<MatchException[]> {
    const rows = await this.repository.find();
    const result: MatchException[] = [];
    rows.forEach((row) => {
      const match = this.toDomain(row);
      result.push(...(match.exceptions || []).filter((exception) => exception.status === 'pending'));
    });
    return result;
  }

  async createResolution(resolution: MatchExceptionResolution): Promise<MatchExceptionResolution> {
    resolution.id = resolution.id || randomUUID();
    const current = this.resolutionStore.get(resolution.exceptionId) || [];
    current.push(resolution);
    this.resolutionStore.set(resolution.exceptionId, current);
    return resolution;
  }

  async getResolutions(exceptionId: string): Promise<MatchExceptionResolution[]> {
    return this.resolutionStore.get(exceptionId) || [];
  }

  async countByStatus(status: MatchStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async countWithExceptions(): Promise<number> {
    const rows = await this.repository.find();
    return rows
      .map((row) => this.toDomain(row))
      .filter((match) => (match.exceptions || []).length > 0).length;
  }

  private async findPaginated(
    where: Partial<ThreeWayMatchEntity>,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<ThreeWayMatch>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortKey = this.resolveSortField(options.sortBy);
    const order: FindOptionsOrder<ThreeWayMatchEntity> = {
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

  private paginateInMemory(rows: ThreeWayMatch[], options: IPaginationOptions): IPaginatedResult<ThreeWayMatch> {
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

  private resolveSortField(sortBy?: string): keyof ThreeWayMatchEntity {
    const allowed: Array<keyof ThreeWayMatchEntity> = [
      'createdAt',
      'updatedAt',
      'matchedAt',
      'status',
    ];
    if (sortBy && allowed.includes(sortBy as keyof ThreeWayMatchEntity)) {
      return sortBy as keyof ThreeWayMatchEntity;
    }
    return 'createdAt';
  }

  private toEntity(match: ThreeWayMatch): ThreeWayMatchEntity {
    return this.repository.create({
      id: match.id,
      poId: match.poId,
      grnId: match.grnId,
      invoiceId: match.invoiceId,
      status: match.status,
      matchedAt: match.matchedAt || null,
      payload: {
        ...match,
        exceptions: (match.exceptions || []).map((exception) => ({ ...exception })),
      },
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    });
  }

  private toDomain(entity: ThreeWayMatchEntity): ThreeWayMatch {
    const payload = (entity.payload || {}) as Record<string, any>;
    return new ThreeWayMatch({
      ...payload,
      id: entity.id,
      poId: entity.poId,
      grnId: entity.grnId,
      invoiceId: entity.invoiceId,
      status: entity.status as MatchStatus,
      matchedAt: entity.matchedAt || payload.matchedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      exceptions: (payload.exceptions || []).map((exception: Record<string, any>) => new MatchException(exception)),
    });
  }
}
