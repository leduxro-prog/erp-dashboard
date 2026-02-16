import { IInventoryRepository, LowStockAlert } from '../../domain/ports/IInventoryRepository';

export class GetLowStockAlerts {
  constructor(private readonly repository: IInventoryRepository) { }

  async execute(acknowledged?: boolean): Promise<LowStockAlert[]> {
    const repository = this.repository as IInventoryRepository & {
      getAlerts?: (acknowledged?: boolean) => Promise<LowStockAlert[]>;
    };

    if (typeof repository.getLowStockAlerts === 'function') {
      return repository.getLowStockAlerts({ acknowledged });
    }

    if (typeof repository.getAlerts === 'function') {
      return repository.getAlerts(acknowledged);
    }

    throw new Error('Inventory repository does not support low stock alert retrieval');
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    if (!alertId || alertId.trim().length === 0) {
      throw new Error('Alert id is required');
    }

    if (!userId || userId.trim().length === 0) {
      throw new Error('User id is required');
    }

    await this.repository.acknowledgeAlert(alertId, userId);
  }
}
