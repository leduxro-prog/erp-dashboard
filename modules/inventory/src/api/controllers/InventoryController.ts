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

  private normalizeCatalogCategory(
    rawCategory: string | null,
    productName: string,
    sku: string,
  ): string {
    const text = `${rawCategory || ''} ${productName || ''} ${sku || ''}`.toLowerCase();

    if (
      text.includes('cctv') ||
      text.includes('camera') ||
      text.includes('kamery') ||
      text.includes('nvr') ||
      text.includes('xvr')
    ) {
      return 'Securitate CCTV';
    }

    if (
      text.includes('pv') ||
      text.includes('fotovolta') ||
      text.includes('solar') ||
      text.includes('inverter') ||
      text.includes('falown')
    ) {
      return 'Fotovoltaice';
    }

    if (text.includes('profil') || text.includes('profile') || text.includes('alulicht')) {
      return 'Profile LED';
    }

    if (
      text.includes('benzi') ||
      text.includes('banda') ||
      text.includes('strip') ||
      text.includes('neon') ||
      text.includes('cob')
    ) {
      return 'Benzi LED';
    }

    if (
      text.includes('sursa') ||
      text.includes('alimentator') ||
      text.includes('driver') ||
      text.includes('power supply') ||
      text.includes('adin') ||
      text.includes('adws') ||
      text.includes('gpv') ||
      text.includes('din') ||
      text.includes('cliq')
    ) {
      return 'Surse si Drivere';
    }

    if (
      text.includes('bec') ||
      text.includes('bulb') ||
      text.includes('tub') ||
      text.includes('t8') ||
      text.includes('t5') ||
      text.includes('e27') ||
      text.includes('e14') ||
      text.includes('gu10')
    ) {
      return 'Becuri si Tuburi LED';
    }

    if (
      text.includes('spot') ||
      text.includes('downlight') ||
      text.includes('panel') ||
      text.includes('panou') ||
      text.includes('lustra') ||
      text.includes('pendul') ||
      text.includes('aplica') ||
      text.includes('plafon') ||
      text.includes('track') ||
      text.includes('azzardo')
    ) {
      return 'Iluminat Interior';
    }

    if (
      text.includes('proiector') ||
      text.includes('flood') ||
      text.includes('exterior') ||
      text.includes('outdoor') ||
      text.includes('stradal') ||
      text.includes('ip65') ||
      text.includes('ip66') ||
      text.includes('ip67')
    ) {
      return 'Iluminat Exterior';
    }

    if (text.includes('industrial') || text.includes('highbay') || text.includes('depozit')) {
      return 'Iluminat Industrial';
    }

    if (
      text.includes('cablu') ||
      text.includes('kable') ||
      text.includes('priza') ||
      text.includes('intrerup') ||
      text.includes('electr')
    ) {
      return 'Materiale Electrice';
    }

    if (
      text.includes('automat') ||
      text.includes('smart') ||
      text.includes('zigbee') ||
      text.includes('sensor') ||
      text.includes('senzor')
    ) {
      return 'Automatizari si Smart';
    }

    if (text.includes('akcesoria') || text.includes('accesor')) {
      return 'Accesorii Iluminat';
    }

    return 'Diverse';
  }

  private normalizeCatalogSubcategory(rawCategory: string | null, rootCategory: string): string {
    const raw = String(rawCategory || '').trim();
    if (!raw) {
      return '';
    }

    const lower = raw.toLowerCase();
    const rootLower = String(rootCategory || '')
      .trim()
      .toLowerCase();

    if (!lower || (rootLower && lower === rootLower)) {
      return '';
    }

    if (
      lower === 'general' ||
      lower === 'diverse' ||
      lower === 'misc' ||
      lower === 'other' ||
      lower === 'inne' ||
      lower === 'pozostale' ||
      lower === 'pozostale produkty' ||
      lower === 'product categories' ||
      lower === 'oswietlenie' ||
      lower === 'inne zrodla swiatla' ||
      lower === 'akcesoria i osprzet' ||
      lower === 'sterowanie roletami / zaslonami'
    ) {
      return 'Diverse';
    }

    const hasNonAscii = /[^\x00-\x7F]/.test(raw);
    if (hasNonAscii) {
      return 'Diverse';
    }

    const mappedSubcategories: Record<string, string> = {
      'kable ac': 'Cabluri AC',
      'kable dc': 'Cabluri DC',
      akcesoria: 'Accesorii',
      falowniki: 'Invertoare',
      'inwertery domowe': 'Invertoare rezidentiale',
      czujniki: 'Senzori',
      bramki: 'Gateway',
      'panele dotykowe i stacje meteo': 'Panouri tactile si statii meteo',
      adws: 'ADWS',
      adin: 'ADIN',
      gpv: 'GPV',
      gpvp: 'GPVP',
      cob: 'COB',
      hqs: 'HQS',
      backlight: 'Backlight',
      'mi-light': 'MI-Light',
      alulicht: 'ALULICHT',
      'mw lighting': 'MW LIGHTING',
      'helios profile led': 'Helios profile LED',
      'pos-c / -c2': 'POS-C / -C2',
      'pos adapter/desktop': 'POS Adapter/Desktop',
      'sunny adapter': 'Sunny Adapter',
      'led neon': 'LED Neon',
      azzardo: 'Azzardo',
      'panouri led': 'Panouri LED',
      'downlight-uri': 'Downlight-uri',
      'spoturi led': 'Spoturi LED',
      'becuri led': 'Becuri LED',
      'tuburi led': 'Tuburi LED',
      'proiectoare led': 'Proiectoare LED',
      'hale & depozite': 'Hale & Depozite',
    };

    const mappedSubcategory = mappedSubcategories[lower];
    if (mappedSubcategory) {
      return mappedSubcategory;
    }

    if (lower.startsWith('kamery ')) {
      return raw.replace(/^kamery/i, 'Camere');
    }

    if (lower.startsWith('rejestratory ')) {
      return raw.replace(/^rejestratory/i, 'Inregistratoare');
    }

    if (lower.startsWith('inwertery ')) {
      return raw.replace(/^inwertery/i, 'Invertoare');
    }

    return 'Diverse';
  }

  constructor(
    private checkStockUseCase: CheckStock,
    private reserveStockUseCase: ReserveStock,
    private releaseStockUseCase: ReleaseStock,
    private adjustStockUseCase: AdjustStock,
    private getLowStockAlertsUseCase: GetLowStockAlerts,
    private getMovementHistoryUseCase: GetMovementHistory,
    private getWarehousesUseCase: GetWarehouses,
    private dataSource?: DataSource,
  ) {}

  async getStockLevels(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const search = (req.query.search as string) || '';
      const offset = (page - 1) * limit;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const dataSource = this.dataSource;

      let whereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
      let countWhereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
      const params: any[] = [limit, offset];
      const countParams: any[] = [];

      if (search) {
        whereClause += ` AND (p.sku ILIKE $3 OR p.name ILIKE $3)`;
        countWhereClause += ` AND (p.sku ILIKE $1 OR p.name ILIKE $1)`;
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      const [rows, countResult] = await Promise.all([
        dataSource.query(
          `
          SELECT p.id AS product_id,
                 ls.warehouse_id,
                 COALESCE(ls.quantity_on_hand, 0) AS quantity_on_hand,
                 COALESCE(ls.quantity_reserved, 0) AS quantity_reserved,
                 COALESCE(ls.quantity_available, 0) AS quantity_available,
                 COALESCE(ls.reorder_point, 0) AS reorder_point,
                 COALESCE(ls.reorder_quantity, 0) AS reorder_quantity,
                 ls.updated_at,
                  COALESCE(ssc.supplier_stock, 0) AS supplier_stock,
                  COALESCE(ssc.supplier_lead_time, 0) AS supplier_lead_time,
                   p.sku, p.name as product_name, p.base_price, p.category_id,
                   c.name AS category_name,
                   w.name as warehouse_name,
                   pi.image_url
          FROM products p
          LEFT JOIN LATERAL (
            SELECT
              MIN(sl.warehouse_id) AS warehouse_id,
              SUM(sl.quantity_on_hand) AS quantity_on_hand,
              SUM(sl.quantity_reserved) AS quantity_reserved,
              SUM(sl.quantity_available) AS quantity_available,
              MAX(sl.reorder_point) AS reorder_point,
              MAX(sl.reorder_quantity) AS reorder_quantity,
              MAX(sl.updated_at) AS updated_at
            FROM stock_levels sl
            JOIN warehouses sw ON sw.id = sl.warehouse_id
            WHERE sl.product_id = p.id
              AND sw.is_active = true
              AND (sw.code ILIKE 'SB-%' OR sw.name ILIKE 'magazin')
          ) ls ON true
          LEFT JOIN warehouses w ON w.id = ls.warehouse_id
          LEFT JOIN categories c ON c.id = p.category_id
          LEFT JOIN LATERAL (
            SELECT
              SUM(sc.quantity_available) AS supplier_stock,
              MIN(sc.lead_time_days) AS supplier_lead_time
            FROM supplier_stock_cache sc
            WHERE sc.product_id = p.id AND sc.is_available = true
          ) ssc ON true
          LEFT JOIN LATERAL (
            SELECT image_url FROM product_images
            WHERE product_id = p.id AND is_primary = true
            ORDER BY sort_order ASC
            LIMIT 1
          ) pi ON true
          ${whereClause}
          ORDER BY p.name ASC NULLS LAST
          LIMIT $1 OFFSET $2
        `,
          params,
        ),
        dataSource.query(
          `
          SELECT COUNT(*) as total FROM products p
          ${countWhereClause}
        `,
          countParams,
        ),
      ]);

      const total = parseInt(countResult[0]?.total || '0');

      res.json(
        successResponse({
          items: rows.map((r: any) => {
            const localAvailable = parseInt(r.quantity_available) || 0;
            const supplierStock = parseInt(r.supplier_stock) || 0;
            const totalStock = localAvailable + supplierStock;
            const reorderPoint = parseInt(r.reorder_point) || 0;
            const categoryName = this.normalizeCatalogCategory(
              r.category_name,
              r.product_name,
              r.sku,
            );
            const subcategoryName = this.normalizeCatalogSubcategory(r.category_name, categoryName);

            return {
              id: r.product_id,
              productId: r.product_id,
              sku: r.sku || `ID-${r.product_id}`,
              name: r.product_name || 'Unknown',
              categoryId: r.category_id ? Number(r.category_id) : null,
              categoryName,
              subcategoryName: subcategoryName || null,
              price: parseFloat(r.base_price) || 0,
              imageUrl: r.image_url || null,
              warehouseId: r.warehouse_id || 1,
              warehouseName: r.warehouse_name || 'Principal',
              current: parseInt(r.quantity_on_hand) || 0,
              reserved: parseInt(r.quantity_reserved) || 0,
              available: localAvailable,
              localStock: localAvailable,
              supplierStock,
              supplierLeadTime: parseInt(r.supplier_lead_time) || 0,
              totalStock,
              reorderPoint,
              status:
                totalStock <= 0 ? 'Critic' : totalStock <= reorderPoint ? 'Atentionare' : 'Normal',
              updatedAt: r.updated_at,
            };
          }),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }),
      );
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

      await this.adjustStockUseCase.execute(productId, warehouseId, quantity, reason, userId);

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
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to trigger SmartBill sync', 500));
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
      if (this.dataSource) {
        const result = await this.dataSource.query(
          `SELECT id::text AS id, name, address, is_active AS "isActive"
           FROM warehouses
           WHERE is_active = true
           ORDER BY name ASC`,
        );

        res.json(successResponse(result));
        return;
      }

      const fallback = await this.getWarehousesUseCase.execute();
      res.json(successResponse(fallback));
    } catch (error) {
      this.logger.error('Error getting warehouses:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get warehouses', 500));
    }
  }

  async createWarehouse(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const { name, address } = req.body as { name?: string; address?: string };

      if (!name || !name.trim()) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'Warehouse name is required', 400));
        return;
      }

      const codeBase =
        name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 20) || 'WH';
      const code = `${codeBase}-${Date.now().toString().slice(-4)}`;

      const inserted = await this.dataSource.query(
        `INSERT INTO warehouses (name, code, address, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id::text AS id, name, address, is_active AS "isActive"`,
        [name.trim(), code, (address || '').trim()],
      );

      res.status(201).json(successResponse(inserted[0]));
    } catch (error) {
      this.logger.error('Error creating warehouse:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create warehouse', 500));
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
          [productId],
        );
      }

      const result = await this.dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
         RETURNING *`,
        [productId, imageUrl, altText || '', isPrimary || false],
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

      await this.dataSource.query(`DELETE FROM product_images WHERE id = $1 AND product_id = $2`, [
        imageId,
        productId,
      ]);

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
            [sku],
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
              [productId],
            );
          }

          // Insert image
          await this.dataSource.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
             VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
             ON CONFLICT DO NOTHING`,
            [productId, imageUrl, altText || '', isPrimary || false],
          );

          imported++;
        } catch (err) {
          errors.push(`SKU ${img.sku}: ${err instanceof Error ? err.message : String(err)}`);
          failed++;
        }
      }

      res.json(
        successResponse({
          message: 'Bulk import completed',
          imported,
          failed,
          errors: errors.slice(0, 10), // Return first 10 errors
        }),
      );
    } catch (error) {
      this.logger.error('Error bulk importing images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to bulk import images', 500));
    }
  }

  async autoSearchProductImages(req: Request, res: Response): Promise<void> {
    try {
      const { limit, skipExisting } = req.query;
      const { productIds } = req.body || {};
      const maxProducts = Math.min(parseInt(limit as string) || 50, 200);

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      let products: any[];

      if (Array.isArray(productIds) && productIds.length > 0) {
        // Search images only for specific product IDs
        const ids = productIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        if (ids.length === 0) {
          res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid product IDs', 400));
          return;
        }
        const placeholders = ids.map((_: number, i: number) => `$${i + 1}`).join(',');
        const query =
          skipExisting === 'true'
            ? `SELECT p.id, p.sku, p.name
             FROM products p
             LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
             WHERE p.id IN (${placeholders}) AND pi.id IS NULL
             ORDER BY p.id ASC`
            : `SELECT p.id, p.sku, p.name
             FROM products p
             WHERE p.id IN (${placeholders})
             ORDER BY p.id ASC`;
        products = await this.dataSource.query(query, ids);
      } else {
        // Original behavior: get products without images or all products
        const query =
          skipExisting === 'true'
            ? `SELECT p.id, p.sku, p.name
             FROM products p
             LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
             WHERE p.is_active = true AND pi.id IS NULL
             ORDER BY p.id ASC
             LIMIT $1`
            : `SELECT p.id, p.sku, p.name FROM products p WHERE p.is_active = true ORDER BY p.id ASC LIMIT $1`;
        products = await this.dataSource.query(query, [maxProducts]);
      }

      this.logger.info(`Starting auto-search for ${products.length} products`);

      // Search for images in batches
      const searchResults = await this.imageSearchService.searchProductImagesBatch(
        products.map((p: any) => ({ sku: p.sku, name: p.name })),
        { maxConcurrent: 2, delayMs: 3000 }, // Be respectful to Google
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
              [product.id],
            );

            // Insert image
            await this.dataSource.query(
              `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
               VALUES ($1, $2, $3, true, 0, NOW())
               ON CONFLICT DO NOTHING`,
              [product.id, result.imageUrl, product.name || result.sku],
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

      res.json(
        successResponse({
          message: 'Auto-search completed',
          searched: products.length,
          imported,
          notFound,
          errors: errors.slice(0, 10),
        }),
      );
    } catch (error) {
      this.logger.error('Error auto-searching product images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to auto-search images', 500));
    }
  }

  /**
   * Upload a product image file to disk and save to product_images table.
   * POST /products/:productId/images/upload
   * Expects multipart/form-data with field "image"
   */
  async uploadProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const file = (req as any).file;

      if (!file) {
        res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'Nu a fost trimis niciun fisier', 400));
        return;
      }

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      // Verify product exists
      const product = await this.dataSource.query('SELECT id, name FROM products WHERE id = $1', [
        productId,
      ]);

      if (product.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const imageUrl = `/uploads/products/${file.filename}`;
      const altText = req.body.alt_text || product[0].name || '';
      const isPrimary = req.body.is_primary !== 'false';

      // If setting as primary, unset other primaries
      if (isPrimary) {
        await this.dataSource.query(
          'UPDATE product_images SET is_primary = false WHERE product_id = $1',
          [productId],
        );
      }

      // Insert into product_images table
      const result = await this.dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, $4, 0, NOW())
         RETURNING id, image_url, alt_text, is_primary`,
        [productId, imageUrl, altText, isPrimary],
      );

      // Also update image_url on the product itself (for quick access)
      if (isPrimary) {
        await this.dataSource.query(
          'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
          [imageUrl, productId],
        );
      }

      this.logger.info(`Image uploaded for product ${productId}: ${imageUrl}`);

      res.status(201).json(
        successResponse({
          id: result[0].id,
          image_url: imageUrl,
          alt_text: altText,
          is_primary: isPrimary,
          filename: file.filename,
          size: file.size,
        }),
      );
    } catch (error) {
      this.logger.error('Error uploading product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la upload imagine', 500));
    }
  }

  /**
   * Search for product images online based on SKU / product name.
   * POST /products/:productId/images/search
   * Returns an array of candidate image URLs for preview.
   */
  async searchProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const products = await this.dataSource.query(
        'SELECT id, sku, name FROM products WHERE id = $1',
        [productId],
      );

      if (products.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const product = products[0];
      const customQuery = req.body?.query;

      this.logger.info(
        `Searching images for product ${productId} (SKU: ${product.sku})${customQuery ? ` with query: ${customQuery}` : ''}`,
      );

      // Use custom query or default SKU + name
      const candidates = customQuery
        ? await this.imageSearchService.searchCandidates(customQuery, undefined, 6)
        : await this.imageSearchService.searchCandidates(product.sku, product.name, 6);

      res.json(
        successResponse({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          candidates,
        }),
      );
    } catch (error) {
      this.logger.error('Error searching product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la cautarea imaginii', 500));
    }
  }

  /**
   * Select a searched image candidate — download it locally and save as primary.
   * POST /products/:productId/images/select
   * Body: { imageUrl: string }
   */
  async selectSearchedImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'imageUrl este obligatoriu', 400));
        return;
      }

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const products = await this.dataSource.query(
        'SELECT id, sku, name FROM products WHERE id = $1',
        [productId],
      );

      if (products.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const product = products[0];

      // Download the external image to local disk
      const localPath = await this.imageSearchService.downloadExternalImage(
        imageUrl,
        product.id,
        product.sku,
      );

      if (!localPath) {
        res
          .status(422)
          .json(errorResponse('DOWNLOAD_FAILED', 'Nu s-a putut descarca imaginea', 422));
        return;
      }

      // Unset other primaries
      await this.dataSource.query(
        'UPDATE product_images SET is_primary = false WHERE product_id = $1',
        [productId],
      );

      // Insert into product_images
      const result = await this.dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, true, 0, NOW())
         RETURNING id, image_url, alt_text, is_primary`,
        [productId, localPath, product.name || product.sku],
      );

      // Update product's image_url
      await this.dataSource.query(
        'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
        [localPath, productId],
      );

      this.logger.info(
        `Selected searched image for product ${productId}: ${localPath} (from ${imageUrl})`,
      );

      res.status(201).json(
        successResponse({
          id: result[0].id,
          image_url: localPath,
          alt_text: product.name || product.sku,
          is_primary: true,
          original_url: imageUrl,
        }),
      );
    } catch (error) {
      this.logger.error('Error selecting searched image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la salvarea imaginii', 500));
    }
  }
}
