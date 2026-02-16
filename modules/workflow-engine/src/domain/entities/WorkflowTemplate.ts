/**
 * Domain Entity: Workflow Template
 * Represents a reusable workflow definition for a specific entity type
 */

export enum TemplateStepType {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
}

export enum ApproverType {
  USER = 'user',
  ROLE = 'role',
}

export interface IWorkflowStep {
  id: string;
  name: string;
  order: number;
  type: TemplateStepType;
  approvers: IApprover[];
  requireAll: boolean; // If true, all approvers must approve; if false, any one can approve
  timeout?: number; // In minutes, optional
  escalationRule?: IEscalationRule;
  conditions?: IStepCondition[];
}

export interface IApprover {
  id: string;
  type: ApproverType;
  value: string; // username or role name
}

export interface IEscalationRule {
  escalateAfterMinutes: number;
  escalateTo: string; // role or user id
  notifyInterval: number; // minutes between reminders
}

export interface IStepCondition {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
  value: any;
  targetStepId?: string; // Step to execute if condition is true; if null, skip to next
}

export class WorkflowTemplate {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public entityType: string, // e.g., 'purchase_order', 'leave_request', 'journal_entry'
    public version: number,
    public steps: IWorkflowStep[],
    public isActive: boolean,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  /**
   * Get step by ID
   */
  getStep(stepId: string): IWorkflowStep | undefined {
    return this.steps.find(s => s.id === stepId);
  }

  /**
   * Get first step
   */
  getFirstStep(): IWorkflowStep | undefined {
    return this.steps.sort((a, b) => a.order - b.order)[0];
  }

  /**
   * Get next step(s) for a given step
   */
  getNextSteps(stepId: string): IWorkflowStep[] {
    const currentStep = this.getStep(stepId);
    if (!currentStep) return [];

    return this.steps
      .filter(s => s.order > currentStep.order)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Validate template structure
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name) errors.push('Template name is required');
    if (!this.entityType) errors.push('Entity type is required');
    if (!this.steps || this.steps.length === 0) errors.push('At least one step is required');

    // Validate step structure
    this.steps.forEach((step, index) => {
      if (!step.name) errors.push(`Step ${index} name is required`);
      if (!step.approvers || step.approvers.length === 0) {
        errors.push(`Step ${step.name} must have at least one approver`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
