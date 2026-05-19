import { Request, Response } from 'express';

type ImageSearchJobRunner = {
  enqueueFullReindex(jobKey: string): Promise<void>;
  enqueueProductReindex(jobKey: string, productId: number): Promise<void>;
};

type ImageSearchAuditRepository = {
  createRun(input: { id: string }): Promise<{ id: string }>;
};

type ImageSearchHealthProvider = {
  getHealth(): Promise<unknown>;
};

export class ImageSearchAdminController {
  constructor(
    private readonly jobRunner: ImageSearchJobRunner,
    private readonly auditRepository: ImageSearchAuditRepository,
    private readonly healthProvider: ImageSearchHealthProvider,
  ) {}

  async health(_req: Request, res: Response): Promise<void> {
    const dependencies = await this.healthProvider.getHealth();

    res.status(200).json({
      status: 'disabled',
      reason: 'image_search_indexing_not_configured',
      dependencies,
    });
  }

  async reindexAll(_req: Request, res: Response): Promise<void> {
    const run = await this.auditRepository.createRun({ id: `image-search-${Date.now()}` });

    try {
      await this.jobRunner.enqueueFullReindex(run.id);
      res.status(202).json({ status: 'queued', runId: run.id });
    } catch (error) {
      res.status(503).json({
        status: 'not_configured',
        reason: error instanceof Error ? error.message : 'Image search queue is unavailable',
        runId: run.id,
      });
    }
  }

  async reindexProduct(req: Request, res: Response): Promise<void> {
    const productId = Number(req.params['productId']);

    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({ status: 'invalid_request', reason: 'productId must be a positive integer' });
      return;
    }

    const run = await this.auditRepository.createRun({ id: `image-search-product-${productId}-${Date.now()}` });

    try {
      await this.jobRunner.enqueueProductReindex(run.id, productId);
      res.status(202).json({ status: 'queued', productId, runId: run.id });
    } catch (error) {
      res.status(503).json({
        status: 'not_configured',
        reason: error instanceof Error ? error.message : 'Image search queue is unavailable',
        productId,
        runId: run.id,
      });
    }
  }
}
