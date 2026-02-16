import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource } from 'typeorm';

export interface FavoriteResponse {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  price: number;
  currency: string;
  image_url?: string;
  stock_available: number;
  stock_local: number;
  stock_supplier: number;
  supplier_lead_time: number;
  in_stock: boolean;
  created_at: string;
}

const MAX_FAVORITES = 50;

export class B2BFavoritesController {
  constructor(private readonly dataSource: DataSource) {}

  private getB2BCustomerId(req: AuthenticatedRequest): number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    const id = b2bCustomer?.customer_id ?? b2bCustomer?.id;
    return id ? parseInt(id, 10) : undefined;
  }

  async getFavorites(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const favorites = await this.dataSource.query(`
        SELECT 
          f.id,
          f.product_id,
          p.sku,
          p.name as product_name,
          p.base_price as price,
          'RON' as currency,
          (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC LIMIT 1) as image_url,
          COALESCE(SUM(sl.quantity_available), 0) as stock_available,
          COALESCE(SUM(CASE WHEN sl.warehouse_id IN (SELECT id FROM warehouses WHERE is_active = true) THEN sl.quantity_available ELSE 0 END), 0) as stock_local,
          0 as stock_supplier,
          3 as supplier_lead_time,
          CASE WHEN COALESCE(SUM(sl.quantity_available), 0) > 0 THEN true ELSE false END as in_stock,
          f.created_at
        FROM b2b_favorites f
        JOIN products p ON f.product_id = p.id
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE f.customer_id = $1 AND p.is_active = true
        GROUP BY f.id, f.product_id, p.sku, p.name, p.base_price, f.created_at
        ORDER BY f.created_at DESC
      `, [customerId]);

      const response: FavoriteResponse[] = favorites.map((f: any) => ({
        id: f.id,
        product_id: f.product_id,
        sku: f.sku,
        product_name: f.product_name,
        price: parseFloat(f.price),
        currency: f.currency,
        image_url: f.image_url,
        stock_available: parseInt(f.stock_available) || 0,
        stock_local: parseInt(f.stock_local) || 0,
        stock_supplier: parseInt(f.stock_supplier) || 0,
        supplier_lead_time: parseInt(f.supplier_lead_time) || 3,
        in_stock: f.in_stock,
        created_at: f.created_at
      }));

      res.status(200).json({
        success: true,
        data: {
          favorites: response,
          total: response.length,
          max_allowed: MAX_FAVORITES
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async addFavorite(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { product_id } = req.body;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      if (!product_id) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Product ID is required' }
        });
        return;
      }

      const product = await this.dataSource.query(
        `SELECT id, sku, name, base_price, is_active FROM products WHERE id = $1`,
        [product_id]
      );

      if (product.length === 0 || !product[0].is_active) {
        res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found or inactive' }
        });
        return;
      }

      const currentCount = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM b2b_favorites WHERE customer_id = $1`,
        [customerId]
      );

      if (parseInt(currentCount[0].count) >= MAX_FAVORITES) {
        res.status(400).json({
          success: false,
          error: { 
            code: 'MAX_FAVORITES_REACHED', 
            message: `Maximum ${MAX_FAVORITES} favorites allowed. Please remove some items before adding more.` 
          }
        });
        return;
      }

      const existing = await this.dataSource.query(
        `SELECT id FROM b2b_favorites WHERE customer_id = $1 AND product_id = $2`,
        [customerId, product_id]
      );

      if (existing.length > 0) {
        res.status(200).json({
          success: true,
          data: {
            id: existing[0].id,
            product_id: parseInt(product_id),
            product_name: product[0].name,
            already_favorite: true,
            message: 'Product is already in favorites'
          }
        });
        return;
      }

      const result = await this.dataSource.query(
        `INSERT INTO b2b_favorites (customer_id, product_id, created_at) 
         VALUES ($1, $2, NOW()) 
         RETURNING id`,
        [customerId, product_id]
      );

      res.status(201).json({
        success: true,
        data: {
          id: result[0].id,
          product_id: parseInt(product_id),
          product_name: product[0].name,
          sku: product[0].sku,
          already_favorite: false,
          message: 'Product added to favorites'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async removeFavorite(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { productId } = req.params;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const result = await this.dataSource.query(
        `DELETE FROM b2b_favorites WHERE customer_id = $1 AND product_id = $2 RETURNING id`,
        [customerId, productId]
      );

      if (result.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Favorite not found' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          removed_product_id: parseInt(productId),
          message: 'Product removed from favorites'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async checkFavorite(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { productId } = req.params;

      if (!customerId) {
        res.status(200).json({
          success: true,
          data: { is_favorite: false }
        });
        return;
      }

      const result = await this.dataSource.query(
        `SELECT id FROM b2b_favorites WHERE customer_id = $1 AND product_id = $2`,
        [customerId, productId]
      );

      res.status(200).json({
        success: true,
        data: {
          is_favorite: result.length > 0,
          favorite_id: result.length > 0 ? result[0].id : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async addAllToCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { quantities } = req.body;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const favorites = await this.dataSource.query(`
        SELECT 
          f.product_id,
          p.sku,
          p.name,
          p.base_price,
          COALESCE(SUM(sl.quantity_available), 0) as stock_available
        FROM b2b_favorites f
        JOIN products p ON f.product_id = p.id
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE f.customer_id = $1 AND p.is_active = true
        GROUP BY f.product_id, p.sku, p.name, p.base_price
      `, [customerId]);

      if (favorites.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FAVORITES', message: 'No products in favorites to add to cart' }
        });
        return;
      }

      let cart = await this.dataSource.query(
        `SELECT id FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1`,
        [customerId]
      );

      let cartId: number;
      if (cart.length === 0) {
        const newCart = await this.dataSource.query(
          `INSERT INTO b2b_cart (customer_id, name, is_active, created_at, updated_at) 
           VALUES ($1, 'Default Cart', true, NOW(), NOW()) 
           RETURNING id`,
          [customerId]
        );
        cartId = newCart[0].id;
      } else {
        cartId = cart[0].id;
      }

      const quantityMap = quantities || {};
      const addedItems: any[] = [];
      const stockIssues: any[] = [];

      for (const favorite of favorites) {
        const quantity = quantityMap[favorite.product_id] || 1;
        const stockAvailable = parseInt(favorite.stock_available) || 0;

        const existingItem = await this.dataSource.query(
          `SELECT id, quantity FROM b2b_cart_items WHERE cart_id = $1 AND product_id = $2`,
          [cartId, favorite.product_id]
        );

        const newQuantity = existingItem.length > 0 
          ? existingItem[0].quantity + quantity 
          : quantity;

        if (stockAvailable < newQuantity) {
          stockIssues.push({
            product_id: favorite.product_id,
            product_name: favorite.name,
            requested: newQuantity,
            available: stockAvailable
          });
          continue;
        }

        if (existingItem.length > 0) {
          await this.dataSource.query(
            `UPDATE b2b_cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2`,
            [newQuantity, existingItem[0].id]
          );
        } else {
          await this.dataSource.query(
            `INSERT INTO b2b_cart_items (cart_id, product_id, quantity, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [cartId, favorite.product_id, quantity]
          );
        }

        addedItems.push({
          product_id: favorite.product_id,
          product_name: favorite.name,
          sku: favorite.sku,
          quantity: quantity
        });
      }

      res.status(200).json({
        success: true,
        data: {
          cart_id: cartId,
          added_items: addedItems,
          stock_issues: stockIssues,
          total_added: addedItems.length,
          message: stockIssues.length > 0 
            ? `${addedItems.length} products added to cart. ${stockIssues.length} products have insufficient stock.`
            : 'All products added to cart successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async notifyStockBack(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { productId } = req.params;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const product = await this.dataSource.query(
        `SELECT id, name FROM products WHERE id = $1 AND is_active = true`,
        [productId]
      );

      if (product.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
        });
        return;
      }

      const existingNotification = await this.dataSource.query(
        `SELECT id FROM stock_notifications WHERE customer_id = $1 AND product_id = $2 AND notified = false`,
        [customerId, productId]
      );

      if (existingNotification.length > 0) {
        res.status(200).json({
          success: true,
          data: {
            message: 'You will already be notified when this product is back in stock'
          }
        });
        return;
      }

      await this.dataSource.query(
        `INSERT INTO stock_notifications (customer_id, product_id, created_at, notified)
         VALUES ($1, $2, NOW(), false)`,
        [customerId, productId]
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'You will be notified when this product is back in stock',
          product_name: product[0].name
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
