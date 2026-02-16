import { DataSource, Repository } from 'typeorm';
import { Sitemap, SitemapType, ChangeFrequency, SitemapEntry } from '../../domain/entities/Sitemap';
import { ISitemapRepository } from '../../domain/repositories/ISitemapRepository';
import {
  PaginatedResult,
  PaginationParams,
} from '../../domain/repositories/ISeoMetadataRepository';
import { SitemapEntity } from '../entities/SitemapEntity';

/**
 * Maps between domain SitemapType (plural) and DB enum (singular).
 */
const DOMAIN_TO_DB_TYPE: Record<string, string> = {
  PRODUCTS: 'PRODUCT',
  CATEGORIES: 'CATEGORY',
  PAGES: 'PAGE',
  INDEX: 'PAGE', // INDEX has no DB enum value; stored as PAGE with flag in metadata
};

const DB_TO_DOMAIN_TYPE: Record<string, SitemapType> = {
  PRODUCT: SitemapType.PRODUCTS,
  CATEGORY: SitemapType.CATEGORIES,
  PAGE: SitemapType.PAGES,
};

/**
 * TypeORM implementation of ISitemapRepository
 *
 * Bridges domain Sitemap and the SitemapEntity ORM model.
 */
export class TypeOrmSitemapRepository implements ISitemapRepository {
  private repo: Repository<SitemapEntity>;

  constructor(private dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(SitemapEntity);
  }

  // ── Mappers ──────────────────────────────────────────────────────

  private toDomain(entity: SitemapEntity): Sitemap {
    const meta = (entity.metadata ?? {}) as Record<string, unknown>;
    const isIndex = meta.isIndex === true;
    const type = isIndex
      ? SitemapType.INDEX
      : (DB_TO_DOMAIN_TYPE[entity.type] ?? SitemapType.PRODUCTS);

    const rawEntries = Array.isArray(meta.entries) ? meta.entries : [];
    const entries: SitemapEntry[] = (rawEntries as Record<string, unknown>[]).map((e) => ({
      url: (e.url as string) || '',
      lastmod: e.lastmod ? new Date(e.lastmod as string) : new Date(),
      priority: typeof e.priority === 'number' ? e.priority : 0.5,
    }));

    return new Sitemap({
      id: entity.id,
      type,
      url: entity.url,
      changefreq: (meta.changefreq as ChangeFrequency) ?? ChangeFrequency.DAILY,
      priority: typeof meta.priority === 'number' ? meta.priority : 0.5,
      entries,
      generatedAt: entity.lastGeneratedAt,
      fileSize: typeof meta.fileSize === 'number' ? meta.fileSize : 0,
    });
  }

  private toEntity(domain: Sitemap): SitemapEntity {
    const entity = new SitemapEntity();
    entity.id = domain.id;
    entity.type = DOMAIN_TO_DB_TYPE[domain.type] ?? 'PAGE';
    entity.url = domain.url;
    entity.urlCount = domain.entries.length;
    entity.content = domain.fileSize > 0 ? domain.generateXml() : '';
    entity.isPublished = false;
    entity.lastGeneratedAt = domain.generatedAt;
    entity.metadata = {
      changefreq: domain.changefreq,
      priority: domain.priority,
      fileSize: domain.fileSize,
      isIndex: domain.type === SitemapType.INDEX,
      entries: domain.entries.map((e) => ({
        url: e.url,
        lastmod: e.lastmod.toISOString(),
        priority: e.priority,
      })),
    };
    return entity;
  }

  // ── Interface Methods ────────────────────────────────────────────

  async save(sitemap: Sitemap): Promise<Sitemap> {
    const entity = this.toEntity(sitemap);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findByType(type: SitemapType): Promise<Sitemap | null> {
    if (type === SitemapType.INDEX) {
      // INDEX is stored as PAGE with isIndex flag in metadata
      const entities = await this.repo
        .createQueryBuilder('s')
        .where("s.type = 'PAGE'")
        .andWhere("s.metadata->>'isIndex' = 'true'")
        .orderBy('s.lastGeneratedAt', 'DESC')
        .take(1)
        .getMany();
      return entities.length > 0 ? this.toDomain(entities[0]) : null;
    }

    const dbType = DOMAIN_TO_DB_TYPE[type];
    const entity = await this.repo.findOne({
      where: { type: dbType } as any,
      order: { lastGeneratedAt: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(pagination: PaginationParams): Promise<PaginatedResult<Sitemap>> {
    const [entities, total] = await this.repo.findAndCount({
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { lastGeneratedAt: 'DESC' },
    });
    return {
      data: entities.map((e) => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async getLastGenerated(): Promise<Map<SitemapType, Sitemap>> {
    const result = new Map<SitemapType, Sitemap>();

    for (const domainType of [SitemapType.PRODUCTS, SitemapType.CATEGORIES, SitemapType.PAGES]) {
      const sitemap = await this.findByType(domainType);
      if (sitemap) {
        result.set(domainType, sitemap);
      }
    }

    // Also check for INDEX
    const indexSitemap = await this.findByType(SitemapType.INDEX);
    if (indexSitemap) {
      result.set(SitemapType.INDEX, indexSitemap);
    }

    return result;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findById(id: string): Promise<Sitemap | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async count(type?: SitemapType): Promise<number> {
    if (type) {
      if (type === SitemapType.INDEX) {
        return this.repo
          .createQueryBuilder('s')
          .where("s.type = 'PAGE'")
          .andWhere("s.metadata->>'isIndex' = 'true'")
          .getCount();
      }
      const dbType = DOMAIN_TO_DB_TYPE[type];
      return this.repo.count({ where: { type: dbType } as any });
    }
    return this.repo.count();
  }
}
