import { createModuleLogger } from '@shared/utils/logger';
import { IWorkflowTemplateRepository } from '../../domain/repositories/IWorkflowTemplateRepository';
import { IWorkflowInstanceRepository } from '../../domain/repositories/IWorkflowInstanceRepository';
import { WorkflowEngine } from '../../domain/services/WorkflowEngine';
import { ApproveDTO } from '../dtos/CreateInstanceDTO';
import { InstanceNotFoundError, TemplateNotFoundError, UnauthorizedApprovalError, WorkflowAlreadyCompletedError, InvalidApprovalDecisionError } from '../errors/WorkflowError';
import { IEventBus } from '@shared/module-system/module.interface';

export class ApproveStepUseCase {
  private logger = createModuleLogger('ApproveStepUseCase');
  private workflowEngine = new WorkflowEngine();

  constructor(
    private templateRepository: IWorkflowTemplateRepository,
    private instanceRepository: IWorkflowInstanceRepository,
    private eventBus: IEventBus,
  ) {}

  async execute(instanceId: string, userId: string, approverName: string, dto: ApproveDTO): Promise<void> {
    this.logger.info(`Processing approval for instance ${instanceId} by user ${userId}`);

    // Get instance
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) {
      throw new InstanceNotFoundError(instanceId);
    }

    // Check if workflow is completed
    if (instance.isCompleted()) {
      throw new WorkflowAlreadyCompletedError();
    }

    // Get template
    const template = await this.templateRepository.findById(instance.templateId);
    if (!template) {
      throw new TemplateNotFoundError(instance.templateId);
    }

    // Get current step
    const currentStep = instance.getCurrentStep();
    if (!currentStep) {
      throw new Error('No current step found');
    }

    const workflowStep = template.getStep(currentStep.workflowStepId);
    if (!workflowStep) {
      throw new Error('Workflow step not found');
    }

    // Check if user is authorized to approve
    const isAuthorized = workflowStep.approvers.some(a => a.value === userId);
    if (!isAuthorized) {
      throw new UnauthorizedApprovalError(userId);
    }

    // Check if user already approved
    const alreadyApproved = currentStep.approvalDecisions.some(d => d.approverId === userId);
    if (alreadyApproved) {
      throw new InvalidApprovalDecisionError('User has already approved this step');
    }

    // Add approval decision
    this.workflowEngine.addApprovalDecision(instance, currentStep, {
      approverId: userId,
      approverName,
      decision: dto.decision,
      comment: dto.comment,
    });

    // Check if step is completed or rejected
    const isCompleted = this.workflowEngine.isStepCompleted(
      currentStep,
      workflowStep.requireAll,
      workflowStep.approvers.length,
    );

    const isBlocked = this.workflowEngine.isStepBlocked(currentStep);

    if (isBlocked || isCompleted) {
      currentStep.completedAt = new Date();
      currentStep.status = isBlocked ? 'rejected' : 'approved';

      if (isBlocked) {
        // Workflow rejected
        instance.status = 'rejected' as any;
        instance.completedAt = new Date();

        await this.instanceRepository.update(instanceId, instance);

        await this.eventBus.publish('workflow.rejected', {
          instanceId: instance.id,
          templateId: template.id,
          entityType: instance.entityType,
          entityId: instance.entityId,
          rejectedBy: userId,
          reason: dto.comment,
        });
      } else {
        // Move to next step
        const { nextStep } = this.workflowEngine.moveToNextStep(instance, template, workflowStep);

        await this.instanceRepository.update(instanceId, instance);

        if (nextStep) {
          await this.eventBus.publish('workflow.step_completed', {
            instanceId: instance.id,
            currentStepId: currentStep.workflowStepId,
            nextStepId: nextStep.id,
            approvedBy: userId,
          });
        } else {
          // Workflow approved
          await this.eventBus.publish('workflow.approved', {
            instanceId: instance.id,
            templateId: template.id,
            entityType: instance.entityType,
            entityId: instance.entityId,
            approvedBy: userId,
          });
        }
      }
    } else {
      // Step still pending other approvers
      await this.instanceRepository.update(instanceId, instance);

      await this.eventBus.publish('workflow.step_completed', {
        instanceId: instance.id,
        currentStepId: currentStep.workflowStepId,
        approvedBy: userId,
        pendingApprovers: this.workflowEngine.getNextApprovers(workflowStep, instance),
      });
    }

    this.logger.info(`Approval processed successfully for instance ${instanceId}`);
  }
}
