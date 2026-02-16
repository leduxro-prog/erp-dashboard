import { Repository, Between } from 'typeorm';
import { FiscalPeriod } from '../../domain/entities/FiscalPeriod';
import { IFiscalPeriodRepository } from '../../domain/repositories/IFiscalPeriodRepository';
import { FiscalPeriodEntity } from '../entities/FiscalPeriodEntity';

export class FiscalPeriodRepository implements IFiscalPeriodRepository {
  constructor(private ormRepository: Repository<FiscalPeriodEntity>) {}

  async create(period: FiscalPeriod): Promise<FiscalPeriod> {
    const entity = this.ormRepository.create({
      id: period.id,
      organizationId: period.organizationId,
      periodName: period.periodName,
      fiscalYear: period.fiscalYear,
      startDate: period.startDate,
      endDate: period.endDate,
      isOpen: period.isOpen,
      isLocked: period.isLocked,
      closingDate: period.closingDate,
      closedBy: period.closedBy,
      metadata: period.metadata,
      createdBy: period.createdBy,
      updatedBy: period.updatedBy,
    });

    const saved = await this.ormRepository.save(entity);
    return this.toDomain(saved);
  }

  async update(period: FiscalPeriod): Promise<FiscalPeriod> {
    await this.ormRepository.update(period.id, {
      startDate: period.startDate,
      endDate: period.endDate,
      isOpen: period.isOpen,
      isLocked: period.isLocked,
      closingDate: period.closingDate,
      closedBy: period.closedBy,
      metadata: period.metadata,
      updatedBy: period.updatedBy,
    });

    const updated = await this.ormRepository.findOneBy({ id: period.id });
    if (!updated) throw new Error('Fiscal period not found after update');
    return this.toDomain(updated);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.ormRepository.delete({ id, organizationId });
  }

  async findById(id: string, organizationId: string): Promise<FiscalPeriod | null> {
    const entity = await this.ormRepository.findOneBy({ id, organizationId });
    return entity ? this.toDomain(entity) : null;
  }

  async findByName(periodName: string, fiscalYear: string, organizationId: string): Promise<FiscalPeriod | null> {
    const entity = await this.ormRepository.findOneBy({
      periodName,
      fiscalYear,
      organizationId,
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByFiscalYear(fiscalYear: string, organizationId: string): Promise<FiscalPeriod[]> {
    const entities = await this.ormRepository.findBy({ fiscalYear, organizationId });
    return entities.map(e => this.toDomain(e));
  }

  async findAll(organizationId: string): Promise<FiscalPeriod[]> {
    const entities = await this.ormRepository.findBy({ organizationId });
    return entities.map(e => this.toDomain(e));
  }

  async findOpen(organizationId: string): Promise<FiscalPeriod[]> {
    const entities = await this.ormRepository.findBy({
      organizationId,
      isOpen: true,
    });
    return entities.map(e => this.toDomain(e));
  }

  async findByDate(date: Date, organizationId: string): Promise<FiscalPeriod | null> {
    const entity = await this.ormRepository.findOne({
      where: {
        organizationId,
        startDate: {
          lte: date,
        } as any,
        endDate: {
          gte: date,
        } as any,
      },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async getCurrentPeriod(organizationId: string): Promise<FiscalPeriod | null> {
    const now = new Date();
    const entity = await this.ormRepository.findOne({
      where: {
        organizationId,
        isOpen: true,
        startDate: {
          lte: now,
        } as any,
        endDate: {
          gte: now,
        } as any,
      },
    });
    return entity ? this.toDomain(entity) : null;
  }

  private toDomain(entity: FiscalPeriodEntity): FiscalPeriod {
    return new FiscalPeriod({
      id: entity.id,
      organizationId: entity.organizationId,
      periodName: entity.periodName,
      fiscalYear: entity.fiscalYear,
      startDate: entity.startDate,
      endDate: entity.endDate,
      isOpen: entity.isOpen,
      isLocked: entity.isLocked,
      closingDate: entity.closingDate,
      closedBy: entity.closedBy,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    });
  }
}
