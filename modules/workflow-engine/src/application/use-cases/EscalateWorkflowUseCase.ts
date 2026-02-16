import { createModuleLogger } from '@shared/utils/logger';
import { IWorkflowInstanceRepository } from '../../domain/repositories/IWorkflowInstanceRepository';
import { IWorkflowTemplateRepository } from '../../domain/repositories/IWorkflowTemplateRepository';
import { WorkflowEngine } from '../../domain/services/WorkflowEngine';
import { EscalateDTO } from '../dtos/CreateInstanceDTO';
import { InstanceNotFoundError, TemplateNotFoundError, WorkflowAlreadyCompletedError } from '../errors/WorkflowError';
import { IEventBus } from '@shared/module-system/module.interface';

export class EscalateWorkflowUseCase {
  private logger = createModuleLogger('EscalateWorkflowUseCase');
  private workflowEngine = new WorkflowEngine();

  constructor(
    private instanceRepository: IWorkflowInstanceRepository,
    private templateRepository: IWorkflowTemplateRepository,
    private eventBus: IEventBus,
  ) {}

  async execute(instanceId: string, userId: string, dto: EscalateDTO): Promise<void> {
    this.logger.info(`Escalating workflow instance: ${instanceId}`);

    // Get instance
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) {
      throw new InstanceNotFoundError(instanceId);
    }

    // Check if workflow is completed
    if (instance.isCompleted()) {
      throw new WorkflowAlreadyCompletedError();
    }

    // Get template to find escalation rules
    const template = await this.templateRepository.findById(instance.templateId);
    if (!template) {
      throw new TemplateNotFoundError(instance.templateId);
    }

    // Escalate workflow
    this.workflowEngine.escalate(instance, {
      escalatedFrom: userId,
      escalatedTo: '', // Would be determined by escalation rules
      reason: dto.reason,
    });

    // Save updated instance
    await this.instanceRepository.update(instanceId, instance);

    // Publish escalation event
    await this.eventBus.publish('workflow.escalated', {
      instanceId: instance.id,
      templateId: template.id,
      entityType: instance.entityType,
      entityId: instance.entityId,
      escalatedBy: userId,
      reason: dto.reason,
    });

    this.logger.info(`Workflow escalated successfully: ${instanceId}`);
  }
}
