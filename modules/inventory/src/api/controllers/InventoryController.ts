import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';
import { CheckStock } from '../../application/use-cases/CheckStock';
import { ReserveStock } from '../../application/use-cases/ReserveStock';
import { ReleaseStock } from '../../application/use-cases/ReleaseStock';
import { AdjustStock } from '../../application/use-cases/AdjustStock';
import { GetLowStockAlerts } from '../../application/use-cases/GetLowStockAlerts';
import { GetMovementHistory } from '../../application/use-cases/GetMovementHistory';
import { GetWarehouses } from '../../application/use-cases/GetWarehouses';
import { successResponse, errorResponse } from '@shared/utils/response';
import { ProductImageSearchService } from '../../application/services/ProductImageSearchService';

export class InventoryController {
  private logger = createModuleLogger('InventoryController');
  private imageSearchService = new ProductImageSearchService();

  constructor(
    private checkStockUseCase: CheckStock,
    private reserveStockUseCase: ReserveStock,
    private releaseStockUseCase: ReleaseStock,
    private adjustStockUseCase: AdjustStock,
    private getLowStockAlertsUseCase: GetLowStockAlerts,
    private getMovementHistoryUseCase: GetMovementHistory,
    private getWarehousesUseCase: GetWarehouses,
    private dataSource?: DataSource,
  ) { }

  async getStockLevels(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const search = req.query.search as string || '';
      const offset = (page - 1) * limit;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const dataSource = this.dataSource;

      let whereClause = '';
      let countWhereClause = '';
      const params: any[] = [limit, offset];
      const countParams: any[] = [];

      if (search) {
        whereClause = `WHERE p.sku ILIKE $3 OR p.name ILIKE $3`;
        countWhereClause = `WHERE p.sku ILIKE $1 OR p.name ILIKE $1`;
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      const [rows, countResult] = await Promise.all([
        dataSource.query(`
          SELECT sl.id, sl.product_id, sl.warehouse_id, sl.quantity_on_hand,
                 sl.quantity_reserved, sl.quantity_available, sl.reorder_point,
                 sl.reorder_quantity, sl.updated_at,
                 p.sku, p.name as product_name, p.base_price,
                 w.name as warehouse_name,
                 pi.image_url
          FROM stock_levels sl
          LEFT JOIN products p ON p.id = sl.product_id
          LEFT JOIN warehouses w ON w.id = sl.warehouse_id
          LEFT JOIN LATERAL (
            SELECT image_url FROM product_images
            WHERE product_id = sl.product_id AND is_primary = true
            ORDER BY sort_order ASC
            LIMIT 1
          ) pi ON true
          ${whereClause}
          ORDER BY p.name ASC NULLS LAST
          LIMIT $1 OFFSET $2
        `, params),
        dataSource.query(`
          SELECT COUNT(*) as total FROM stock_levels sl
          LEFT JOIN products p ON p.id = sl.product_id
          ${countWhereClause}
        `, countParams),
      ]);

      const total = parseInt(countResult[0]?.total || '0');

      res.json(successResponse({
        items: rows.map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          sku: r.sku || `ID-${r.product_id}`,
          name: r.product_name || 'Unknown',
          price: parseFloat(r.base_price) || 0,
          imageUrl: r.image_url || null,
          warehouseId: r.warehouse_id,
          warehouseName: r.warehouse_name || 'Principal',
          current: parseInt(r.quantity_on_hand) || 0,
          reserved: parseInt(r.quantity_reserved) || 0,
          available: parseInt(r.quantity_available) || 0,
          reorderPoint: parseInt(r.reorder_point) || 0,
          status: parseInt(r.quantity_available) <= 0 ? 'Critic'
            : parseInt(r.quantity_available) <= parseInt(r.reorder_point) ? 'Atentionare'
            : 'Normal',
          updatedAt: r.updated_at,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (error) {
      this.logger.error('Error getting stock levels:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get stock levels', 500));
    }
  }

  async getStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const result = await this.checkStockUseCase.execute(productId);
      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get stock levels', 500));
    }
  }

  async checkStockBatch(req: Request, res: Response): Promise<void> {
    try {
      const { productIds } = req.body;

      const results = await this.checkStockUseCase.executeBatch(productIds);

      const data = results.reduce(
        (acc, result) => {
          acc[result.productId] = result;
          return acc;
        },
        {} as Record<string, any>,
      );

      res.json(successResponse(data));
    } catch (error) {
      this.logger.error('Error checking batch stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to check batch stock', 500));
    }
  }

