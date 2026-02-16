import { WorkflowTemplate } from '../entities/WorkflowTemplate';

export interface IWorkflowTemplateRepository {
  /**
   * Create a new workflow template
   */
  create(template: WorkflowTemplate): Promise<WorkflowTemplate>;

  /**
   * Find template by ID
   */
  findById(id: string): Promise<WorkflowTemplate | null>;

  /**
   * Find template by entity type and version
   */
  findByEntityType(entityType: string, version?: number): Promise<WorkflowTemplate | null>;

  /**
   * Find all templates for an entity type
   */
  findAllByEntityType(entityType: string): Promise<WorkflowTemplate[]>;

  /**
   * Find all active templates
   */
  findAllActive(): Promise<WorkflowTemplate[]>;

  /**
   * Update a template
   */
  update(id: string, template: Partial<WorkflowTemplate>): Promise<WorkflowTemplate>;

  /**
   * Soft delete a template
   */
  deactivate(id: string): Promise<void>;

  /**
   * Delete a template
   */
  delete(id: string): Promise<void>;

  /**
   * Check if template exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get all templates with pagination
   */
  findPaginated(page: number, limit: number): Promise<{ templates: WorkflowTemplate[]; total: number }>;

  /**
   * Get latest version of template for entity type
   */
  getLatestVersion(entityType: string): Promise<number>;
}
