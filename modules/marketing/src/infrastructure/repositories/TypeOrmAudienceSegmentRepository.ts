import { DataSource, Repository, Like } from 'typeorm';

import { AudienceSegment, SegmentFilterCriteria } from '../../domain/entities/AudienceSegment';
import { IAudienceSegmentRepository } from '../../domain/repositories/IAudienceSegmentRepository';
import { AudienceSegmentEntity } from '../entities/AudienceSegmentEntity';

export class TypeOrmAudienceSegmentRepository implements IAudienceSegmentRepository {
  private readonly repository: Repository<AudienceSegmentEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(AudienceSegmentEntity);
  }

  async save(segment: AudienceSegment): Promise<AudienceSegment> {
    const entity = this.mapToEntity(segment);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async findById(id: string): Promise<AudienceSegment | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findAll(
    filter: { search?: string; createdBy?: string },
    pagination: { page: number; limit: number },
  ): Promise<{ items: AudienceSegment[]; total: number; page: number; pages: number }> {
    const where: any = {};

    if (filter.search) {
      where.name = Like(`%${filter.search}%`);
    }

    if (filter.createdBy) {
      where.createdBy = filter.createdBy;
    }

    const [entities, total] = await this.repository.findAndCount({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });

    const items = entities.map((entity) => this.mapToDomain(entity));

    return {
      items,
      total,
      page: pagination.page,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async findByName(name: string): Promise<AudienceSegment | null> {
    const entity = await this.repository.findOne({ where: { name } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  private mapToDomain(entity: AudienceSegmentEntity): AudienceSegment {
    return new AudienceSegment(
      entity.id,
      entity.name,
      entity.description ?? null,
      entity.filterCriteria as SegmentFilterCriteria,
      entity.estimatedSize,
      entity.lastComputedAt ?? null,
      entity.isDynamic,
      entity.cachedCustomerIds,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private mapToEntity(domain: AudienceSegment): AudienceSegmentEntity {
    const entity = new AudienceSegmentEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description ?? undefined;
    entity.filterCriteria = domain.filterCriteria as Record<string, unknown>;
    entity.estimatedSize = domain.getEstimatedSize();
    entity.lastComputedAt = domain.getLastComputedAt() ?? undefined;
    entity.isDynamic = domain.isDynamic;
    entity.cachedCustomerIds = domain.getCachedCustomerIds();
    entity.createdBy = domain.createdBy;
    return entity;
  }
}
