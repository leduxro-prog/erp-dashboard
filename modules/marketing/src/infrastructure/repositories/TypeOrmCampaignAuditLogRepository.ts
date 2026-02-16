import { DataSource, Repository } from 'typeorm';

import { CampaignAuditEntry } from '../../domain/entities/CampaignAuditEntry';
import { ICampaignAuditLogRepository } from '../../domain/repositories/ICampaignAuditLogRepository';
import { CampaignAuditLogEntity } from '../entities/CampaignAuditLogEntity';

export class TypeOrmCampaignAuditLogRepository implements ICampaignAuditLogRepository {
  private readonly repository: Repository<CampaignAuditLogEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(CampaignAuditLogEntity);
  }

  async save(entry: CampaignAuditEntry): Promise<CampaignAuditEntry> {
    const entity = this.mapToEntity(entry);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async findByCampaign(
    campaignId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ items: CampaignAuditEntry[]; total: number; page: number; pages: number }> {
    const [entities, total] = await this.repository.findAndCount({
      where: { campaignId },
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

  async findByActor(actorId: string, limit: number): Promise<CampaignAuditEntry[]> {
    const entities = await this.repository.find({
      where: { actorId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async findByAction(action: string, limit: number): Promise<CampaignAuditEntry[]> {
    const entities = await this.repository.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async count(campaignId: string): Promise<number> {
    return this.repository.count({ where: { campaignId } });
  }

  private mapToDomain(entity: CampaignAuditLogEntity): CampaignAuditEntry {
    return new CampaignAuditEntry(
      entity.id,
      entity.campaignId,
      entity.action,
      entity.actorId,
      entity.previousState ?? null,
      entity.newState ?? null,
      entity.details,
      entity.ipAddress ?? null,
      entity.createdAt,
    );
  }

  private mapToEntity(domain: CampaignAuditEntry): CampaignAuditLogEntity {
    const entity = new CampaignAuditLogEntity();
    entity.id = domain.id;
    entity.campaignId = domain.campaignId;
    entity.action = domain.action;
    entity.actorId = domain.actorId;
    entity.previousState = domain.previousState ?? undefined;
    entity.newState = domain.newState ?? undefined;
    entity.details = domain.details;
    entity.ipAddress = domain.ipAddress ?? undefined;
    return entity;
  }
}
