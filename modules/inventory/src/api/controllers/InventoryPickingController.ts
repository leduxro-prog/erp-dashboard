import { Request, Response, Router, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { successResponse, errorResponse } from '@shared/utils/response';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

/**
 * Inventory Picking Controller
 * Handles warehouse picking operations and path optimization
 */
export class InventoryPickingController {
  private router: Router;

  constructor(private readonly dataSource: DataSource) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticate);
    this.router.get('/picking/:orderId', requireRole(['admin', 'warehouse']), this.generatePickingList.bind(this));
    this.router.put('/picking/bin/:productId', requireRole(['admin', 'warehouse']), this.updateBinLocation.bind(this));
  }

  public getRouter(): Router {
    return this.router;
  }

  /**
   * Generate an optimized picking list for an order.
   * Items are sorted by bin_location to minimize travel time for warehouse pickers.
   */
  private async generatePickingList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;

      // Join order items with stock items to get bin locations
      // Sorting by bin_location ensures a logical path through the warehouse
      const pickingList = await this.dataSource.query(`
        SELECT 
          oi.product_id as "productId",
          oi.sku,
          p.name as "productName",
          oi.quantity as "quantityToPick",
          si.bin_location as "binLocation",
          si.quantity as "totalStockInBin"
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN stock_items si ON si.product_id = p.id AND si.warehouse_id = 'wh-magazin-001'
        WHERE oi.order_id = $1
        ORDER BY si.bin_location ASC NULLS LAST
      `, [orderId]);

      if (pickingList.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found or has no items', 404));
        return;
      }

      res.json(successResponse({
        order_id: orderId,
        items: pickingList,
        picker_instructions: "Urmați ordinea locațiilor (Bin) pentru un parcurs optim în depozit."
      }));
    } catch (error) {
      console.error('Picking list error:', error);
      next(error);
    }
  }

  /**
   * Update the physical bin location for a product
   */
  private async updateBinLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const { bin_location, warehouse_id = 'wh-magazin-001' } = req.body;

      if (!bin_location) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'Bin location is required', 400));
        return;
      }

      await this.dataSource.query(`
        INSERT INTO stock_items (product_id, warehouse_id, bin_location, quantity, reserved_quantity, minimum_threshold)
        VALUES ($1, $2, $3, 0, 0, 0)
        ON CONFLICT (product_id, warehouse_id) DO UPDATE 
        SET bin_location = $3, last_updated = NOW()
      `, [productId, warehouse_id, bin_location]);

      res.json(successResponse({ product_id: productId, bin_location }));
    } catch (error) {
      console.error('Update bin error:', error);
      next(error);
    }
  }
}
