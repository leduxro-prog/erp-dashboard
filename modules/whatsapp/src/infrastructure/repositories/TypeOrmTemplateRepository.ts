import { DataSource, Repository } from 'typeorm';
import { WhatsAppTemplate } from '../../domain/entities/WhatsAppTemplate';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { WhatsAppTemplateEntity } from '../entities/WhatsAppTemplateEntity';

export class TypeOrmTemplateRepository implements ITemplateRepository {
  private repository: Repository<WhatsAppTemplateEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WhatsAppTemplateEntity);
  }

  async save(template: WhatsAppTemplate): Promise<WhatsAppTemplate> {
    const entity = new WhatsAppTemplateEntity();
    entity.id = template.id;
    entity.name = template.name;
    entity.content = template.bodyText;
    entity.category = template.category;
    entity.status = template.getStatus() as any;
    entity.externalTemplateId = template.getWhatsAppTemplateId();
    entity.parameters = template.parameters as any;
    entity.rejectionReason = template.getRejectedReason();
    entity.isActive = template.isActive;
    entity.usageCount = template.getUsageCount();
    entity.createdAt = template.createdAt;
    entity.updatedAt = new Date();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<WhatsAppTemplate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<WhatsAppTemplate | null> {
    const entity = await this.repository.findOne({ where: { name, isActive: true } });
    return entity ? this.toDomain(entity) : null;
  }

  async findApproved(pagination: any): Promise<any> {
    // TODO: Implement proper pagination
    const entities = await this.repository.find({
      where: { status: 'APPROVED', isActive: true },
      order: { createdAt: 'DESC' },
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
    });

    // Mock paginated result to satisfy interface
    return {
      items: entities.map(e => this.toDomain(e)),
      total: entities.length,
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
    };
  }

  async findPending(): Promise<WhatsAppTemplate[]> {
    const entities = await this.repository.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'ASC' },
    });
    return entities.map(e => this.toDomain(e));
  }

  async findAll(pagination: any): Promise<any> {
    const [entities, total] = await this.repository.findAndCount({
      take: pagination?.limit || 20,
      skip: pagination?.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      limit: pagination?.limit || 20,
      offset: pagination?.offset || 0,
    };
  }

  async updateStatus(id: string, status: any, details?: Record<string, unknown>): Promise<void> {
    await this.repository.update(id, {
      status,
      rejectionReason: details?.rejectionReason as string
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  private toDomain(entity: WhatsAppTemplateEntity): WhatsAppTemplate {
    return new WhatsAppTemplate(
      entity.id,
      entity.name,
      'ro', // Default language
      entity.category as any || 'UTILITY', // Default category
      entity.status as any,
      'NONE', // Default header type
      entity.content,
      entity.createdAt,
      entity.updatedAt,
      undefined, // headerContent
      undefined, // footerText
      [], // buttons
      entity.externalTemplateId,
      undefined, // submittedAt
      undefined, // approvedAt
      entity.rejectionReason,
      (entity.parameters as any) || [],
      entity.isActive,
      entity.usageCount || 0
    );
  }
}
