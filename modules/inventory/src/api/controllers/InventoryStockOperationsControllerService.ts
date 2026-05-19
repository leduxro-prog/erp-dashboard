import { Request, Response } from 'express';

import { errorResponse, successResponse } from '@shared/utils/response';

import { AdjustStock } from '../../application/use-cases/AdjustStock';
import { CheckStock } from '../../application/use-cases/CheckStock';
import { GetLowStockAlerts } from '../../application/use-cases/GetLowStockAlerts';
import { ReleaseStock } from '../../application/use-cases/ReleaseStock';
import { ReserveStock } from '../../application/use-cases/ReserveStock';

interface InventoryStockOpsLogger {
  error: (...args: any[]) => void;
}

interface InventoryStockOperationsControllerDependencies {
  checkStockUseCase: CheckStock;
  reserveStockUseCase: ReserveStock;
  releaseStockUseCase: ReleaseStock;
  adjustStockUseCase: AdjustStock;
  getLowStockAlertsUseCase: GetLowStockAlerts;
  logger: InventoryStockOpsLogger;
}

export class InventoryStockOperationsControllerService {
  constructor(private readonly deps: InventoryStockOperationsControllerDependencies) {}

  async getStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const result = await this.deps.checkStockUseCase.execute(productId);
      res.json(successResponse(result));
    } catch (error) {
      this.deps.logger.error('Error getting stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get stock levels', 500));
    }
  }

  async checkStockBatch(req: Request, res: Response): Promise<void> {
    try {
      const { productIds } = req.body;
      const results = await this.deps.checkStockUseCase.executeBatch(productIds);

      const data = results.reduce(
        (acc, result) => {
          acc[result.productId] = result;
          return acc;
        },
        {} as Record<string, any>,
      );

      res.json(successResponse(data));
    } catch (error) {
      this.deps.logger.error('Error checking batch stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to check batch stock', 500));
    }
  }

  async reserveStock(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, items } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      const result = await this.deps.reserveStockUseCase.execute(
        orderId,
        items,
        // expiresAt and userId are not supported by the current Use Case signature
      );

      res.status(201).json(successResponse(result));
    } catch (error) {
      this.deps.logger.error('Error reserving stock:', error);

      if (error instanceof Error && error.message.includes('Insufficient')) {
        res.status(400).json(errorResponse('INSUFFICIENT_STOCK', error.message, 400));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to reserve stock', 500));
    }
  }

  async releaseReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const reservationId = id;

      await this.deps.releaseStockUseCase.execute(reservationId);
      res.json(successResponse({ message: 'Reservation released successfully' }));
    } catch (error) {
      this.deps.logger.error('Error releasing reservation:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to release reservation', 500));
    }
  }

  async adjustStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId, warehouseId, quantity, reason } = req.body;
      const userId = req.user?.id as string;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      await this.deps.adjustStockUseCase.execute(productId, warehouseId, quantity, reason, userId);
      res.json(successResponse({ message: 'Stock adjusted successfully' }));
    } catch (error) {
      this.deps.logger.error('Error adjusting stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to adjust stock', 500));
    }
  }

  async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { acknowledged } = req.query;

      const filters = {
        acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      };

      const result = await this.deps.getLowStockAlertsUseCase.execute(filters.acknowledged);
      res.json(successResponse(result));
    } catch (error) {
      this.deps.logger.error('Error getting low stock alerts:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get low stock alerts', 500));
    }
  }

  async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id as string;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      await this.deps.getLowStockAlertsUseCase.acknowledgeAlert(id, userId);
      res.json(successResponse({ message: 'Alert acknowledged successfully' }));
    } catch (error) {
      this.deps.logger.error('Error acknowledging alert:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to acknowledge alert', 500));
    }
  }
}
