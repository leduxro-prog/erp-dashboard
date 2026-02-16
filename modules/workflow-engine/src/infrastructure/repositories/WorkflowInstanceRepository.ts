import { DataSource, Repository } from 'typeorm';
import { WorkflowInstance, WorkflowInstanceStatus } from '../../domain/entities/WorkflowInstance';
import { IWorkflowInstanceRepository } from '../../domain/repositories/IWorkflowInstanceRepository';
import { WorkflowInstanceEntity } from '../entities/WorkflowInstanceEntity';
import { WorkflowInstanceMapper } from '../mappers/WorkflowInstanceMapper';

export class WorkflowInstanceRepository implements IWorkflowInstanceRepository {
  private repository: Repository<WorkflowInstanceEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(WorkflowInstanceEntity);
  }

  async create(instance: WorkflowInstance): Promise<WorkflowInstance> {
    const entity = WorkflowInstanceMapper.toPersistence(instance);
    const savedEntity = await this.repository.save(entity);
    return WorkflowInstanceMapper.toDomain(savedEntity);
  }

  async findById(id: string): Promise<WorkflowInstance | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? WorkflowInstanceMapper.toDomain(entity) : null;
  }

  async findByEntity(entityType: string, entityId: string): Promise<WorkflowInstance[]> {
    const entities = await this.repository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
    return WorkflowInstanceMapper.toDomainList(entities);
  }

  async findActiveByEntity(entityType: string, entityId: string): Promise<WorkflowInstance | null> {
    const entity = await this.repository.findOne({
      where: {
        entityType,
        entityId,
        status: 'in_progress' as any,
      },
    });
    return entity ? WorkflowInstanceMapper.toDomain(entity) : null;
  }

  async findByStatus(status: WorkflowInstanceStatus): Promise<WorkflowInstance[]> {
    const entities = await this.repository.find({
      where: { status: status as any },
      order: { createdAt: 'DESC' },
    });
    return WorkflowInstanceMapper.toDomainList(entities);
  }

  async findByTemplate(templateId: string): Promise<WorkflowInstance[]> {
    const entities = await this.repository.find({
      where: { templateId },
      order: { createdAt: 'DESC' },
    });
    return WorkflowInstanceMapper.toDomainList(entities);
  }

  async findPendingApproval(userId: string): Promise<WorkflowInstance[]> {
    const entities = await this.repository.find({
      where: { status: 'in_progress' as any },
      order: { createdAt: 'DESC' },
    });

    // Filter in-memory to check if user is in the current step's approvers
    return entities
      .map(e => WorkflowInstanceMapper.toDomain(e))
      .filter(instance => {
        const currentStep = instance.getCurrentStep();
        if (!currentStep) return false;

        const pendingApprovers = currentStep.approvalDecisions
          .filter(d => d.decision === undefined)
          .map(d => d.approverId);

        return pendingApprovers.includes(userId);
      });
  }

  async update(id: string, instance: Partial<WorkflowInstance>): Promise<WorkflowInstance> {
    await this.repository.update(id, {
      ...(instance.status && { status: instance.status as any }),
      ...(instance.currentStepId && { currentStepId: instance.currentStepId }),
      ...(instance.steps && { steps: instance.steps as any }),
      ...(instance.metadata && { metadata: instance.metadata }),
      ...(instance.completedAt && { completedAt: instance.completedAt }),
      updatedAt: new Date(),
    });

    const updated = await this.findById(id);
    if (!updated) throw new Error('Instance not found after update');
    return updated;
  }

  async updateStep(instanceId: string, stepId: string, updates: any): Promise<void> {
    const instance = await this.findById(instanceId);
    if (!instance) throw new Error('Instance not found');

    const step = instance.steps.find(s => s.id === stepId);
    if (!step) throw new Error('Step not found');

    Object.assign(step, updates);
    await this.update(instanceId, instance);
  }

  async addApprovalDecision(instanceId: string, stepId: string, decision: any): Promise<void> {
    const instance = await this.findById(instanceId);
    if (!instance) throw new Error('Instance not found');

    const step = instance.steps.find(s => s.id === stepId);
    if (!step) throw new Error('Step not found');

    step.approvalDecisions.push({
      id: `appr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      approverId: decision.approverId,
      approverName: decision.approverName,
      decision: decision.decision,
      comment: decision.comment,
      decidedAt: new Date(),
    });

    await this.update(instanceId, instance);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findPaginated(page: number, limit: number, filters?: any): Promise<{ instances: WorkflowInstance[]; total: number }> {
    let query = this.repository.createQueryBuilder('wf');

    if (filters?.status) {
      query = query.where('wf.status = :status', { status: filters.status });
    }

    if (filters?.entityType) {
      query = query.andWhere('wf.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters?.templateId) {
      query = query.andWhere('wf.templateId = :templateId', { templateId: filters.templateId });
    }

    const [entities, total] = await query
      .orderBy('wf.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      instances: WorkflowInstanceMapper.toDomainList(entities),
      total,
    };
  }

  async countByStatus(status: WorkflowInstanceStatus): Promise<number> {
    return this.repository.count({ where: { status: status as any } });
  }

  async findOverdue(timeoutMinutes: number): Promise<WorkflowInstance[]> {
    const cutoffDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const entities = await this.repository.find({
      where: { status: 'in_progress' as any },
    });

    return entities
      .map(e => WorkflowInstanceMapper.toDomain(e))
      .filter(instance => {
        const currentStep = instance.getCurrentStep();
        return currentStep?.startedAt ? currentStep.startedAt < cutoffDate : false;
      });
  }
}
