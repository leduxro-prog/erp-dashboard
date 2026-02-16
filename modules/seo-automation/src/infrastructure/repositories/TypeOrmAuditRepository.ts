import { DataSource, Repository } from 'typeorm';
import { SeoAuditResult, AuditType } from '../../domain/entities/SeoAuditResult';
import {
  SeoIssue,
  SeoIssueType,
  SeoIssueSeverity,
  SeoEntityType,
} from '../../domain/entities/SeoIssue';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository';
import {
  PaginatedResult,
  PaginationParams,
} from '../../domain/repositories/ISeoMetadataRepository';
import { SeoAuditResultEntity } from '../entities/SeoAuditResultEntity';

/**
 * TypeORM implementation of IAuditRepository
 *
 * Maps between the domain SeoAuditResult and the SeoAuditResultEntity.
 * Domain fields not present in the DB entity are stored in the
 * `recommendations` JSONB column.
 */
export class TypeOrmAuditRepository implements IAuditRepository {
  private repo: Repository<SeoAuditResultEntity>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(SeoAuditResultEntity);
  }

  // ── Mappers ──────────────────────────────────────────────────────

  private toDomain(entity: SeoAuditResultEntity): SeoAuditResult {
    const rec = (entity.recommendations ?? {}) as Record<string, unknown>;
    const issuesRaw = Array.isArray(entity.issues) ? entity.issues : [];
    const warningsRaw = Array.isArray(rec.warnings) ? rec.warnings : [];

    const mapIssues = (arr: unknown[]): SeoIssue[] =>
      (arr as Record<string, unknown>[]).map(
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

    const executionTimeMs =
      typeof rec.executionTimeMs === 'number'
        ? rec.executionTimeMs
        : entity.startedAt && entity.completedAt
          ? entity.completedAt.getTime() - entity.startedAt.getTime()
          : 0;

    return new SeoAuditResult({
      id: entity.id,
      auditType: (rec.auditType as AuditType) || AuditType.FULL,
      entityType: rec.entityType as SeoEntityType | undefined,
      entityId: rec.entityId as string | undefined,
      score: entity.score ?? 0,
      issues: mapIssues(issuesRaw),
      warnings: mapIssues(warningsRaw),
      passed: Array.isArray(rec.passed) ? (rec.passed as string[]) : [],
      recommendations: Array.isArray(rec.recommendations) ? (rec.recommendations as string[]) : [],
      executionTimeMs,
      createdAt: entity.createdAt,
    });
  }

  private toEntity(domain: SeoAuditResult): SeoAuditResultEntity {
    const entity = new SeoAuditResultEntity();
    entity.id = domain.id;
    entity.metadataId = domain.entityId || domain.id;
    entity.status = 'COMPLETED';
    entity.score = domain.score;
    entity.issues = domain.issues.map((i) => i.toJSON()) as unknown as Record<string, unknown>;
    entity.recommendations = {
      auditType: domain.auditType,
      entityType: domain.entityType,
      entityId: domain.entityId,
      passed: domain.passed,
      recommendations: domain.recommendations,
      executionTimeMs: domain.executionTimeMs,
      warnings: domain.warnings.map((w) => w.toJSON()),
    };
    entity.seoScore = domain.score;
    entity.performanceScore = undefined;
    entity.accessibilityScore = undefined;
    entity.startedAt = domain.createdAt;
    entity.completedAt = new Date(domain.createdAt.getTime() + domain.executionTimeMs);
    return entity;
  }

  // ── Interface Methods ────────────────────────────────────────────

  async save(auditResult: SeoAuditResult): Promise<SeoAuditResult> {
    const entity = this.toEntity(auditResult);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<SeoAuditResult | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findLatest(
    entityType?: SeoEntityType,
    entityId?: string,
    limit: number = 10,
  ): Promise<SeoAuditResult[]> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').take(limit);

    if (entityType && entityId) {
      // Filter via JSONB recommendations field
      qb.where("a.recommendations->>'entityType' = :entityType", { entityType });
      qb.andWhere("a.recommendations->>'entityId' = :entityId", { entityId });
    } else if (entityType) {
      qb.where("a.recommendations->>'entityType' = :entityType", { entityType });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findAll(
    pagination: PaginationParams,
    auditType?: AuditType,
  ): Promise<PaginatedResult<SeoAuditResult>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit);

    if (auditType) {
      qb.where("a.recommendations->>'auditType' = :auditType", { auditType });
    }

    const [entities, total] = await qb.getManyAndCount();
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async getAverageScore(entityType?: SeoEntityType): Promise<number> {
    const qb = this.repo.createQueryBuilder('a').select('AVG(a.score)', 'avg');

    if (entityType) {
      qb.where("a.recommendations->>'entityType' = :entityType", { entityType });
    }

    const result = await qb.getRawOne();
    return Math.round(parseFloat(result?.avg ?? '0'));
  }

  async findByEntity(
    entityType: SeoEntityType,
    entityId: string,
    limit: number = 10,
  ): Promise<SeoAuditResult[]> {
    return this.findLatest(entityType, entityId, limit);
  }

  async count(entityType?: SeoEntityType, auditType?: AuditType): Promise<number> {
    const qb = this.repo.createQueryBuilder('a');

    if (entityType) {
      qb.where("a.recommendations->>'entityType' = :entityType", { entityType });
    }
    if (auditType) {
      const method = entityType ? 'andWhere' : 'where';
      qb[method]("a.recommendations->>'auditType' = :auditType", { auditType });
    }

    return qb.getCount();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
