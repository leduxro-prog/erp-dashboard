import { Request, Response } from 'express';
import {
  ScrapeSupplierStock,
  MapSku,
  PlaceSupplierOrder,
  GetSupplierProducts,
  SupplierNotFoundError,
  ScrapeError,
  SkuMappingError,
  InvalidOrderError,
} from '../../application';
import { ISupplierRepository } from '../../application/ports/ISupplierRepository';
import { ScraperFactory } from '../../infrastructure/scrapers/ScraperFactory';
import { SupplierSyncJob } from '../../infrastructure/jobs/SupplierSyncJob';
import { successResponse, errorResponse } from '@shared/utils/response';

export class SupplierController {
  constructor(
    private repository: ISupplierRepository,
    private syncJob: SupplierSyncJob,
  ) { }

  // List all suppliers
  async listSuppliers(req: Request, res: Response): Promise<void> {
    try {
      const { activeOnly } = req.query;
      const suppliers = await this.repository.listSuppliers(
        activeOnly === 'true',
      );

      res.status(200).json(successResponse(suppliers, { count: suppliers.length }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Get single supplier
  async getSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const supplier = await this.repository.getSupplier(parseInt(id, 10));

      if (!supplier) {
        res.status(404).json(errorResponse('NOT_FOUND', `Supplier ${id} not found`, 404));
        return;
      }

      res.status(200).json(successResponse(supplier));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Get supplier products
  async getSupplierProducts(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { search, minStock, minPrice, maxPrice, limit, offset } =
        req.query;

      const useCase = new GetSupplierProducts(this.repository);

      const products = await useCase.execute(parseInt(id, 10), {
        search: search as string | undefined,
        minStock: minStock ? parseInt(minStock as string, 10) : undefined,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      res.status(200).json(successResponse(products, { count: products.length }));
    } catch (error) {
      if (error instanceof SupplierNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Get product statistics
  async getProductStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const useCase = new GetSupplierProducts(this.repository);

      const stats = await useCase.getStatistics(parseInt(id, 10));

      res.status(200).json(successResponse(stats));
    } catch (error) {
      if (error instanceof SupplierNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Trigger sync for single supplier
  async triggerSync(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const supplier = await this.repository.getSupplier(parseInt(id, 10));
      if (!supplier) {
        res.status(404).json(errorResponse('NOT_FOUND', `Supplier ${id} not found`, 404));
        return;
      }

      const scraperFactory = new ScraperFactory();
      const useCase = new ScrapeSupplierStock(
        this.repository,
        scraperFactory as any,
      );

      const result = await useCase.execute(parseInt(id, 10));

      res.status(200).json(successResponse(result));
    } catch (error) {
      if (error instanceof SupplierNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
        return;
      }

      if (error instanceof ScrapeError) {
        res.status(400).json(errorResponse('SCRAPE_ERROR', error.message, 400));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Trigger sync all suppliers
  async triggerSyncAll(req: Request, res: Response): Promise<void> {
    try {
      const job = await this.syncJob.triggerSync();

      res.status(202).json(successResponse({ jobId: job.id }, { message: 'Sync job queued' }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // List SKU mappings
  async listSkuMappings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const supplier = await this.repository.getSupplier(parseInt(id, 10));
      if (!supplier) {
        res.status(404).json(errorResponse('NOT_FOUND', `Supplier ${id} not found`, 404));
        return;
      }

      const useCase = new MapSku(this.repository);
      const mappings = await useCase.listMappings(parseInt(id, 10));

      res.status(200).json(successResponse(mappings, { count: mappings.length }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Get unmapped products
  async getUnmappedProducts(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const supplier = await this.repository.getSupplier(parseInt(id, 10));
      if (!supplier) {
        res.status(404).json(errorResponse('NOT_FOUND', `Supplier ${id} not found`, 404));
        return;
      }

      const useCase = new MapSku(this.repository);
      const result = await useCase.getUnmapped(parseInt(id, 10));

      res.status(200).json(successResponse(result));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Create SKU mapping
  async createSkuMapping(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { supplierSku, internalProductId, internalSku } = req.body;

      const useCase = new MapSku(this.repository);
      const mapping = await useCase.create(
        parseInt(id, 10),
        supplierSku,
        internalProductId,
        internalSku,
      );

      res.status(201).json(successResponse(mapping));
    } catch (error) {
      if (error instanceof SkuMappingError) {
        res.status(400).json(errorResponse('SKU_MAPPING_ERROR', error.message, 400));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Delete SKU mapping
  async deleteSkuMapping(req: Request, res: Response): Promise<void> {
    try {
      const { mappingId } = req.params;
      const useCase = new MapSku(this.repository);

      await useCase.deleteMapping(parseInt(mappingId, 10));

      res.status(200).json(successResponse({ message: 'SKU mapping deleted' }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Place supplier order
  async placeOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { items, orderId } = req.body;

      const useCase = new PlaceSupplierOrder(this.repository);
      const result = await useCase.execute(
        parseInt(id, 10),
        items,
        orderId,
      );

      res.status(201).json(successResponse(result));
    } catch (error) {
      if (
        error instanceof InvalidOrderError ||
        error instanceof SupplierNotFoundError
      ) {
        const code = error instanceof InvalidOrderError ? 'INVALID_ORDER' : 'SUPPLIER_NOT_FOUND';
        res.status(400).json(errorResponse(code, error.message, 400));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }

  // Get supplier orders
  async getOrders(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;

      const supplier = await this.repository.getSupplier(parseInt(id, 10));
      if (!supplier) {
        res.status(404).json(errorResponse('NOT_FOUND', `Supplier ${id} not found`, 404));
        return;
      }

      const orders = await this.repository.getSupplierOrders(
        parseInt(id, 10),
        limit ? parseInt(limit as string, 10) : 50,
        offset ? parseInt(offset as string, 10) : 0,
      );

      res.status(200).json(successResponse(orders, { count: orders.length }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500));
    }
  }
}
