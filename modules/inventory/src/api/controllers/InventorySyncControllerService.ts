import { Request, Response } from 'express';

import { errorResponse, successResponse } from '@shared/utils/response';

interface InventorySyncLogger {
  error: (...args: any[]) => void;
}

interface InventorySyncControllerDependencies {
  logger: InventorySyncLogger;
}

export class InventorySyncControllerService {
  constructor(private readonly deps: InventorySyncControllerDependencies) {}

  async syncSmartBill(_req: Request, res: Response): Promise<void> {
    try {
      res.json(successResponse({ message: 'SmartBill sync triggered' }));
    } catch (error) {
      this.deps.logger.error('Error triggering SmartBill sync:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to trigger SmartBill sync', 500));
    }
  }

  async syncSuppliers(_req: Request, res: Response): Promise<void> {
    try {
      res.json(successResponse({ message: 'Supplier sync triggered' }));
    } catch (error) {
      this.deps.logger.error('Error triggering supplier sync:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to trigger supplier sync', 500));
    }
  }
}
