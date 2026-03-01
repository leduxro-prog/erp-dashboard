import { Request, Response } from 'express';
import { DataSource } from 'typeorm';

import { InventoryProductProjectionService } from '@shared/read-model/InventoryProductProjectionService';
import { errorResponse, successResponse } from '@shared/utils/response';

interface InventoryProjectionLogger {
  error: (...args: any[]) => void;
}

interface InventoryProjectionAdminControllerDependencies {
  dataSource?: DataSource;
  logger: InventoryProjectionLogger;
}

export class InventoryProjectionAdminControllerService {
  constructor(private readonly deps: InventoryProjectionAdminControllerDependencies) {}

  async refreshProjection(req: Request, res: Response): Promise<void> {
    try {
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const projectionService = new InventoryProductProjectionService(dataSource);
      await projectionService.ensureSchema();

      const body = req.body as { productIds?: unknown; mode?: string };
      const productIds = Array.isArray(body?.productIds)
        ? body.productIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];

      const mode = String(body?.mode || 'queue').toLowerCase();

      if (productIds.length > 0) {
        if (mode === 'sync') {
          await projectionService.refreshByProductIds(productIds);
          res.json(
            successResponse({
              message: 'Projection refresh completed',
              mode: 'sync',
              productCount: productIds.length,
            }),
          );
          return;
        }

        await projectionService.scheduleRefreshByProductIds(productIds, 'inventory.manual');
        res.json(
          successResponse({
            message: 'Projection refresh queued',
            mode: 'queue',
            productCount: productIds.length,
          }),
        );
        return;
      }

      await projectionService.refreshAll();
      res.json(successResponse({ message: 'Projection full rebuild completed', mode: 'sync' }));
    } catch (error) {
      this.deps.logger.error('Error refreshing inventory projection:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to refresh projection', 500));
    }
  }

  async getProjectionStatus(req: Request, res: Response): Promise<void> {
    try {
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const staleThresholdSeconds = Math.max(
        Number.parseInt(String(req.query.staleThresholdSeconds || '300'), 10) || 300,
        30,
      );

      const projectionService = new InventoryProductProjectionService(dataSource);
      const [projection, queue] = await Promise.all([
        projectionService.getProjectionStats(staleThresholdSeconds),
        projectionService.getQueueStats(),
      ]);

      res.json(
        successResponse({
          staleThresholdSeconds,
          projection,
          queue,
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error reading projection status:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to read projection status', 500));
    }
  }

  async processProjectionQueue(req: Request, res: Response): Promise<void> {
    try {
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const batchSize = Math.max(Number.parseInt(String(req.body?.batchSize || '20'), 10) || 20, 1);
      const maxAttempts = Math.max(
        Number.parseInt(String(req.body?.maxAttempts || '6'), 10) || 6,
        1,
      );

      const projectionService = new InventoryProductProjectionService(dataSource);
      const result = await projectionService.processRefreshQueue(batchSize, maxAttempts);
      const queue = await projectionService.getQueueStats();

      res.json(
        successResponse({
          message: 'Projection queue processed',
          picked: result.picked,
          processed: result.processed,
          retried: result.retried,
          failed: result.failed,
          recoveredStale: result.recoveredStale,
          durationMs: result.durationMs,
          queue,
          batchSize,
          maxAttempts,
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error processing projection queue:', error);
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to process projection queue', 500));
    }
  }

  async requeueFailedProjectionJobs(req: Request, res: Response): Promise<void> {
    try {
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const limit = Math.max(Number.parseInt(String(req.body?.limit || '500'), 10) || 500, 1);
      const projectionService = new InventoryProductProjectionService(dataSource);
      const requeued = await projectionService.requeueFailedJobs(limit);

      res.json(
        successResponse({
          message: 'Failed projection jobs requeued',
          requeued,
          limit,
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error requeueing failed projection jobs:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to requeue projection jobs', 500));
    }
  }

  private requireDataSource(res: Response): DataSource | null {
    if (!this.deps.dataSource) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
      return null;
    }

    return this.deps.dataSource;
  }
}
