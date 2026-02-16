import { DataSource, Repository } from 'typeorm';
import { WorkflowTemplate } from '../../domain/entities/WorkflowTemplate';
import { IWorkflowTemplateRepository } from '../../domain/repositories/IWorkflowTemplateRepository';
import { WorkflowTemplateEntity } from '../entities/WorkflowTemplateEntity';
import { WorkflowTemplateMapper } from '../mappers/WorkflowTemplateMapper';

export class WorkflowTemplateRepository implements IWorkflowTemplateRepository {
  private repository: Repository<WorkflowTemplateEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WorkflowTemplateEntity);
  }

  async create(template: WorkflowTemplate): Promise<WorkflowTemplate> {
    const entity = WorkflowTemplateMapper.toPersistence(template);
    const savedEntity = await this.repository.save(entity);
    return WorkflowTemplateMapper.toDomain(savedEntity);
  }

  async findById(id: string): Promise<WorkflowTemplate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? WorkflowTemplateMapper.toDomain(entity) : null;
  }

  async findByEntityType(entityType: string, version?: number): Promise<WorkflowTemplate | null> {
    let query = this.repository.createQueryBuilder().where('entityType = :entityType', { entityType });

    if (version !== undefined) {
      query = query.andWhere('version = :version', { version });
    }

    const entity = await query.getOne();
    return entity ? WorkflowTemplateMapper.toDomain(entity) : null;
  }

  async findAllByEntityType(entityType: string): Promise<WorkflowTemplate[]> {
    const entities = await this.repository.find({ where: { entityType } });
    return WorkflowTemplateMapper.toDomainList(entities);
  }

  async findAllActive(): Promise<WorkflowTemplate[]> {
    const entities = await this.repository.find({ where: { isActive: true } });
    return WorkflowTemplateMapper.toDomainList(entities);
  }

  async update(id: string, template: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> {
    await this.repository.update(id, {
      ...(template.name && { name: template.name }),
      ...(template.description && { description: template.description }),
      ...(template.steps && { steps: template.steps as any }),
      ...(template.isActive !== undefined && { isActive: template.isActive }),
      updatedAt: new Date(),
    });

    const updated = await this.findById(id);
    if (!updated) throw new Error('Template not found after update');
    return updated;
  }

  async deactivate(id: string): Promise<void> {
    await this.repository.update(id, { isActive: false });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }

  async findPaginated(page: number, limit: number): Promise<{ templates: WorkflowTemplate[]; total: number }> {
    const [entities, total] = await this.repository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      templates: WorkflowTemplateMapper.toDomainList(entities),
      total,
    };
  }

  async getLatestVersion(entityType: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .where('entityType = :entityType', { entityType })
      .orderBy('version', 'DESC')
      .limit(1)
      .getOne();

    return result ? result.version : 0;
  }
}
