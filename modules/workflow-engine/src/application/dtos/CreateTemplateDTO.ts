import { IWorkflowStep } from '../../domain/entities/WorkflowTemplate';

export class CreateTemplateDTO {
  name!: string;
  description!: string;
  entityType!: string;
  steps!: IWorkflowStep[];
}

export class UpdateTemplateDTO {
  name?: string;
  description?: string;
  steps?: IWorkflowStep[];
  isActive?: boolean;
}
