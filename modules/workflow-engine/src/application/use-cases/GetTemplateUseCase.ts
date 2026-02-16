import { createModuleLogger } from '@shared/utils/logger';
import { WorkflowTemplate } from '../../domain/entities/WorkflowTemplate';
import { IWorkflowTemplateRepository } from '../../domain/repositories/IWorkflowTemplateRepository';
import { TemplateNotFoundError } from '../errors/WorkflowError';

export class GetTemplateUseCase {
  private logger = createModuleLogger('GetTemplateUseCase');

  constructor(private templateRepository: IWorkflowTemplateRepository) {}

  async execute(templateId: string): Promise<WorkflowTemplate> {
    this.logger.info(`Getting workflow template: ${templateId}`);

    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    return template;
  }
}