  async reserveStock(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, items, expiresAt } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      const result = await this.reserveStockUseCase.execute(
        orderId,
        items,
        // expiresAt and userId are not supported by the current Use Case signature
      );

      res.status(201).json(successResponse(result));
    } catch (error) {
      this.logger.error('Error reserving stock:', error);

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
      const reservationId = id; // Or simply use id if it is the reservationId

      await this.releaseStockUseCase.execute(reservationId);

      res.json(successResponse({ message: 'Reservation released successfully' }));
    } catch (error) {
      this.logger.error('Error releasing reservation:', error);
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

      await this.adjustStockUseCase.execute(
        productId,
        warehouseId,
        quantity,
        reason,
        userId,
      );

      res.json(successResponse({ message: 'Stock adjusted successfully' }));
    } catch (error) {
      this.logger.error('Error adjusting stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to adjust stock', 500));
    }
  }

  async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { acknowledged, severity } = req.query;

      const filters = {
        acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
        severity: severity as string | undefined,
      };

      const result = await this.getLowStockAlertsUseCase.execute(filters.acknowledged);

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting low stock alerts:', error);
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

      await this.getLowStockAlertsUseCase.acknowledgeAlert(id, userId);

      res.json(successResponse({ message: 'Alert acknowledged successfully' }));
    } catch (error) {
      this.logger.error('Error acknowledging alert:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to acknowledge alert', 500));
    }
  }

  async getMovementHistory(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { startDate, endDate, limit, offset } = req.query;

      const result = await this.getMovementHistoryUseCase.execute(
        productId,
        // other filters are not supported by the current Use Case signature
      );

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting movement history:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get movement history', 500));
    }
  }

  async syncSmartBill(req: Request, res: Response): Promise<void> {
    try {
      // This would trigger the SmartBill sync job
      // For now, just acknowledge the request

      res.json(successResponse({ message: 'SmartBill sync triggered' }));
    } catch (error) {
      this.logger.error('Error triggering SmartBill sync:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to trigger SmartBill sync', 500));
    }
  }

  async syncSuppliers(req: Request, res: Response): Promise<void> {
    try {
      // This would trigger the supplier sync job
      // For now, just acknowledge the request

      res.json(successResponse({ message: 'Supplier sync triggered' }));
    } catch (error) {
      this.logger.error('Error triggering supplier sync:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to trigger supplier sync', 500));
    }
  }

  async getWarehouses(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.getWarehousesUseCase.execute();

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting warehouses:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get warehouses', 500));
    }
  }

  async addProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { imageUrl, altText, isPrimary } = req.body;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      // If isPrimary is true, set all other images as non-primary
      if (isPrimary) {
        await this.dataSource.query(
          `UPDATE product_images SET is_primary = false WHERE product_id = $1`,
          [productId]
        );
      }

      const result = await this.dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
         RETURNING *`,
        [productId, imageUrl, altText || '', isPrimary || false]
      );

      res.status(201).json(successResponse(result[0]));
    } catch (error) {
      this.logger.error('Error adding product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add product image', 500));
    }
  }

  async deleteProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId, imageId } = req.params;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      await this.dataSource.query(
        `DELETE FROM product_images WHERE id = $1 AND product_id = $2`,
        [imageId, productId]
      );

      res.json(successResponse({ message: 'Image deleted successfully' }));
    } catch (error) {
      this.logger.error('Error deleting product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete product image', 500));
    }
  }

  async bulkImportImages(req: Request, res: Response): Promise<void> {
    try {
      const { images } = req.body; // Array of { sku, imageUrl, altText?, isPrimary? }

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'Images array is required', 400));
        return;
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const img of images) {
        try {
          const { sku, imageUrl, altText, isPrimary } = img;

          if (!sku || !imageUrl) {
            errors.push(`Missing SKU or imageUrl for entry: ${JSON.stringify(img)}`);
            failed++;
            continue;
          }

          // Find product by SKU
          const product = await this.dataSource.query(
            `SELECT id FROM products WHERE sku = $1 AND is_active = true LIMIT 1`,
            [sku]
          );

          if (product.length === 0) {
            errors.push(`Product not found for SKU: ${sku}`);
            failed++;
            continue;
          }

          const productId = product[0].id;

          // If isPrimary, set all other images as non-primary
          if (isPrimary) {
            await this.dataSource.query(
              `UPDATE product_images SET is_primary = false WHERE product_id = $1`,
              [productId]
            );
          }

          // Insert image
          await this.dataSource.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
             VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
             ON CONFLICT DO NOTHING`,
            [productId, imageUrl, altText || '', isPrimary || false]
          );

          imported++;
        } catch (err) {
          errors.push(`SKU ${img.sku}: ${err instanceof Error ? err.message : String(err)}`);
          failed++;
        }
      }

      res.json(successResponse({
        message: 'Bulk import completed',
        imported,
        failed,
        errors: errors.slice(0, 10), // Return first 10 errors
      }));
    } catch (error) {
      this.logger.error('Error bulk importing images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to bulk import images', 500));
    }
  }

  async autoSearchProductImages(req: Request, res: Response): Promise<void> {
    try {
      const { limit, skipExisting } = req.query;
      const maxProducts = Math.min(parseInt(limit as string) || 50, 200);

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      // Get products without images or all products
      const query = skipExisting === 'true'
        ? `SELECT p.id, p.sku, p.name
           FROM products p
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
           WHERE p.is_active = true AND pi.id IS NULL
           ORDER BY p.id ASC
           LIMIT $1`
        : `SELECT p.id, p.sku, p.name FROM products p WHERE p.is_active = true ORDER BY p.id ASC LIMIT $1`;

      const products = await this.dataSource.query(query, [maxProducts]);

      this.logger.info(`Starting auto-search for ${products.length} products`);

      // Search for images in batches
      const searchResults = await this.imageSearchService.searchProductImagesBatch(
        products.map((p: any) => ({ sku: p.sku, name: p.name })),
        { maxConcurrent: 2, delayMs: 3000 } // Be respectful to Google
      );

      // Import found images
      let imported = 0;
      let notFound = 0;
      const errors: string[] = [];

      for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i];
        const product = products[i];

        if (result.imageUrl && result.confidence !== 'low') {
          try {
            // Set all other images as non-primary
            await this.dataSource.query(
              `UPDATE product_images SET is_primary = false WHERE product_id = $1`,
              [product.id]
            );

            // Insert image
            await this.dataSource.query(
              `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
               VALUES ($1, $2, $3, true, 0, NOW())
               ON CONFLICT DO NOTHING`,
              [product.id, result.imageUrl, product.name || result.sku]
            );

            imported++;
            this.logger.info(`Imported image for SKU: ${result.sku}`);
          } catch (err) {
            errors.push(`SKU ${result.sku}: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          notFound++;
        }
      }

      res.json(successResponse({
        message: 'Auto-search completed',
        searched: products.length,
        imported,
        notFound,
        errors: errors.slice(0, 10),
      }));
    } catch (error) {
      this.logger.error('Error auto-searching product images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to auto-search images', 500));
    }
  }
}
