/**
 * TypeOrmMarketingEventRepository
 * Infrastructure implementation of IMarketingEventRepository using TypeORM
 *
 * @module Infrastructure/Repositories
 */
import { DataSource, LessThan, Repository } from 'typeorm';

import { MarketingEvent, MarketingEventType } from '../../domain/entities/MarketingEvent';
import {
  EventTypeAggregate,
  IMarketingEventRepository,
  TimeSeriesDataPoint,
} from '../../domain/repositories/IMarketingEventRepository';
import { MarketingEventEntity } from '../entities/MarketingEventEntity';

export class TypeOrmMarketingEventRepository implements IMarketingEventRepository {
  private readonly repository: Repository<MarketingEventEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(MarketingEventEntity);
  }

  async save(event: MarketingEvent): Promise<MarketingEvent> {
    const entity = this.mapToEntity(event);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async findByCampaign(
    campaignId: string,
    page: number,
    limit: number,
  ): Promise<{ items: MarketingEvent[]; total: number; page: number; pages: number }> {
    const [entities, total] = await this.repository.findAndCount({
      where: { campaignId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map((e) => this.mapToDomain(e)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async findByCustomer(customerId: string): Promise<MarketingEvent[]> {
    const entities = await this.repository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapToDomain(e));
  }

  async findBySequence(
    sequenceId: string,
    page: number,
    limit: number,
  ): Promise<{ items: MarketingEvent[]; total: number; page: number; pages: number }> {
    const qb = this.repository
      .createQueryBuilder('event')
      .where("event.metadata->>'emailSequenceId' = :sequenceId", { sequenceId })
      .orderBy('event.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map((e) => this.mapToDomain(e)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async countByType(campaignId: string): Promise<EventTypeAggregate[]> {
    const results = await this.repository
      .createQueryBuilder('event')
      .select('event.eventType', 'type')
      .addSelect('COUNT(*)::int', 'count')
      .where('event.campaignId = :campaignId', { campaignId })
      .groupBy('event.eventType')
      .getRawMany<{ type: string; count: number }>();

    return results.map((r) => ({
      type: r.type,
      count: Number(r.count),
    }));
  }

  async getTimeSeriesData(
    campaignId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'hour' | 'week',
  ): Promise<TimeSeriesDataPoint[]> {
    const truncUnit = groupBy === 'day' ? 'day' : groupBy === 'hour' ? 'hour' : 'week';

    const results = await this.repository
      .createQueryBuilder('event')
      .select(`DATE_TRUNC('${truncUnit}', event.createdAt)`, 'date')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect(
        `COALESCE(SUM(CASE WHEN event.eventType = 'CONVERTED' THEN (event.data->>'revenue')::numeric ELSE 0 END), 0)`,
        'revenue',
      )
      .where('event.campaignId = :campaignId', { campaignId })
      .andWhere('event.createdAt >= :startDate', { startDate })
      .andWhere('event.createdAt <= :endDate', { endDate })
      .groupBy(`DATE_TRUNC('${truncUnit}', event.createdAt)`)
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; count: number; revenue: string }>();

    return results.map((r) => ({
      date: new Date(r.date),
      count: Number(r.count),
      revenue: Number(r.revenue) || undefined,
    }));
  }

  async findConversions(
    campaignId: string,
    page: number,
    limit: number,
  ): Promise<{ items: MarketingEvent[]; total: number; page: number; pages: number }> {
    const [entities, total] = await this.repository.findAndCount({
      where: { campaignId, eventType: 'CONVERTED' },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map((e) => this.mapToDomain(e)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async getTotalRevenue(campaignId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('event')
      .select(`COALESCE(SUM((event.data->>'revenue')::numeric), 0)`, 'total')
      .where('event.campaignId = :campaignId', { campaignId })
      .andWhere("event.eventType = 'CONVERTED'")
      .getRawOne<{ total: string }>();

    return Number(result?.total) || 0;
  }

  async findByType(type: string): Promise<MarketingEvent[]> {
    const entities = await this.repository.find({
      where: { eventType: type },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapToDomain(e));
  }

  async deleteOlderThan(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.repository.delete({
      createdAt: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }

  async count(campaignId: string): Promise<number> {
    return this.repository.count({
      where: { campaignId },
    });
  }

  /**
   * Map TypeORM entity to domain entity
   *
   * Field mapping:
   *   entity.eventType     → domain.type
   *   entity.data          → domain.metadata
   *   entity.metadata      → holds domain-only fields (discountCodeId, emailSequenceId)
   *   entity.createdAt     → domain.timestamp
   *   entity.description, entity.sourceChannel are entity-only (not in domain)
   */
  private mapToDomain(entity: MarketingEventEntity): MarketingEvent {
    const entityMeta = (entity.metadata ?? {}) as Record<string, unknown>;

    return new MarketingEvent(
      entity.id,
      entity.eventType as MarketingEventType,
      entity.campaignId ?? '',
      entity.customerId ?? '',
      (entityMeta.discountCodeId as string) ?? null,
      (entityMeta.emailSequenceId as string) ?? null,
      entity.data ?? {},
      entity.createdAt,
    );
  }

  /**
   * Map domain entity to TypeORM entity
   *
   * Field mapping:
   *   domain.type       → entity.eventType
   *   domain.metadata   → entity.data
   *   domain.campaignId → entity.campaignId
   *   domain.customerId → entity.customerId
   *   Domain-only fields (discountCodeId, emailSequenceId) → entity.metadata
   */
  private mapToEntity(domain: MarketingEvent): MarketingEventEntity {
    const entity = new MarketingEventEntity();
    entity.id = domain.id;
    entity.eventType = domain.type;
    entity.campaignId = domain.campaignId;
    entity.customerId = domain.customerId;
    entity.data = domain.metadata;
    entity.metadata = {
      discountCodeId: domain.discountCodeId,
      emailSequenceId: domain.emailSequenceId,
    };
    return entity;
  }
}
