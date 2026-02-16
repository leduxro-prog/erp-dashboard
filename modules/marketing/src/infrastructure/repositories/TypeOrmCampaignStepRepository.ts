import { DataSource, Repository } from 'typeorm';

import {
  CampaignStep,
  StepType,
  StepStatus,
  CampaignChannel,
} from '../../domain/entities/CampaignStep';
import { ICampaignStepRepository } from '../../domain/repositories/ICampaignStepRepository';
import { CampaignStepEntity } from '../entities/CampaignStepEntity';

export class TypeOrmCampaignStepRepository implements ICampaignStepRepository {
  private readonly repository: Repository<CampaignStepEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(CampaignStepEntity);
  }

  async save(step: CampaignStep): Promise<CampaignStep> {
    const entity = this.mapToEntity(step);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async findById(id: string): Promise<CampaignStep | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByCampaign(campaignId: string): Promise<CampaignStep[]> {
    const entities = await this.repository.find({
      where: { campaignId },
      order: { stepOrder: 'ASC' },
    });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async findByCampaignAndOrder(
    campaignId: string,
    stepOrder: number,
  ): Promise<CampaignStep | null> {
    const entity = await this.repository.findOne({
      where: { campaignId, stepOrder },
    });
    return entity ? this.mapToDomain(entity) : null;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repository.update(id, { status });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  async deleteAllByCampaign(campaignId: string): Promise<number> {
    const result = await this.repository.delete({ campaignId });
    return result.affected || 0;
  }

  async count(campaignId: string): Promise<number> {
    return this.repository.count({ where: { campaignId } });
  }

  async getNextStepOrder(campaignId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('step')
      .select('MAX(step.step_order)', 'maxOrder')
      .where('step.campaign_id = :campaignId', { campaignId })
      .getRawOne();

    return (result?.maxOrder ?? 0) + 1;
  }

  private mapToDomain(entity: CampaignStepEntity): CampaignStep {
    return new CampaignStep(
      entity.id,
      entity.campaignId,
      entity.stepOrder,
      entity.stepType as StepType,
      entity.status as StepStatus,
      entity.name,
      entity.description ?? null,
      (entity.channel as CampaignChannel) ?? null,
      entity.templateId ?? null,
      entity.templateData,
      entity.delayMinutes,
      entity.conditionRules ?? null,
      entity.splitConfig ?? null,
      entity.webhookUrl ?? null,
      entity.retryCount,
      entity.maxRetries,
      entity.startedAt ?? null,
      entity.completedAt ?? null,
      entity.metadata,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  private mapToEntity(domain: CampaignStep): CampaignStepEntity {
    const entity = new CampaignStepEntity();
    entity.id = domain.id;
    entity.campaignId = domain.campaignId;
    entity.stepOrder = domain.stepOrder;
    entity.stepType = domain.stepType;
    entity.status = domain.getStatus();
    entity.name = domain.name;
    entity.description = domain.description ?? undefined;
    entity.channel = domain.channel ?? undefined;
    entity.templateId = domain.templateId ?? undefined;
    entity.templateData = domain.templateData;
    entity.delayMinutes = domain.delayMinutes;
    entity.conditionRules = domain.conditionRules ?? undefined;
    entity.splitConfig = domain.splitConfig ?? undefined;
    entity.webhookUrl = domain.webhookUrl ?? undefined;
    entity.retryCount = domain.getRetryCount();
    entity.maxRetries = domain.maxRetries;
    entity.startedAt = domain.startedAt ?? undefined;
    entity.completedAt = domain.completedAt ?? undefined;
    entity.metadata = domain.metadata;
    return entity;
  }
}
