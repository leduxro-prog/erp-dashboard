import { DataSource, Repository } from 'typeorm';
import { StructuredData, SchemaType } from '../../domain/entities/StructuredData';
import { SeoEntityType } from '../../domain/entities/SeoIssue';
import { IStructuredDataRepository } from '../../domain/repositories/IStructuredDataRepository';
import {
  PaginatedResult,
  PaginationParams,
} from '../../domain/repositories/ISeoMetadataRepository';
import { StructuredDataEntity } from '../entities/StructuredDataEntity';

/**
 * TypeORM implementation of IStructuredDataRepository
 *
 * Bridges domain StructuredData and the StructuredDataEntity ORM model.
 */
export class TypeOrmStructuredDataRepository implements IStructuredDataRepository {
  private repo: Repository<StructuredDataEntity>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(StructuredDataEntity);
  }

  // ── Mappers ──────────────────────────────────────────────────────

  private toDomain(entity: StructuredDataEntity): StructuredData {
    const rawErrors = entity.validationErrors;
    const validationErrors: string[] = Array.isArray(rawErrors)
      ? (rawErrors as string[])
      : rawErrors && typeof rawErrors === 'object' && Array.isArray((rawErrors as any).errors)
        ? (rawErrors as any).errors
        : [];

    return new StructuredData({
      id: entity.id,
      entityType: entity.entityType as SeoEntityType,
      entityId: entity.entityId,
      schemaType: entity.schemaType as SchemaType,
      jsonLd: entity.schema,
      validationErrors,
      isValid: entity.isActive,
      lastValidatedAt: entity.lastValidatedAt ?? undefined,
      createdAt: entity.createdAt,
    });
  }

  private toEntity(domain: StructuredData): StructuredDataEntity {
    const entity = new StructuredDataEntity();
    entity.id = domain.id;
    entity.entityType = domain.entityType;
    entity.entityId = domain.entityId;
    entity.schemaType = domain.schemaType;
    entity.schema = domain.jsonLd;
    entity.isActive = domain.isValid;
    entity.validationScore = domain.validationErrors.length === 0 ? 100 : 0;
    entity.validationErrors = domain.validationErrors as unknown as Record<string, unknown>;
    entity.lastValidatedAt = domain.lastValidatedAt;
    return entity;
  }

  // ── Interface Methods ────────────────────────────────────────────

  async save(structuredData: StructuredData): Promise<StructuredData> {
    const entity = this.toEntity(structuredData);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findByEntity(entityType: SeoEntityType, entityId: string): Promise<StructuredData[]> {
    const entities = await this.repo.find({
      where: { entityType, entityId } as any,
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findInvalid(pagination: PaginationParams): Promise<PaginatedResult<StructuredData>> {
    const [entities, total] = await this.repo.findAndCount({
      where: { isActive: false } as any,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async findBySchemaType(
    schemaType: SchemaType,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<StructuredData>> {
    const [entities, total] = await this.repo.findAndCount({
      where: { schemaType } as any,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async bulkSave(recordList: StructuredData[]): Promise<StructuredData[]> {
    const entities = recordList.map((r) => this.toEntity(r));
    const saved = await this.repo.save(entities);
    return saved.map((e) => this.toDomain(e));
  }

  async deleteByEntity(entityType: SeoEntityType, entityId: string): Promise<number> {
    const result = await this.repo.delete({ entityType, entityId } as any);
    return result.affected ?? 0;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findById(id: string): Promise<StructuredData | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async count(entityType?: SeoEntityType, schemaType?: SchemaType): Promise<number> {
    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (schemaType) where.schemaType = schemaType;

    return this.repo.count({
      where: Object.keys(where).length > 0 ? (where as any) : undefined,
    });
  }
}
