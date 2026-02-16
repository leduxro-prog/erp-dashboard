import { createModuleLogger } from '@shared/utils/logger';
import { WorkflowTemplate } from '../../domain/entities/WorkflowTemplate';
import { IWorkflowTemplateRepository } from '../../domain/repositories/IWorkflowTemplateRepository';
import { CreateTemplateDTO } from '../dtos/CreateTemplateDTO';
import { InvalidTemplateError } from '../errors/WorkflowError';

export class CreateTemplateUseCase {
  private logger = createModuleLogger('CreateTemplateUseCase');

  constructor(private templateRepository: IWorkflowTemplateRepository) {}

  async execute(dto: CreateTemplateDTO): Promise<WorkflowTemplate> {
    this.logger.info(`Creating workflow template for entity type: ${dto.entityType}`);

    // Check if template exists for this entity type
    const existingTemplate = await this.templateRepository.findByEntityType(dto.entityType);
    const newVersion = existingTemplate
      ? (await this.templateRepository.getLatestVersion(dto.entityType)) + 1
      : 1;

    const template = new WorkflowTemplate(
      `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dto.name,
      dto.description,
      dto.entityType,
      newVersion,
      dto.steps,
      true,
      new Date(),
      new Date(),
    );

    // Validate template
    const validation = template.validate();
    if (!validation.valid) {
      throw new InvalidTemplateError(validation.errors.join(', '));
    }

    const created = await this.templateRepository.create(template);
    this.logger.info(`Template created successfully: ${created.id}`);
    return created;
  }
}
