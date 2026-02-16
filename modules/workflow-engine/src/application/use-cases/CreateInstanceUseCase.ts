import { createModuleLogger } from '@shared/utils/logger';
import { WorkflowInstance } from '../../domain/entities/WorkflowInstance';
import { IWorkflowTemplateRepository } from '../../domain/repositories/IWorkflowTemplateRepository';
import { IWorkflowInstanceRepository } from '../../domain/repositories/IWorkflowInstanceRepository';
import { WorkflowEngine } from '../../domain/services/WorkflowEngine';
import { CreateInstanceDTO } from '../dtos/CreateInstanceDTO';
import { TemplateNotFoundError } from '../errors/WorkflowError';
import { IEventBus } from '@shared/module-system/module.interface';

export class CreateInstanceUseCase {
  private logger = createModuleLogger('CreateInstanceUseCase');
  private workflowEngine = new WorkflowEngine();

  constructor(
    private templateRepository: IWorkflowTemplateRepository,
    private instanceRepository: IWorkflowInstanceRepository,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: CreateInstanceDTO, userId: string): Promise<WorkflowInstance> {
    this.logger.info(`Creating workflow instance for ${dto.entityType}/${dto.entityId}`);

    // Get template
    const template = await this.templateRepository.findById(dto.templateId);
    if (!template) {
      throw new TemplateNotFoundError(dto.templateId);
    }

    // Create instance
    const instance = this.workflowEngine.createInstanceFromTemplate(
      template,
      dto.entityType,
      dto.entityId,
      userId,
    );

    instance.metadata = dto.metadata;
    instance.updatedAt = new Date();

    // Start first step
    const firstStep = instance.getCurrentStep();
    if (firstStep) {
      firstStep.status = 'in_progress';
      firstStep.startedAt = new Date();
    }

    instance.status = 'in_progress' as any;

    // Save instance
    const created = await this.instanceRepository.create(instance);
    this.logger.info(`Instance created: ${created.id}`);

    // Publish event
    await this.eventBus.publish('workflow.started', {
      instanceId: created.id,
      templateId: template.id,
      entityType: created.entityType,
      entityId: created.entityId,
    });

    return created;
  }
}
