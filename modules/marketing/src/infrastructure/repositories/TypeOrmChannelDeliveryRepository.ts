import { DataSource, Repository, LessThan } from 'typeorm';

import { CampaignChannel } from '../../domain/entities/CampaignStep';
import { ChannelDelivery, DeliveryStatus } from '../../domain/entities/ChannelDelivery';
import {
  DeliveryFilter,
  IChannelDeliveryRepository,
} from '../../domain/repositories/IChannelDeliveryRepository';
import { ChannelDeliveryEntity } from '../entities/ChannelDeliveryEntity';

export class TypeOrmChannelDeliveryRepository implements IChannelDeliveryRepository {
  private readonly repository: Repository<ChannelDeliveryEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(ChannelDeliveryEntity);
  }

  async save(delivery: ChannelDelivery): Promise<ChannelDelivery> {
    const entity = this.mapToEntity(delivery);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async bulkSave(deliveries: ChannelDelivery[]): Promise<ChannelDelivery[]> {
    const entities = deliveries.map((d) => this.mapToEntity(d));
    const savedEntities = await this.repository.save(entities);
    return savedEntities.map((entity) => this.mapToDomain(entity));
  }

  async findById(id: string): Promise<ChannelDelivery | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByCampaign(
    campaignId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ChannelDelivery[]; total: number; page: number; pages: number }> {
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

  async findByFilter(
    filter: DeliveryFilter,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ChannelDelivery[]; total: number; page: number; pages: number }> {
    const qb = this.repository.createQueryBuilder('delivery');

    if (filter.campaignId) {
      qb.andWhere('delivery.campaign_id = :campaignId', { campaignId: filter.campaignId });
    }

    if (filter.stepId) {
      qb.andWhere('delivery.step_id = :stepId', { stepId: filter.stepId });
    }

    if (filter.customerId) {
      qb.andWhere('delivery.customer_id = :customerId', { customerId: filter.customerId });
    }

    if (filter.channel) {
      qb.andWhere('delivery.channel = :channel', { channel: filter.channel });
    }

    if (filter.status) {
      qb.andWhere('delivery.status = :status', { status: filter.status });
    }

    if (filter.sentAfter) {
      qb.andWhere('delivery.sent_at >= :sentAfter', { sentAfter: filter.sentAfter });
    }

    if (filter.sentBefore) {
      qb.andWhere('delivery.sent_at <= :sentBefore', { sentBefore: filter.sentBefore });
    }

    qb.orderBy('delivery.created_at', 'DESC');
    qb.skip((pagination.page - 1) * pagination.limit);
    qb.take(pagination.limit);

    const [entities, total] = await qb.getManyAndCount();
    const items = entities.map((entity) => this.mapToDomain(entity));

    return {
      items,
      total,
      page: pagination.page,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async findQueued(limit: number): Promise<ChannelDelivery[]> {
    const entities = await this.repository.find({
      where: { status: 'QUEUED' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async findRetryable(): Promise<ChannelDelivery[]> {
    const entities = await this.repository
      .createQueryBuilder('delivery')
      .where('delivery.status IN (:...statuses)', { statuses: ['FAILED', 'BOUNCED'] })
      .andWhere('delivery.retry_count < delivery.max_retries')
      .orderBy('delivery.created_at', 'ASC')
      .getMany();

    return entities.map((entity) => this.mapToDomain(entity));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repository.update(id, { status });
  }

  async countByCampaign(campaignId: string): Promise<Record<string, number>> {
    const results = await this.repository
      .createQueryBuilder('delivery')
      .select('delivery.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('delivery.campaign_id = :campaignId', { campaignId })
      .groupBy('delivery.status')
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  private mapToDomain(entity: ChannelDeliveryEntity): ChannelDelivery {
    return new ChannelDelivery(
      entity.id,
      entity.campaignId,
      entity.stepId ?? null,
      entity.customerId,
      entity.channel as CampaignChannel,
      entity.status as DeliveryStatus,
      entity.recipientAddress,
      entity.templateId ?? null,
      entity.templateData,
      entity.externalMessageId ?? null,
      entity.sentAt ?? null,
      entity.deliveredAt ?? null,
      entity.openedAt ?? null,
      entity.clickedAt ?? null,
      entity.failedAt ?? null,
      entity.failureReason ?? null,
      entity.retryCount,
      entity.maxRetries,
      Number(entity.cost),
      entity.metadata,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private mapToEntity(domain: ChannelDelivery): ChannelDeliveryEntity {
    const entity = new ChannelDeliveryEntity();
    entity.id = domain.id;
    entity.campaignId = domain.campaignId;
    entity.stepId = domain.stepId ?? undefined;
    entity.customerId = domain.customerId;
    entity.channel = domain.channel;
    entity.status = domain.getStatus();
    entity.recipientAddress = domain.recipientAddress;
    entity.templateId = domain.templateId ?? undefined;
    entity.templateData = domain.templateData;
    entity.externalMessageId = domain.externalMessageId ?? undefined;
    entity.sentAt = domain.sentAt ?? undefined;
    entity.deliveredAt = domain.deliveredAt ?? undefined;
    entity.openedAt = domain.openedAt ?? undefined;
    entity.clickedAt = domain.clickedAt ?? undefined;
    entity.failedAt = domain.failedAt ?? undefined;
    entity.failureReason = domain.failureReason ?? undefined;
    entity.retryCount = domain.getRetryCount();
    entity.maxRetries = domain.maxRetries;
    entity.cost = domain.cost;
    entity.metadata = domain.metadata;
    return entity;
  }
}
