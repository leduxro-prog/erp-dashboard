import { DataSource, Repository } from 'typeorm';
import { SeoMetadata, SeoLocale, MetadataEntityType } from '../../domain/entities/SeoMetadata';
import {
  SeoIssue,
  SeoIssueType,
  SeoIssueSeverity,
  SeoEntityType,
} from '../../domain/entities/SeoIssue';
import {
  ISeoMetadataRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/repositories/ISeoMetadataRepository';
import { SeoMetadataEntity } from '../entities/SeoMetadataEntity';

/**
 * TypeORM implementation of ISeoMetadataRepository
 *
 * Bridges domain SeoMetadata and the SeoMetadataEntity ORM model.
 */
export class TypeOrmSeoMetadataRepository implements ISeoMetadataRepository {
  private repo: Repository<SeoMetadataEntity>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(SeoMetadataEntity);
  }

  // ── Mappers ──────────────────────────────────────────────────────

  private toDomain(entity: SeoMetadataEntity): SeoMetadata {
    const issuesRaw = Array.isArray(entity.issues) ? entity.issues : [];
    const issues: SeoIssue[] = (issuesRaw as Record<string, unknown>[]).map(
      (i) =>
        new SeoIssue({
          type: (i.type as SeoIssueType) || SeoIssueType.MISSING_META_TITLE,
          severity: (i.severity as SeoIssueSeverity) || SeoIssueSeverity.INFO,
          message: (i.message as string) || '',
          entityType: i.entityType as SeoEntityType | undefined,
          entityId: i.entityId as string | undefined,
          recommendation: i.recommendation as string | undefined,
          autoFixable: i.autoFixable as boolean | undefined,
        }),
    );

    return new SeoMetadata({
      id: entity.id,
      entityType: entity.entityType as MetadataEntityType,
      entityId: entity.entityId,
      locale: entity.locale as SeoLocale,
      metaTitle: entity.metaTitle,
      metaDescription: entity.metaDescription,
      slug: entity.slug,
      canonicalUrl: entity.canonicalUrl,
      ogTitle: entity.ogTitle,
      ogDescription: entity.ogDescription,
      ogImage: entity.ogImage,
      twitterTitle: entity.twitterTitle,
      twitterDescription: entity.twitterDescription,
      focusKeyword: entity.focusKeyword,
      secondaryKeywords: entity.secondaryKeywords ?? [],
      seoScore: entity.seoScore ?? 0,
      issues,
      lastAuditedAt: entity.lastAuditedAt ?? undefined,
      lastPublishedAt: entity.lastPublishedAt ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private toEntity(domain: SeoMetadata): SeoMetadataEntity {
    const entity = new SeoMetadataEntity();
    entity.id = domain.id;
    entity.entityType = domain.entityType;
    entity.entityId = domain.entityId;
    entity.locale = domain.locale;
    entity.metaTitle = domain.metaTitle;
    entity.metaDescription = domain.metaDescription;
    entity.slug = domain.slug;
    entity.canonicalUrl = domain.canonicalUrl;
    entity.ogTitle = domain.ogTitle;
    entity.ogDescription = domain.ogDescription;
    entity.ogImage = domain.ogImage;
    entity.twitterTitle = domain.twitterTitle;
    entity.twitterDescription = domain.twitterDescription;
    entity.focusKeyword = domain.focusKeyword;
    entity.secondaryKeywords = domain.secondaryKeywords;
    entity.seoScore = domain.seoScore;
    entity.issues = domain.issues.map((i) => i.toJSON()) as unknown as Record<string, unknown>;
    entity.lastAuditedAt = domain.lastAuditedAt;
    entity.lastPublishedAt = domain.lastPublishedAt;
    return entity;
  }

  // ── Interface Methods ────────────────────────────────────────────

  async save(metadata: SeoMetadata): Promise<SeoMetadata> {
    const entity = this.toEntity(metadata);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findByEntity(
    entityType: MetadataEntityType,
    entityId: string,
    locale?: SeoLocale,
  ): Promise<SeoMetadata | null> {
    const where: Record<string, unknown> = { entityType, entityId };
    if (locale) {
      where.locale = locale;
    }
    const entity = await this.repo.findOne({ where: where as any });
    return entity ? this.toDomain(entity) : null;
  }

  async findByLocale(
    locale: SeoLocale,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<SeoMetadata>> {
    const [entities, total] = await this.repo.findAndCount({
      where: { locale } as any,
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

  async findMissingMeta(pagination: PaginationParams): Promise<PaginatedResult<SeoMetadata>> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where("m.metaTitle = '' OR m.metaDescription = '' OR m.slug = ''")
      .orderBy('m.createdAt', 'DESC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit);

    const [entities, total] = await qb.getManyAndCount();
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async findLowScore(
    threshold: number,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<SeoMetadata>> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.seoScore < :threshold', { threshold })
      .orderBy('m.seoScore', 'ASC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit);

    const [entities, total] = await qb.getManyAndCount();
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async search(
    keyword: string,
    entityType?: MetadataEntityType,
    locale?: SeoLocale,
  ): Promise<SeoMetadata[]> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where(
        '(m.metaTitle ILIKE :kw OR m.metaDescription ILIKE :kw OR m.slug ILIKE :kw OR m.focusKeyword ILIKE :kw)',
        { kw: `%${keyword}%` },
      );

    if (entityType) {
      qb.andWhere('m.entityType = :entityType', { entityType });
    }
    if (locale) {
      qb.andWhere('m.locale = :locale', { locale });
    }

    qb.orderBy('m.seoScore', 'DESC').take(50);

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async bulkSave(metadataList: SeoMetadata[]): Promise<SeoMetadata[]> {
    const entities = metadataList.map((m) => this.toEntity(m));
    const saved = await this.repo.save(entities);
    return saved.map((e) => this.toDomain(e));
  }

  async findByEntityType(
    entityType: MetadataEntityType,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<SeoMetadata>> {
    const [entities, total] = await this.repo.findAndCount({
      where: { entityType } as any,
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

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async exists(
    entityType: MetadataEntityType,
    entityId: string,
    locale: SeoLocale,
  ): Promise<boolean> {
    const count = await this.repo.count({
      where: { entityType, entityId, locale } as any,
    });
    return count > 0;
  }

  async count(entityType?: MetadataEntityType): Promise<number> {
    if (entityType) {
      return this.repo.count({ where: { entityType } as any });
    }
    return this.repo.count();
  }
}
