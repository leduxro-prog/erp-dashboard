import { WorkflowInstance } from '../../domain/entities/WorkflowInstance';
import { WorkflowInstanceEntity } from '../entities/WorkflowInstanceEntity';

export class WorkflowInstanceMapper {
  static toDomain(entity: WorkflowInstanceEntity): WorkflowInstance {
    return new WorkflowInstance(
      entity.id,
      entity.templateId,
      entity.entityType,
      entity.entityId,
      entity.status as any,
      entity.currentStepId,
      entity.steps,
      entity.metadata,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      entity.completedAt,
    );
  }

  static toPersistence(domain: WorkflowInstance): WorkflowInstanceEntity {
    const entity = new WorkflowInstanceEntity();
    entity.id = domain.id;
    entity.templateId = domain.templateId;
    entity.entityType = domain.entityType;
    entity.entityId = domain.entityId;
    entity.status = domain.status;
    entity.currentStepId = domain.currentStepId;
    entity.steps = domain.steps;
    entity.metadata = domain.metadata;
    entity.createdBy = domain.createdBy;
    entity.createdAt = domain.createdAt ?? new Date();
    entity.updatedAt = domain.updatedAt ?? new Date();
    entity.completedAt = domain.completedAt;
    return entity;
  }

  static toDomainList(entities: WorkflowInstanceEntity[]): WorkflowInstance[] {
    return entities.map(entity => this.toDomain(entity));
  }
}
