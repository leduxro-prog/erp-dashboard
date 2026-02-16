import { DataSource, Repository, In } from 'typeorm';
import { WhatsAppMessage, MessageStatus } from '../../domain/entities/WhatsAppMessage';
import {
  IMessageRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/repositories/IMessageRepository';
import { WhatsAppMessageEntity } from '../entities/WhatsAppMessageEntity';

/**
 * TypeORM implementation of the Message Repository.
 * Provides persistence layer for WhatsApp messages.
 */
export class TypeOrmMessageRepository implements IMessageRepository {
  private repository: Repository<WhatsAppMessageEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WhatsAppMessageEntity);
  }

  async save(message: WhatsAppMessage): Promise<WhatsAppMessage> {
    const entity = new WhatsAppMessageEntity();
    entity.id = message.id;
    entity.conversationId = message.conversationId;
    entity.direction = message.direction;
    entity.messageType = message.messageType;
    entity.recipientPhone = message.recipientPhone;
    entity.senderPhone = message.senderPhone;
    entity.content = message.content;
    entity.status = message.getStatus();
    entity.templateName = message.templateName;
    entity.templateData = message.templateData;
    entity.mediaUrl = message.mediaUrl;
    entity.mediaType = message.mediaType;
    entity.whatsappMessageId = message.getWhatsAppMessageId();
    entity.failureReason = message.getFailureReason();
    entity.retryCount = message.getRetryCount();
    entity.metadata = message.metadata;
    entity.createdAt = message.createdAt;
    entity.updatedAt = message.getUpdatedAt();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<WhatsAppMessage | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByConversation(
    conversationId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppMessage>> {
    const [entities, total] = await this.repository.findAndCount({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      skip: pagination.offset,
      take: pagination.limit,
    });

    return {
      items: entities.map((e) => this.toDomain(e)),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  async findByPhone(
    phone: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppMessage>> {
    const [entities, total] = await this.repository.findAndCount({
      where: [{ recipientPhone: phone }, { senderPhone: phone }],
      order: { createdAt: 'DESC' },
      skip: pagination.offset,
      take: pagination.limit,
    });

    return {
      items: entities.map((e) => this.toDomain(e)),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  async findPending(limit: number): Promise<WhatsAppMessage[]> {
    const entities = await this.repository.find({
      where: { status: In(['PENDING', 'QUEUED']) },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return entities.map((e) => this.toDomain(e));
  }

  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    await this.repository.update(id, {
      status,
      updatedAt: new Date(),
    });
  }

  async countUnread(conversationId: string): Promise<number> {
    return this.repository.count({
      where: {
        conversationId,
        direction: 'INBOUND',
        status: In(['DELIVERED', 'SENT']),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(entity: WhatsAppMessageEntity): WhatsAppMessage {
    return new WhatsAppMessage(
      entity.id,
      entity.conversationId,
      entity.direction as any,
      entity.messageType as any,
      entity.recipientPhone,
      entity.senderPhone,
      entity.content,
      entity.status as any,
      entity.createdAt,
      entity.updatedAt,
      entity.templateName,
      entity.templateData,
      entity.mediaUrl,
      entity.mediaType,
      entity.whatsappMessageId,
      entity.failureReason,
      entity.retryCount || 0,
      entity.metadata || {}
    );
  }
}
