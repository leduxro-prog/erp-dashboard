import { DataSource, Repository } from 'typeorm';
import { WhatsAppAgent, AgentStatus } from '../../domain/entities/WhatsAppAgent';
import { IAgentRepository } from '../../domain/repositories/IAgentRepository';
import { WhatsAppAgentEntity } from '../entities/WhatsAppAgentEntity';

/**
 * TypeORM implementation of Agent Repository.
 *
 * Provides persistence layer for WhatsApp agents.
 */
export class TypeOrmAgentRepository implements IAgentRepository {
  private repository: Repository<WhatsAppAgentEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WhatsAppAgentEntity);
  }

  async findByUserId(userId: string): Promise<WhatsAppAgent | null> {
    const entity = await this.repository.findOne({ where: { id: userId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(filter?: any): Promise<WhatsAppAgent[]> {
    const where: any = {};
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.search) {
      where.name = Like(`%${filter.search}%`);
    }

    const entities = await this.repository.find({ where, order: { name: 'ASC' } });
    return entities.map((e) => this.toDomain(e));
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<WhatsAppAgent> {
    const entity = await this.repository.findOne({ where: { id: agentId } });
    if (!entity) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    entity.status = status;
    entity.lastStatusUpdate = new Date();
    entity.updatedAt = new Date();

    await this.repository.save(entity);
    return this.toDomain(entity);
  }

  async updateCounts(
    agentId: string,
    deltaActive: number,
    deltaAssigned: number,
  ): Promise<void> {
    const entity = await this.repository.findOne({ where: { id: agentId } });
    if (!entity) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    entity.activeConversations = Math.max(0, entity.activeConversations + deltaActive);
    entity.assignedConversations = Math.max(0, entity.assignedConversations + deltaAssigned);
    entity.updatedAt = new Date();

    await this.repository.save(entity);
  }

  async getAvailabilityStats(): Promise<{
    online: number;
    away: number;
    offline: number;
  }> {
    const [online, away, offline] = await Promise.all([
      this.repository.count({ where: { status: 'online' } }),
      this.repository.count({ where: { status: 'away' } }),
      this.repository.count({ where: { status: 'offline' } }),
    ]);

    return { online, away, offline };
  }

  private toDomain(entity: WhatsAppAgentEntity): WhatsAppAgent {
    return new WhatsAppAgent(
      entity.id,
      entity.name,
      entity.status,
      entity.email,
      entity.avatar,
      entity.activeConversations,
      entity.assignedConversations,
      entity.lastStatusUpdate,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
