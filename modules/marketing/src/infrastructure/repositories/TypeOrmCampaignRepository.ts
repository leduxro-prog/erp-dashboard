import { DataSource, Repository, Like, Between, LessThanOrEqual } from 'typeorm';
import { Campaign, CampaignType, CampaignStatus, AudienceFilter, CampaignMetrics } from '../../domain/entities/Campaign';
import { ICampaignRepository, CampaignFilter, PaginationOptions, PaginatedResult } from '../../domain/repositories/ICampaignRepository';
import { CampaignEntity } from '../entities/CampaignEntity';

export class TypeOrmCampaignRepository implements ICampaignRepository {
  private readonly repository: Repository<CampaignEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(CampaignEntity);
  }

  async save(campaign: Campaign): Promise<Campaign> {
    const entity = this.mapToEntity(campaign);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async findById(id: string): Promise<Campaign | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findAll(filter: CampaignFilter, pagination: PaginationOptions): Promise<PaginatedResult<Campaign>> {
    const where: any = {};

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.search) {
      where.name = Like(`%${filter.search}%`);
    }

    if (filter.createdBy) {
      where.createdBy = filter.createdBy;
    }

    if (filter.activeAfter && filter.activeBefore) {
      where.startDate = Between(filter.activeAfter, filter.activeBefore);
    } else if (filter.activeAfter) {
      where.startDate = LessThanOrEqual(filter.activeAfter);
    }

    const [entities, total] = await this.repository.findAndCount({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' }
    });

    const items = entities.map(entity => this.mapToDomain(entity));
    
    return {
      items,
      total,
      page: pagination.page,
      pages: Math.ceil(total / pagination.limit)
    };
  }

  async findActive(): Promise<Campaign[]> {
    const entities = await this.repository.find({
      where: { status: 'ACTIVE' }
    });
    return entities.map(entity => this.mapToDomain(entity));
  }

  async findByType(type: string): Promise<Campaign[]> {
    const entities = await this.repository.find({
      where: { type }
    });
    return entities.map(entity => this.mapToDomain(entity));
  }

  async updateMetrics(campaignId: string, metrics: Partial<CampaignMetrics>): Promise<Campaign> {
    const entity = await this.repository.findOne({ where: { id: campaignId } });
    if (!entity) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const currentMetrics = entity.metrics as any;
    entity.metrics = {
      sent: (currentMetrics.sent || 0) + (metrics.sent || 0),
      opened: (currentMetrics.opened || 0) + (metrics.opened || 0),
      clicked: (currentMetrics.clicked || 0) + (metrics.clicked || 0),
      converted: (currentMetrics.converted || 0) + (metrics.converted || 0),
      revenue: Number(currentMetrics.revenue || 0) + (metrics.revenue || 0),
    };

    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  async count(filter: CampaignFilter): Promise<number> {
    const where: any = {};
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    return this.repository.count({ where });
  }

  async findExpiringCampaigns(daysUntilExpiry: number): Promise<Campaign[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
    
    const entities = await this.repository.find({
      where: {
        status: 'ACTIVE',
        endDate: LessThanOrEqual(expiryDate)
      }
    });
    
    return entities.map(entity => this.mapToDomain(entity));
  }

  private mapToDomain(entity: CampaignEntity): Campaign {
    return new Campaign(
      entity.id,
      entity.name,
      entity.type as CampaignType,
      entity.status as CampaignStatus,
      entity.description,
      entity.targetAudience as AudienceFilter,
      entity.startDate,
      entity.endDate,
      entity.budget ? Number(entity.budget) : null,
      Number(entity.spentBudget),
      entity.metrics as unknown as CampaignMetrics,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt
    );
  }

  private mapToEntity(domain: Campaign): CampaignEntity {
    const entity = new CampaignEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.type = domain.type;
    entity.status = domain.getStatus();
    entity.description = domain.description;
    entity.targetAudience = domain.targetAudience as Record<string, unknown>;
    entity.startDate = domain.startDate;
    entity.endDate = domain.endDate;
    entity.budget = domain.budget !== null ? domain.budget : undefined;
    entity.spentBudget = domain.spentBudget;
    entity.metrics = domain.metrics as any;
    entity.createdBy = domain.createdBy;
    return entity;
  }
}
