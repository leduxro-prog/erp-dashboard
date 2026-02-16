import { DataSource, Repository, Like } from 'typeorm';
import { WhatsAppTag } from '../../domain/entities/WhatsAppTag';
import { ITagRepository } from '../../domain/repositories/ITagRepository';
import { WhatsAppTagEntity } from '../entities/WhatsAppTagEntity';

/**
 * TypeORM implementation of Tag Repository.
 *
 * Provides persistence layer for WhatsApp tags.
 */
export class TypeOrmTagRepository implements ITagRepository {
  private repository: Repository<WhatsAppTagEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WhatsAppTagEntity);
  }

  async save(tag: WhatsAppTag): Promise<WhatsAppTag> {
    const entity = new WhatsAppTagEntity();
    entity.id = tag.id;
    entity.name = tag.getName();
    entity.color = tag.getColor();
    entity.createdAt = tag.createdAt;
    entity.updatedAt = tag.getUpdatedAt();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findAll(): Promise<WhatsAppTag[]> {
    const entities = await this.repository.find({ order: { name: 'ASC' } });
    return entities.map((e) => this.toDomain(e));
  }

  async findById(id: string): Promise<WhatsAppTag | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(entity: WhatsAppTagEntity): WhatsAppTag {
    return new WhatsAppTag(
      entity.id,
      entity.name,
      entity.color,
      entity.createdAt,
      entity.updatedAt,
    );
  }
}
