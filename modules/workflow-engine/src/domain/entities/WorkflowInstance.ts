/**
 * Domain Entity: Workflow Instance
 * Represents a runtime instance of a workflow template
 */

export enum WorkflowInstanceStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  ESCALATED = 'escalated',
}

export interface IWorkflowInstanceStep {
  id: string;
  workflowStepId: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'skipped';
  approvalDecisions: IApprovalDecision[];
  startedAt?: Date;
  completedAt?: Date;
  escalatedAt?: Date;
}

export interface IApprovalDecision {
  id: string;
  approverId: string;
  approverName: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decidedAt: Date;
}

export interface IWorkflowAuditLog {
  id: string;
  action: string;
  actor: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export class WorkflowInstance {
  constructor(
    public id: string,
    public templateId: string,
    public entityType: string,
    public entityId: string,
    public status: WorkflowInstanceStatus,
    public currentStepId: string,
    public steps: IWorkflowInstanceStep[],
    public metadata?: Record<string, any>,
    public createdBy?: string,
    public createdAt?: Date,
    public updatedAt?: Date,
    public completedAt?: Date,
  ) {}

  /**
   * Get current step
   */
  getCurrentStep(): IWorkflowInstanceStep | undefined {
    return this.steps.find(s => s.id === this.currentStepId);
  }

  /**
   * Get all approval decisions for this workflow
   */
  getAllDecisions(): IApprovalDecision[] {
    return this.steps.flatMap(s => s.approvalDecisions);
  }

  /**
   * Check if workflow is completed
   */
  isCompleted(): boolean {
    return [WorkflowInstanceStatus.APPROVED, WorkflowInstanceStatus.REJECTED, WorkflowInstanceStatus.CANCELLED].includes(
      this.status,
    );
  }

  /**
   * Get approval count for a step
   */
  getStepApprovalCount(stepId: string): number {
    const step = this.steps.find(s => s.id === stepId);
    return step?.approvalDecisions.filter(d => d.decision === 'approved').length ?? 0;
  }

  /**
   * Get rejection count for a step
   */
  getStepRejectionCount(stepId: string): number {
    const step = this.steps.find(s => s.id === stepId);
    return step?.approvalDecisions.filter(d => d.decision === 'rejected').length ?? 0;
  }

  /**
   * Get time spent on current step
   */
  getCurrentStepDuration(): number {
    const currentStep = this.getCurrentStep();
    if (!currentStep || !currentStep.startedAt) return 0;

    const endTime = currentStep.completedAt || new Date();
    return endTime.getTime() - currentStep.startedAt.getTime();
  }

  /**
   * Get total workflow duration
   */
  getTotalDuration(): number {
    if (!this.createdAt) return 0;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.createdAt.getTime();
  }

  /**
   * Check if workflow is overdue
   */
  isOverdue(stepTimeoutMinutes: number): boolean {
    const currentStep = this.getCurrentStep();
    if (!currentStep || !currentStep.startedAt) return false;

    const timeoutMs = stepTimeoutMinutes * 60 * 1000;
    const elapsedMs = new Date().getTime() - currentStep.startedAt.getTime();
    return elapsedMs > timeoutMs;
  }
}
