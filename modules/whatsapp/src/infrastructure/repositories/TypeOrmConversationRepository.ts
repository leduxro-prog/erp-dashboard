import { DataSource, Repository, In, Like, LessThan } from 'typeorm';
import { WhatsAppConversation, ConversationStatus } from '../../domain/entities/WhatsAppConversation';
import {
  IConversationRepository,
  ConversationFilter,
} from '../../domain/repositories/IConversationRepository';
import {
  PaginationParams,
  PaginatedResult,
} from '../../domain/repositories/IMessageRepository';
import { WhatsAppConversationEntity } from '../entities/WhatsAppConversationEntity';

/**
 * TypeORM implementation of the Conversation Repository.
 * Provides persistence layer for WhatsApp conversations.
 */
export class TypeOrmConversationRepository implements IConversationRepository {
  private repository: Repository<WhatsAppConversationEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WhatsAppConversationEntity);
  }

  async save(conversation: WhatsAppConversation): Promise<WhatsAppConversation> {
    const entity = new WhatsAppConversationEntity();
    entity.id = conversation.id;
    entity.customerId = conversation.getCustomerId() ?? undefined;
    entity.phoneNumber = conversation.customerPhone;
    entity.displayName = conversation.customerName;
    entity.status = conversation.getStatus();
    entity.messageCount = conversation.getMessageCount();
    entity.lastMessageAt = conversation.getLastMessageAt();
    entity.createdAt = conversation.createdAt;
    entity.updatedAt = conversation.getUpdatedAt();
    entity.unreadCount = conversation.getUnreadCount();
    entity.tags = conversation.getTags();
    entity.priority = conversation.getPriority();
    entity.assignedTo = conversation.getAssignedToUserId();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<WhatsAppConversation | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByPhone(phone: string): Promise<WhatsAppConversation | null> {
    const entity = await this.repository.findOne({
      where: { phoneNumber: phone },
      order: { createdAt: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findOpen(
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>> {
    const [entities, total] = await this.repository.findAndCount({
      where: { status: In(['OPEN', 'ASSIGNED']) },
      order: { lastMessageAt: 'DESC' },
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

  async findAssigned(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>> {
    // Note: The entity needs an assignedToUserId field for this to work properly
    // For now, we return ASSIGNED conversations (entity would need extension)
    const [entities, total] = await this.repository.findAndCount({
      where: { status: 'ASSIGNED' },
      order: { lastMessageAt: 'DESC' },
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

  async findAll(
    filter: ConversationFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>> {
    const whereClause: any = {};

    if (filter.status) {
      whereClause.status = filter.status;
    }
    if (filter.customerId) {
      whereClause.customerId = filter.customerId;
    }
    if (filter.createdAfter) {
      whereClause.createdAt = LessThan(filter.createdAfter);
    }

    const [entities, total] = await this.repository.findAndCount({
      where: whereClause,
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

  async search(
    query: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>> {
    const [entities, total] = await this.repository.findAndCount({
      where: [
        { displayName: Like(`%${query}%`) },
        { phoneNumber: Like(`%${query}%`) },
      ],
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

  async findResolvedBefore(
    beforeDate: Date,
    limit: number
  ): Promise<WhatsAppConversation[]> {
    const entities = await this.repository.find({
      where: {
        status: 'RESOLVED',
        updatedAt: LessThan(beforeDate),
      },
      order: { updatedAt: 'ASC' },
      take: limit,
    });

    return entities.map((e) => this.toDomain(e));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  // Keep legacy methods for backward compatibility
  async findByCustomerId(customerId: string): Promise<WhatsAppConversation[]> {
    const entities = await this.repository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findActive(): Promise<WhatsAppConversation[]> {
    const entities = await this.repository.find({
      where: { status: In(['OPEN', 'ASSIGNED']) },
      order: { lastMessageAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: WhatsAppConversationEntity): WhatsAppConversation {
    return new WhatsAppConversation(
      entity.id,
      entity.customerId || null,
      entity.displayName || 'Unknown',
      entity.phoneNumber,
      entity.status as ConversationStatus,
      entity.createdAt,
      entity.updatedAt,
      entity.assignedTo,
      entity.lastMessageAt,
      entity.messageCount ?? 0,
      entity.unreadCount ?? 0,
      entity.tags ?? [],
      entity.priority ?? 'NORMAL',
    );
  }
}
