import { createModuleLogger } from '@shared/utils/logger';
import { WorkflowInstance } from '../../domain/entities/WorkflowInstance';
import { IWorkflowInstanceRepository } from '../../domain/repositories/IWorkflowInstanceRepository';
import { InstanceNotFoundError } from '../errors/WorkflowError';

export class GetInstanceUseCase {
  private logger = createModuleLogger('GetInstanceUseCase');

  constructor(private instanceRepository: IWorkflowInstanceRepository) {}

  async execute(instanceId: string): Promise<WorkflowInstance> {
    this.logger.info(`Getting workflow instance: ${instanceId}`);

    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) {
      throw new InstanceNotFoundError(instanceId);
    }

    return instance;
  }
}
