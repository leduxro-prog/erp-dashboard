import { SyncResultDTO } from '../dtos/inventory.dtos';
import { StockSyncError } from '../errors/inventory.errors';
import { v4 as uuidv4 } from 'uuid';

export interface SmartBillSyncService {
  sync(): Promise<{ itemsProcessed: number; itemsUpdated: number; errors: string[] }>;
}

export interface SupplierSyncService {
  sync(): Promise<{ itemsProcessed: number; itemsUpdated: number; errors: string[] }>;
}

export class SyncStock {
  constructor(
    private readonly smartBillService?: SmartBillSyncService,
    private readonly supplierService?: SupplierSyncService
  ) { }

  async syncSmartBill(): Promise<SyncResultDTO> {
    if (!this.smartBillService) {
      throw new StockSyncError(
        'SmartBill',
        'SmartBill sync service is not configured'
      );
    }

    const syncId = uuidv4();
    const startedAt = new Date();

    try {
      const result = await this.smartBillService.sync();

      return {
        syncId,
        status: result.errors.length === 0 ? 'success' : 'partial',
        itemsProcessed: result.itemsProcessed,
        itemsUpdated: result.itemsUpdated,
        errors: result.errors,
        startedAt,
        completedAt: new Date(),
      };
    } catch (error) {
      throw new StockSyncError(
        'SmartBill',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }

  async syncSuppliers(): Promise<SyncResultDTO> {
    if (!this.supplierService) {
      throw new StockSyncError(
        'Supplier',
        'Supplier sync service is not configured'
      );
    }

    const syncId = uuidv4();
    const startedAt = new Date();

    try {
      const result = await this.supplierService.sync();

      return {
        syncId,
        status: result.errors.length === 0 ? 'success' : 'partial',
        itemsProcessed: result.itemsProcessed,
        itemsUpdated: result.itemsUpdated,
        errors: result.errors,
        startedAt,
        completedAt: new Date(),
      };
    } catch (error) {
      throw new StockSyncError(
        'Supplier',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }

  async syncAll(): Promise<{ smartBill: SyncResultDTO; suppliers: SyncResultDTO }> {
    const smartBillResult = await this.syncSmartBill();
    const supplierResult = await this.syncSuppliers();

    return {
      smartBill: smartBillResult,
      suppliers: supplierResult,
    };
  }
}
