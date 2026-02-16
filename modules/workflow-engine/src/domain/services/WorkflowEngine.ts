/**
 * Core Workflow Engine Service
 * Handles workflow orchestration, state transitions, and approval logic
 */

import { WorkflowTemplate, IWorkflowStep } from '../entities/WorkflowTemplate';
import { WorkflowInstance, WorkflowInstanceStatus, IWorkflowInstanceStep, IApprovalDecision } from '../entities/WorkflowInstance';

export interface IApprovalContext {
  approvalDecision: {
    approverId: string;
    approverName: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  };
}

export interface IEscalationContext {
  escalatedFrom: string;
  escalatedTo: string;
  reason: string;
}

export class WorkflowEngine {
  /**
   * Create a new workflow instance from a template
   */
  createInstanceFromTemplate(template: WorkflowTemplate, entityType: string, entityId: string, createdBy: string): WorkflowInstance {
    const firstStep = template.getFirstStep();
    if (!firstStep) {
      throw new Error('Template has no steps');
    }

    const instanceSteps: IWorkflowInstanceStep[] = template.steps.map(step => ({
      id: `step_${step.id}_${Date.now()}`,
      workflowStepId: step.id,
      status: 'pending',
      approvalDecisions: [],
    }));

    const instance = new WorkflowInstance(
      `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      template.id,
      entityType,
      entityId,
      WorkflowInstanceStatus.PENDING,
      instanceSteps[0].id,
      instanceSteps,
      undefined,
      createdBy,
      new Date(),
      new Date(),
    );

    return instance;
  }

  /**
   * Move to next step
   */
  moveToNextStep(
    instance: WorkflowInstance,
    template: WorkflowTemplate,
    currentStep: IWorkflowStep,
  ): { nextStep: IWorkflowStep | null; instance: WorkflowInstance } {
    const nextSteps = template.getNextSteps(currentStep.id);

    if (nextSteps.length === 0) {
      // Workflow completed
      instance.status = WorkflowInstanceStatus.APPROVED;
      instance.completedAt = new Date();
      return { nextStep: null, instance };
    }

    const nextStep = nextSteps[0];
    const nextInstanceStep = instance.steps.find(s => s.workflowStepId === nextStep.id);

    if (nextInstanceStep) {
      instance.currentStepId = nextInstanceStep.id;
      nextInstanceStep.status = 'in_progress';
      nextInstanceStep.startedAt = new Date();
    }

    instance.status = WorkflowInstanceStatus.IN_PROGRESS;
    instance.updatedAt = new Date();

    return { nextStep, instance };
  }

  /**
   * Add approval decision
   */
  addApprovalDecision(
    instance: WorkflowInstance,
    currentStep: IWorkflowInstanceStep,
    decision: IApprovalContext['approvalDecision'],
  ): void {
    const approvalDecision: IApprovalDecision = {
      id: `appr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      approverId: decision.approverId,
      approverName: decision.approverName,
      decision: decision.decision,
      comment: decision.comment,
      decidedAt: new Date(),
    };

    currentStep.approvalDecisions.push(approvalDecision);

    if (decision.decision === 'rejected') {
      currentStep.status = 'rejected';
      instance.status = WorkflowInstanceStatus.REJECTED;
      instance.completedAt = new Date();
    }
  }

  /**
   * Check if step is completed
   */
  isStepCompleted(currentStep: IWorkflowInstanceStep, requireAll: boolean, totalApprovers: number): boolean {
    if (requireAll) {
      return (
        currentStep.approvalDecisions.length === totalApprovers &&
        currentStep.approvalDecisions.every(d => d.decision === 'approved')
      );
    } else {
      return currentStep.approvalDecisions.some(d => d.decision === 'approved');
    }
  }

  /**
   * Check if step is blocked (rejection)
   */
  isStepBlocked(currentStep: IWorkflowInstanceStep): boolean {
    return currentStep.approvalDecisions.some(d => d.decision === 'rejected');
  }

  /**
   * Escalate workflow
   */
  escalate(instance: WorkflowInstance, context: IEscalationContext): void {
    instance.status = WorkflowInstanceStatus.ESCALATED;
    instance.updatedAt = new Date();

    const currentStep = instance.getCurrentStep();
    if (currentStep) {
      currentStep.escalatedAt = new Date();
    }
  }

  /**
   * Cancel workflow
   */
  cancel(instance: WorkflowInstance): void {
    instance.status = WorkflowInstanceStatus.CANCELLED;
    instance.completedAt = new Date();
    instance.updatedAt = new Date();
  }

  /**
   * Evaluate step conditions
   */
  evaluateConditions(stepConditions: any[], metadata?: Record<string, any>): boolean {
    if (!stepConditions || stepConditions.length === 0) {
      return true;
    }

    return stepConditions.every(condition => {
      const fieldValue = metadata?.[condition.field];
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  /**
   * Internal condition evaluator
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === expectedValue;
      case 'ne':
        return fieldValue !== expectedValue;
      case 'gt':
        return fieldValue > expectedValue;
      case 'gte':
        return fieldValue >= expectedValue;
      case 'lt':
        return fieldValue < expectedValue;
      case 'lte':
        return fieldValue <= expectedValue;
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'nin':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      default:
        return true;
    }
  }

  /**
   * Get next approvers for current step
   */
  getNextApprovers(currentStep: IWorkflowStep, instance: WorkflowInstance): string[] {
    const approversWhoDecided = instance
      .getCurrentStep()
      ?.approvalDecisions.map(d => d.approverId) || [];
    return currentStep.approvers.map(a => a.value).filter(a => !approversWhoDecided.includes(a));
  }
}
