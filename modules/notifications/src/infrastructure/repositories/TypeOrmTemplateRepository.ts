/**
 * TypeORM NotificationTemplate Repository
 * Implements ITemplateRepository using TypeORM
 */
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';
import { NotificationTemplate } from '../../domain/entities/NotificationTemplate';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { NotificationTemplateEntity } from '../entities/NotificationTemplateEntity';

/**
 * TypeORM implementation of ITemplateRepository
 */
export class TypeOrmTemplateRepository implements ITemplateRepository {
  private repository: Repository<NotificationTemplateEntity>;
  private logger: Logger;

  constructor(dataSource: DataSource, logger: Logger) {
    this.repository = dataSource.getRepository(NotificationTemplateEntity);
    this.logger = logger;
  }

  async save(template: NotificationTemplate): Promise<NotificationTemplate> {
    try {
      const props = template.toJSON();
      const entity = this.repository.create({
        id: props.id,
        name: props.name,
        slug: props.slug,
        channel: props.channel,
        subject: props.subject,
        body: props.body,
        locale: props.locale,
        isActive: props.isActive,
        version: props.version,
        createdBy: props.createdBy,
      });
      await this.repository.save(entity);
      return template;
    } catch (error) {
      this.logger.error('Error saving template', {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async update(template: NotificationTemplate): Promise<NotificationTemplate> {
    try {
      const props = template.toJSON();
      await this.repository.update(
        { id: props.id },
        {
          name: props.name,
          subject: props.subject,
          body: props.body,
          isActive: props.isActive,
        }
      );
      return template;
    } catch (error) {
      this.logger.error('Error updating template', {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<NotificationTemplate | null> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) return null;

      return new NotificationTemplate({
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        channel: entity.channel as any,
        subject: entity.subject,
        body: entity.body,
        locale: entity.locale as any,
        isActive: entity.isActive,
        version: entity.version,
        createdBy: entity.createdBy,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    } catch (error) {
      this.logger.error('Error finding template by ID', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findBySlug(slug: string, locale?: string): Promise<NotificationTemplate | null> {
    try {
      const where: any = { slug };
      if (locale) where.locale = locale;

      const entity = await this.repository.findOne({ where });
      if (!entity) return null;

      return new NotificationTemplate({
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        channel: entity.channel as any,
        subject: entity.subject,
        body: entity.body,
        locale: entity.locale as any,
        isActive: entity.isActive,
        version: entity.version,
        createdBy: entity.createdBy,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    } catch (error) {
      this.logger.error('Error finding template by slug', {
        slug,
        locale,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByChannel(
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH',
    locale?: string
  ): Promise<NotificationTemplate[]> {
    try {
      const where: any = { channel };
      if (locale) where.locale = locale;

      const entities = await this.repository.find({ where });
      return entities.map((e) => new NotificationTemplate({
        id: e.id,
        name: e.name,
        slug: e.slug,
        channel: e.channel as any,
        subject: e.subject,
        body: e.body,
        locale: e.locale as any,
        isActive: e.isActive,
        version: e.version,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Error finding templates by channel', {
        channel,
        locale,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findAll(options?: {
    isActive?: boolean;
    locale?: string;
    channel?: string;
  }): Promise<NotificationTemplate[]> {
    try {
      const where: any = {};
      if (options?.isActive !== undefined) where.isActive = options.isActive;
      if (options?.locale) where.locale = options.locale;
      if (options?.channel) where.channel = options.channel;

      const entities = await this.repository.find({ where });
      return entities.map((e) => new NotificationTemplate({
        id: e.id,
        name: e.name,
        slug: e.slug,
        channel: e.channel as any,
        subject: e.subject,
        body: e.body,
        locale: e.locale as any,
        isActive: e.isActive,
        version: e.version,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Error finding all templates', {
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findActive(): Promise<NotificationTemplate[]> {
    return this.findAll({ isActive: true });
  }

  async delete(id: string): Promise<number> {
    try {
      const result = await this.repository.delete({ id });
      return result.affected || 0;
    } catch (error) {
      this.logger.error('Error deleting template', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    try {
      const query = this.repository.createQueryBuilder('t').where('t.slug = :slug', { slug });
      if (excludeId) {
        query.andWhere('t.id != :excludeId', { excludeId });
      }
      const count = await query.getCount();
      return count > 0;
    } catch (error) {
      this.logger.error('Error checking if slug exists', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async incrementUsageCount(id: string): Promise<NotificationTemplate> {
    try {
      await this.repository.increment({ id }, 'usageCount', 1);
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) throw new Error(`Template ${id} not found`);

      return new NotificationTemplate({
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        channel: entity.channel as any,
        subject: entity.subject,
        body: entity.body,
        locale: entity.locale as any,
        isActive: entity.isActive,
        version: entity.version,
        createdBy: entity.createdBy,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    } catch (error) {
      this.logger.error('Error incrementing template usage count', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
