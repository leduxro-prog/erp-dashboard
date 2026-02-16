import { WorkflowInstance, WorkflowInstanceStatus } from '../entities/WorkflowInstance';

export interface IWorkflowInstanceRepository {
  /**
   * Create a new workflow instance
   */
  create(instance: WorkflowInstance): Promise<WorkflowInstance>;

  /**
   * Find instance by ID
   */
  findById(id: string): Promise<WorkflowInstance | null>;

  /**
   * Find instances by entity (e.g., all workflows for a PO)
   */
  findByEntity(entityType: string, entityId: string): Promise<WorkflowInstance[]>;

  /**
   * Find active instance for an entity (should be max 1)
   */
  findActiveByEntity(entityType: string, entityId: string): Promise<WorkflowInstance | null>;

  /**
   * Find instances by status
   */
  findByStatus(status: WorkflowInstanceStatus): Promise<WorkflowInstance[]>;

  /**
   * Find instances by template
   */
  findByTemplate(templateId: string): Promise<WorkflowInstance[]>;

  /**
   * Find instances pending approval
   */
  findPendingApproval(userId: string): Promise<WorkflowInstance[]>;

  /**
   * Update instance
   */
  update(id: string, instance: Partial<WorkflowInstance>): Promise<WorkflowInstance>;

  /**
   * Update instance step
   */
  updateStep(instanceId: string, stepId: string, updates: any): Promise<void>;

  /**
   * Add approval decision to step
   */
  addApprovalDecision(instanceId: string, stepId: string, decision: any): Promise<void>;

  /**
   * Delete instance
   */
  delete(id: string): Promise<void>;

  /**
   * Get with pagination
   */
  findPaginated(page: number, limit: number, filters?: any): Promise<{ instances: WorkflowInstance[]; total: number }>;

  /**
   * Count by status
   */
  countByStatus(status: WorkflowInstanceStatus): Promise<number>;

  /**
   * Find overdue instances
   */
  findOverdue(timeoutMinutes: number): Promise<WorkflowInstance[]>;
}
