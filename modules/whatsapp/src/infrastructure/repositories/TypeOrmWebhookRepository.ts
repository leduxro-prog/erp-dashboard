import { DataSource, Repository } from 'typeorm';
import { WhatsAppWebhookEvent } from '../../domain/entities/WhatsAppWebhookEvent';
import { IWebhookRepository } from '../../domain/repositories/IWebhookRepository';
import { WhatsAppWebhookEventEntity } from '../entities/WhatsAppWebhookEventEntity';

export class TypeOrmWebhookRepository implements IWebhookRepository {
  private repository: Repository<WhatsAppWebhookEventEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WhatsAppWebhookEventEntity);
  }

  async save(event: WhatsAppWebhookEvent): Promise<WhatsAppWebhookEvent> {
    const entity = new WhatsAppWebhookEventEntity();
    entity.id = event.id;
    entity.messageId = event.messageId;
    entity.eventType = event.eventType;
    entity.payload = event.payload;
    entity.processed = event.isProcessed();
    entity.processedAt = event.getProcessedAt();
    entity.processError = event.getProcessingError();
    entity.retryCount = event.getRetryCount();
    entity.createdAt = event.createdAt;
    entity.updatedAt = new Date();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<WhatsAppWebhookEvent | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIdempotencyKey(messageId: string): Promise<WhatsAppWebhookEvent | null> {
    const entity = await this.repository.findOne({ where: { messageId } });
    return entity ? this.toDomain(entity) : null;
  }

  async markProcessed(id: string): Promise<void> {
    await this.repository.update(id, {
      processed: true,
      processedAt: new Date(),
      processError: null as any
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.repository.update(id, {
      processed: false,
      processError: error,
      processedAt: new Date()
    });
    await this.repository.increment({ id }, 'retryCount', 1);
  }

  async findPending(pagination: any): Promise<any> {
    const [entities, total] = await this.repository.findAndCount({
      where: { processed: false },
      order: { createdAt: 'ASC' },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
    };
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findByMessageId(messageId: string): Promise<WhatsAppWebhookEvent[]> {
    const entities = await this.repository.find({
      where: { messageId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(e => this.toDomain(e));
  }

  async findUnprocessed(): Promise<WhatsAppWebhookEvent[]> {
    const entities = await this.repository.find({
      where: { processed: false },
      order: { createdAt: 'ASC' },
    });
    return entities.map(e => this.toDomain(e));
  }

  async findFailed(): Promise<WhatsAppWebhookEvent[]> {
    const entities = await this.repository.createQueryBuilder('event')
      .where('event.processed = :processed', { processed: false })
      .andWhere('event.retryCount >= :retryCount', { retryCount: 3 })
      .orderBy('event.createdAt', 'ASC')
      .getMany();

    return entities.map(e => this.toDomain(e));
  }

  private toDomain(entity: WhatsAppWebhookEventEntity): WhatsAppWebhookEvent {
    return new WhatsAppWebhookEvent(
      entity.id,
      entity.eventType as any,
      entity.payload,
      entity.messageId || 'UNKNOWN',
      entity.createdAt,
      entity.processedAt,
      entity.processError,
      entity.retryCount || 0
    );
  }
}
