import { Request, Response } from 'express';
import { DataSource } from 'typeorm';

import { errorResponse, successResponse } from '@shared/utils/response';

import { GetMovementHistory } from '../../application/use-cases/GetMovementHistory';

interface InventoryMovementLogger {
  error: (...args: any[]) => void;
}

interface InventoryMovementControllerDependencies {
  dataSource?: DataSource;
  getMovementHistoryUseCase: GetMovementHistory;
  logger: InventoryMovementLogger;
}

export class InventoryMovementControllerService {
  constructor(private readonly deps: InventoryMovementControllerDependencies) {}

  async getMovementHistory(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      let resolvedProductId = String(productId || '').trim();

      if (!resolvedProductId) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Product ID or SKU is required', 400));
        return;
      }

      if (this.deps.dataSource && !/^\d+$/.test(resolvedProductId)) {
        const skuMatch = await this.deps.dataSource.query(
          `
            SELECT id
            FROM products
            WHERE LOWER(sku) = LOWER($1)
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [resolvedProductId],
        );

        if (!skuMatch[0]?.id) {
          res.status(404).json(errorResponse('NOT_FOUND', 'Product not found for provided ID/SKU', 404));
          return;
        }

        resolvedProductId = String(skuMatch[0].id);
      }

      const result = await this.deps.getMovementHistoryUseCase.execute(
        resolvedProductId,
        // other filters are not supported by the current Use Case signature
      );

      res.json(successResponse(result));
    } catch (error) {
      this.deps.logger.error('Error getting movement history:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get movement history', 500));
    }
  }
}
