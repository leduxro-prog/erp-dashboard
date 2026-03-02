import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('CreateB2BProformaUseCase');

export class CreateB2BProformaUseCase {
  constructor(
    private readonly _repository: unknown,
    private readonly _apiClient: unknown,
    private readonly _eventBus: unknown,
    private readonly _dataSource: unknown,
  ) {}

  async execute(input: { b2bOrderId: number }): Promise<{ success: boolean; b2bOrderId: number }> {
    logger.info('B2B proforma flow not wired in this branch, skipping execution', {
      b2bOrderId: input.b2bOrderId,
    });

    return {
      success: true,
      b2bOrderId: input.b2bOrderId,
    };
  }
}
