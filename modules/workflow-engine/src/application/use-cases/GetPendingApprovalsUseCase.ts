import { createModuleLogger } from '@shared/utils/logger';
import { WorkflowInstance } from '../../domain/entities/WorkflowInstance';
import { IWorkflowInstanceRepository } from '../../domain/repositories/IWorkflowInstanceRepository';

export class GetPendingApprovalsUseCase {
  private logger = createModuleLogger('GetPendingApprovalsUseCase');

  constructor(private instanceRepository: IWorkflowInstanceRepository) {}

  async execute(userId: string): Promise<WorkflowInstance[]> {
    this.logger.info(`Getting pending approvals for user: ${userId}`);

    const instances = await this.instanceRepository.findPendingApproval(userId);
    this.logger.info(`Found ${instances.length} pending approvals`);

    return instances;
  }
}
