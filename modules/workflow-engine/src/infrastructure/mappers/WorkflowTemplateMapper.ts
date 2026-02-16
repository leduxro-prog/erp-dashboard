import { WorkflowTemplate } from '../../domain/entities/WorkflowTemplate';
import { WorkflowTemplateEntity } from '../entities/WorkflowTemplateEntity';

export class WorkflowTemplateMapper {
  static toDomain(entity: WorkflowTemplateEntity): WorkflowTemplate {
    return new WorkflowTemplate(
      entity.id,
      entity.name,
      entity.description,
      entity.entityType,
      entity.version,
      entity.steps,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
    );
  }

  static toPersistence(domain: WorkflowTemplate): WorkflowTemplateEntity {
    const entity = new WorkflowTemplateEntity();
    entity.id = domain.id;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.entityType = domain.entityType;
    entity.version = domain.version;
    entity.steps = domain.steps;
    entity.isActive = domain.isActive;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }

  static toDomainList(entities: WorkflowTemplateEntity[]): WorkflowTemplate[] {
    return entities.map(entity => this.toDomain(entity));
  }
}
