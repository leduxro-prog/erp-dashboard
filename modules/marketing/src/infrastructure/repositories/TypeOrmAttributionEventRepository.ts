/**
 * TypeOrmAttributionEventRepository
 * Infrastructure implementation of IAttributionEventRepository using TypeORM
 *
 * @module Infrastructure/Repositories
 */
import { DataSource, Repository } from 'typeorm';

import { AttributionEvent, AttributionType } from '../../domain/entities/AttributionEvent';
import { CampaignChannel } from '../../domain/entities/CampaignStep';
import {
  AttributionFilter,
  AttributionSummary,
  FunnelStep,
  IAttributionEventRepository,
} from '../../domain/repositories/IAttributionEventRepository';
import { AttributionEventEntity } from '../entities/AttributionEventEntity';

export class TypeOrmAttributionEventRepository implements IAttributionEventRepository {
  private readonly repository: Repository<AttributionEventEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(AttributionEventEntity);
  }

  async save(event: AttributionEvent): Promise<AttributionEvent> {
    const entity = this.mapToEntity(event);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async bulkSave(events: AttributionEvent[]): Promise<AttributionEvent[]> {
    const entities = events.map((e) => this.mapToEntity(e));
    const savedEntities = await this.repository.save(entities);
    return savedEntities.map((e) => this.mapToDomain(e));
  }

  async findById(id: string): Promise<AttributionEvent | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByFilter(
    filter: AttributionFilter,
    pagination: { page: number; limit: number },
  ): Promise<{ items: AttributionEvent[]; total: number; page: number; pages: number }> {
    const qb = this.repository.createQueryBuilder('attr');

    if (filter.campaignId) {
      qb.andWhere('attr.campaignId = :campaignId', { campaignId: filter.campaignId });
    }
    if (filter.customerId) {
      qb.andWhere('attr.customerId = :customerId', { customerId: filter.customerId });
    }
    if (filter.channel) {
      qb.andWhere('attr.channel = :channel', { channel: filter.channel });
    }
    if (filter.isConversion !== undefined) {
      qb.andWhere('attr.isConversion = :isConversion', { isConversion: filter.isConversion });
    }
    if (filter.startDate) {
      qb.andWhere('attr.touchpointAt >= :startDate', { startDate: filter.startDate });
    }
    if (filter.endDate) {
      qb.andWhere('attr.touchpointAt <= :endDate', { endDate: filter.endDate });
    }

    qb.orderBy('attr.touchpointAt', 'DESC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit);

    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map((e) => this.mapToDomain(e)),
      total,
      page: pagination.page,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async getAttributionSummary(filter: {
    startDate: Date;
    endDate: Date;
    campaignId?: string;
  }): Promise<AttributionSummary[]> {
    const qb = this.repository
      .createQueryBuilder('attr')
      .select('attr.channel', 'channel')
      .addSelect('COUNT(*)::int', 'touchpoints')
      .addSelect('SUM(CASE WHEN attr.isConversion = true THEN 1 ELSE 0 END)::int', 'conversions')
      .addSelect('COALESCE(SUM(attr.revenue), 0)::numeric', 'revenue')
      .addSelect('COALESCE(SUM(attr.cost), 0)::numeric', 'cost')
      .where('attr.touchpointAt >= :startDate', { startDate: filter.startDate })
      .andWhere('attr.touchpointAt <= :endDate', { endDate: filter.endDate });

    if (filter.campaignId) {
      qb.andWhere('attr.campaignId = :campaignId', { campaignId: filter.campaignId });
    }

    const results = await qb.groupBy('attr.channel').getRawMany<{
      channel: string;
      touchpoints: number;
      conversions: number;
      revenue: string;
      cost: string;
    }>();

    return results.map((r) => {
      const revenue = Number(r.revenue);
      const cost = Number(r.cost);
      return {
        channel: r.channel,
        touchpoints: Number(r.touchpoints),
        conversions: Number(r.conversions),
        revenue,
        cost,
        roas: cost > 0 ? revenue / cost : 0,
      };
    });
  }

  async getFunnelData(campaignId: string, startDate: Date, endDate: Date): Promise<FunnelStep[]> {
    const results = await this.repository
      .createQueryBuilder('attr')
      .select('attr.touchpointType', 'stage')
      .addSelect('COUNT(*)::int', 'count')
      .where('attr.campaignId = :campaignId', { campaignId })
      .andWhere('attr.touchpointAt >= :startDate', { startDate })
      .andWhere('attr.touchpointAt <= :endDate', { endDate })
      .groupBy('attr.touchpointType')
      .orderBy('count', 'DESC')
      .getRawMany<{ stage: string; count: number }>();

    // Compute conversion rate as percentage relative to the largest stage
    const maxCount = results.length > 0 ? Number(results[0].count) : 1;

    return results.map((r) => ({
      stage: r.stage,
      count: Number(r.count),
      conversionRate: maxCount > 0 ? (Number(r.count) / maxCount) * 100 : 0,
    }));
  }

  async getRevenueByChannel(
    startDate: Date,
    endDate: Date,
  ): Promise<{ channel: string; revenue: number; conversions: number }[]> {
    const results = await this.repository
      .createQueryBuilder('attr')
      .select('attr.channel', 'channel')
      .addSelect('COALESCE(SUM(attr.revenue), 0)::numeric', 'revenue')
      .addSelect('SUM(CASE WHEN attr.isConversion = true THEN 1 ELSE 0 END)::int', 'conversions')
      .where('attr.touchpointAt >= :startDate', { startDate })
      .andWhere('attr.touchpointAt <= :endDate', { endDate })
      .groupBy('attr.channel')
      .orderBy('revenue', 'DESC')
      .getRawMany<{ channel: string; revenue: string; conversions: number }>();

    return results.map((r) => ({
      channel: r.channel,
      revenue: Number(r.revenue),
      conversions: Number(r.conversions),
    }));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(filter: AttributionFilter): Promise<number> {
    const qb = this.repository.createQueryBuilder('attr');

    if (filter.campaignId) {
      qb.andWhere('attr.campaignId = :campaignId', { campaignId: filter.campaignId });
    }
    if (filter.customerId) {
      qb.andWhere('attr.customerId = :customerId', { customerId: filter.customerId });
    }
    if (filter.channel) {
      qb.andWhere('attr.channel = :channel', { channel: filter.channel });
    }
    if (filter.isConversion !== undefined) {
      qb.andWhere('attr.isConversion = :isConversion', { isConversion: filter.isConversion });
    }
    if (filter.startDate) {
      qb.andWhere('attr.touchpointAt >= :startDate', { startDate: filter.startDate });
    }
    if (filter.endDate) {
      qb.andWhere('attr.touchpointAt <= :endDate', { endDate: filter.endDate });
    }

    return qb.getCount();
  }

  private mapToDomain(entity: AttributionEventEntity): AttributionEvent {
    return new AttributionEvent(
      entity.id,
      entity.campaignId ?? null,
      entity.customerId,
      entity.channel as CampaignChannel,
      entity.attributionType as AttributionType,
      entity.touchpointType,
      entity.touchpointUrl ?? null,
      entity.utmSource ?? null,
      entity.utmMedium ?? null,
      entity.utmCampaign ?? null,
      entity.utmContent ?? null,
      entity.utmTerm ?? null,
      entity.clickId ?? null,
      entity.orderId ?? null,
      Number(entity.revenue),
      Number(entity.cost),
      entity.isConversion,
      entity.conversionValue != null ? Number(entity.conversionValue) : null,
      entity.sessionId ?? null,
      entity.metadata ?? {},
      entity.touchpointAt,
      entity.createdAt,
    );
  }

  private mapToEntity(domain: AttributionEvent): AttributionEventEntity {
    const entity = new AttributionEventEntity();
    entity.id = domain.id;
    entity.campaignId = domain.campaignId ?? undefined;
    entity.customerId = domain.customerId;
    entity.channel = domain.channel;
    entity.attributionType = domain.attributionType;
    entity.touchpointType = domain.touchpointType;
    entity.touchpointUrl = domain.touchpointUrl ?? undefined;
    entity.utmSource = domain.utmSource ?? undefined;
    entity.utmMedium = domain.utmMedium ?? undefined;
    entity.utmCampaign = domain.utmCampaign ?? undefined;
    entity.utmContent = domain.utmContent ?? undefined;
    entity.utmTerm = domain.utmTerm ?? undefined;
    entity.clickId = domain.clickId ?? undefined;
    entity.orderId = domain.orderId ?? undefined;
    entity.revenue = domain.revenue;
    entity.cost = domain.cost;
    entity.isConversion = domain.isConversion;
    entity.conversionValue = domain.conversionValue ?? undefined;
    entity.sessionId = domain.sessionId ?? undefined;
    entity.metadata = domain.metadata;
    entity.touchpointAt = domain.touchpointAt;
    return entity;
  }
}
