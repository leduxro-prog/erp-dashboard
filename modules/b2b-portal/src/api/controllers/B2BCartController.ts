import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource } from 'typeorm';
import { TierCalculationService } from '../../domain/services/TierCalculationService';
import { VAT_RATE } from '@shared/constants';

export interface CartItemResponse {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  base_price: number;
  tier_discount_percent: number;
  volume_discount_percent: number;
  total_discount_percent: number;
  discounted_price: number;
  subtotal: number;
  stock_available: number;
  stock_warning: boolean;
  image_url?: string;
}

export interface CartResponse {
  cart_id: number;
  customer_id: number;
  customer_name: string;
  tier: string;
  tier_discount_percent: number;
  items: CartItemResponse[];
  item_count: number;
  total_items: number;
  subtotal_base: number;
  tier_discount_amount: number;
  volume_discount_amount: number;
  total_discount_amount: number;
  subtotal_with_discount: number;
  tax_rate: number;
  tax_amount: number;
  total_with_tax: number;
  currency: string;
}

interface VolumeDiscount {
  min_quantity: number;
  max_quantity: number | null;
  discount_percentage: number;
}

export class B2BCartController {
  private tierService: TierCalculationService;
  private readonly TAX_RATE = VAT_RATE;

  constructor(
    private readonly dataSource: DataSource,
    private readonly customerRepository: any,
  ) {
    this.tierService = new TierCalculationService();
  }

  private getB2BCustomerId(req: AuthenticatedRequest): number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    const id = b2bCustomer?.customer_id ?? b2bCustomer?.id;
    return id ? parseInt(id, 10) : undefined;
  }

  async getCart(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { customerId: paramCustomerId } = req.params;

      const targetCustomerId = paramCustomerId ? parseInt(paramCustomerId, 10) : customerId;

      if (!targetCustomerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const cart = await this.getOrCreateCart(targetCustomerId);
      const customerInfo = await this.getCustomerInfo(targetCustomerId);

      if (!customerInfo) {
        res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'B2B customer not found' },
        });
        return;
      }

      const items = await this.getCartItemsWithDetails(cart.id, customerInfo.tier);
      const response = this.buildCartResponse(cart, customerInfo, items);

      res.status(200).json({ success: true, data: response });
    } catch (error) {
      next(error);
    }
  }

  async addToCart(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const { product_id, quantity = 1, notes } = req.body;

      if (!product_id || quantity < 1) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Product ID and valid quantity required' },
        });
        return;
      }

      const product = await this.dataSource.query(
        `SELECT p.id, p.sku, p.name, p.base_price, p.is_active,
                COALESCE(SUM(sl.quantity_available), 0) as stock_available,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC LIMIT 1) as image_url
         FROM products p
         LEFT JOIN stock_levels sl ON p.id = sl.product_id
         WHERE p.id = $1
         GROUP BY p.id, p.sku, p.name, p.base_price, p.is_active`,
        [product_id],
      );

      if (product.length === 0 || !product[0].is_active) {
        res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found or inactive' },
        });
        return;
      }

      const stockAvailable = parseInt(product[0].stock_available) || 0;

      const cart = await this.getOrCreateCart(customerId);

      const existingItem = await this.dataSource.query(
        `SELECT id, quantity FROM b2b_cart_items WHERE cart_id = $1 AND product_id = $2`,
        [cart.id, product_id],
      );

      const newQuantity = existingItem.length > 0 ? existingItem[0].quantity + quantity : quantity;

      if (stockAvailable < newQuantity) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock. Available: ${stockAvailable}, Requested: ${newQuantity}`,
            available: stockAvailable,
            requested: newQuantity,
          },
        });
        return;
      }

      if (existingItem.length > 0) {
        await this.dataSource.query(
          `UPDATE b2b_cart_items SET quantity = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3`,
          [newQuantity, notes, existingItem[0].id],
        );
      } else {
        await this.dataSource.query(
          `INSERT INTO b2b_cart_items (cart_id, product_id, quantity, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [cart.id, product_id, quantity, notes],
        );
      }

      res.status(200).json({
        success: true,
        data: {
          cart_id: cart.id,
          item_added: {
            product_id: parseInt(product_id),
            product_name: product[0].name,
            sku: product[0].sku,
            quantity: newQuantity,
            unit_price: parseFloat(product[0].base_price),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCartItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { itemId } = req.params;
      const { quantity } = req.body;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      if (quantity === undefined || quantity < 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUANTITY', message: 'Valid quantity required (>= 0)' },
        });
        return;
      }

      const cart = await this.getOrCreateCart(customerId);
      const item = await this.dataSource.query(
        `SELECT ci.id, ci.product_id, ci.quantity, p.name, p.sku, p.base_price
         FROM b2b_cart_items ci
         JOIN products p ON ci.product_id = p.id
         WHERE ci.id = $1 AND ci.cart_id = $2`,
        [itemId, cart.id],
      );

      if (item.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Cart item not found' },
        });
        return;
      }

      if (quantity === 0) {
        await this.dataSource.query(`DELETE FROM b2b_cart_items WHERE id = $1`, [itemId]);

        res.status(200).json({
          success: true,
          data: {
            cart_id: cart.id,
            item_id: parseInt(itemId),
            removed: true,
            message: 'Item removed from cart',
          },
        });
        return;
      }

      const stockResult = await this.dataSource.query(
        `SELECT COALESCE(SUM(quantity_available), 0) as stock_available
         FROM stock_levels WHERE product_id = $1`,
        [item[0].product_id],
      );

      const stockAvailable = parseInt(stockResult[0]?.stock_available) || 0;

      if (stockAvailable < quantity) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock. Available: ${stockAvailable}, Requested: ${quantity}`,
            available: stockAvailable,
            requested: quantity,
          },
        });
        return;
      }

      await this.dataSource.query(
        `UPDATE b2b_cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2`,
        [quantity, itemId],
      );

      res.status(200).json({
        success: true,
        data: {
          cart_id: cart.id,
          item_id: parseInt(itemId),
          product_name: item[0].name,
          old_quantity: item[0].quantity,
          new_quantity: quantity,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async removeCartItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { itemId } = req.params;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const cart = await this.getOrCreateCart(customerId);
      const item = await this.dataSource.query(
        `SELECT id, product_id FROM b2b_cart_items WHERE id = $1 AND cart_id = $2`,
        [itemId, cart.id],
      );

      if (item.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Cart item not found' },
        });
        return;
      }

      await this.dataSource.query(`DELETE FROM b2b_cart_items WHERE id = $1`, [itemId]);

      res.status(200).json({
        success: true,
        data: {
          cart_id: cart.id,
          removed_item_id: parseInt(itemId),
          message: 'Item removed from cart',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { customerId: paramCustomerId } = req.params;

      const targetCustomerId = paramCustomerId ? parseInt(paramCustomerId, 10) : customerId;

      if (!targetCustomerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const cart = await this.getOrCreateCart(targetCustomerId);

      await this.dataSource.query(`DELETE FROM b2b_cart_items WHERE cart_id = $1`, [cart.id]);

      res.status(200).json({
        success: true,
        data: {
          cart_id: cart.id,
          cleared: true,
          message: 'Cart cleared successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async validateStock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const cart = await this.getOrCreateCart(customerId);
      const items = await this.dataSource.query(
        `SELECT ci.id, ci.product_id, ci.quantity, p.sku, p.name as product_name
         FROM b2b_cart_items ci
         JOIN products p ON ci.product_id = p.id
         WHERE ci.cart_id = $1`,
        [cart.id],
      );

      const stockIssues = [];

      for (const item of items) {
        const stockResult = await this.dataSource.query(
          `SELECT COALESCE(SUM(quantity_available), 0) as stock_available
           FROM stock_levels WHERE product_id = $1`,
          [item.product_id],
        );

        const stockAvailable = parseInt(stockResult[0]?.stock_available) || 0;

        if (stockAvailable < item.quantity) {
          stockIssues.push({
            item_id: item.id,
            product_id: item.product_id,
            sku: item.sku,
            product_name: item.product_name,
            requested: item.quantity,
            available: stockAvailable,
            shortfall: item.quantity - stockAvailable,
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          valid: stockIssues.length === 0,
          issues: stockIssues,
          total_items: items.length,
          items_with_issues: stockIssues.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getOrCreateCart(customerId: number): Promise<{ id: number }> {
    const existingCart = await this.dataSource.query(
      `SELECT id FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1`,
      [customerId],
    );

    if (existingCart.length > 0) {
      return existingCart[0];
    }

    const result = await this.dataSource.query(
      `INSERT INTO b2b_cart (customer_id, name, is_active, created_at, updated_at)
       VALUES ($1, 'Default Cart', true, NOW(), NOW())
       RETURNING id`,
      [customerId],
    );

    return result[0];
  }

  private async getCustomerInfo(customerId: number): Promise<{
    id: number;
    company_name: string;
    tier: string;
    tier_discount_percent: number;
  } | null> {
    const customer = await this.dataSource.query(
      `SELECT id, company_name, tier, COALESCE(discount_percentage, 0) as discount_percentage
       FROM b2b_customers WHERE id = $1`,
      [customerId],
    );

    if (customer.length === 0) {
      return null;
    }

    const tierDiscount = this.tierService.getDiscountForTier(customer[0].tier as any);

    return {
      id: customer[0].id,
      company_name: customer[0].company_name,
      tier: customer[0].tier,
      tier_discount_percent: tierDiscount * 100,
    };
  }

  private async getCartItemsWithDetails(cartId: number, tier: string): Promise<CartItemResponse[]> {
    const items = await this.dataSource.query(
      `SELECT ci.id, ci.product_id, ci.quantity, p.sku, p.name, p.base_price,
              COALESCE(SUM(sl.quantity_available), 0) as stock_available,
              (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = ci.product_id ORDER BY pi.is_primary DESC LIMIT 1) as image_url
       FROM b2b_cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN stock_levels sl ON ci.product_id = sl.product_id
       WHERE ci.cart_id = $1
       GROUP BY ci.id, ci.product_id, ci.quantity, p.sku, p.name, p.base_price`,
      [cartId],
    );

    const enrichedItems: CartItemResponse[] = [];

    for (const item of items) {
      const basePrice = parseFloat(item.base_price);
      const quantity = item.quantity;
      const stockAvailable = parseInt(item.stock_available) || 0;

      const tierDiscount = this.tierService.getDiscountForTier(tier as any) * 100;
      const volumeDiscount = await this.getVolumeDiscount(item.product_id, tier, quantity);

      const totalDiscountPercent = tierDiscount + volumeDiscount;
      const discountedPrice = basePrice * (1 - totalDiscountPercent / 100);
      const subtotal = discountedPrice * quantity;

      enrichedItems.push({
        id: item.id,
        product_id: item.product_id,
        sku: item.sku,
        product_name: item.name,
        quantity,
        unit_price: Math.round(discountedPrice * 100) / 100,
        base_price: basePrice,
        tier_discount_percent: tierDiscount,
        volume_discount_percent: volumeDiscount,
        total_discount_percent: totalDiscountPercent,
        discounted_price: Math.round(discountedPrice * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        stock_available: stockAvailable,
        stock_warning: stockAvailable < quantity,
        image_url: item.image_url,
      });
    }

    return enrichedItems;
  }

  private async getVolumeDiscount(
    productId: number,
    tier: string,
    quantity: number,
  ): Promise<number> {
    const discounts = await this.dataSource.query(
      `SELECT min_quantity, max_quantity, discount_percentage
       FROM volume_discounts
       WHERE product_id = $1 AND is_active = true
         AND start_date <= CURRENT_DATE
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND min_quantity <= $2
         AND (max_quantity IS NULL OR max_quantity >= $2)
       ORDER BY discount_percentage DESC
       LIMIT 1`,
      [productId, quantity],
    );

    if (discounts.length > 0) {
      return parseFloat(discounts[0].discount_percentage);
    }

    return 0;
  }

  private buildCartResponse(
    cart: { id: number },
    customerInfo: { id: number; company_name: string; tier: string; tier_discount_percent: number },
    items: CartItemResponse[],
  ): CartResponse {
    const subtotalBase = items.reduce((sum, item) => sum + item.base_price * item.quantity, 0);
    const tierDiscountAmount = items.reduce(
      (sum, item) => sum + ((item.base_price * item.tier_discount_percent) / 100) * item.quantity,
      0,
    );
    const volumeDiscountAmount = items.reduce(
      (sum, item) => sum + ((item.base_price * item.volume_discount_percent) / 100) * item.quantity,
      0,
    );
    const totalDiscountAmount = tierDiscountAmount + volumeDiscountAmount;
    const subtotalWithDiscount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = subtotalWithDiscount * this.TAX_RATE;
    const totalWithTax = subtotalWithDiscount + taxAmount;

    return {
      cart_id: cart.id,
      customer_id: customerInfo.id,
      customer_name: customerInfo.company_name,
      tier: customerInfo.tier,
      tier_discount_percent: customerInfo.tier_discount_percent,
      items,
      item_count: items.length,
      total_items: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal_base: Math.round(subtotalBase * 100) / 100,
      tier_discount_amount: Math.round(tierDiscountAmount * 100) / 100,
      volume_discount_amount: Math.round(volumeDiscountAmount * 100) / 100,
      total_discount_amount: Math.round(totalDiscountAmount * 100) / 100,
      subtotal_with_discount: Math.round(subtotalWithDiscount * 100) / 100,
      tax_rate: this.TAX_RATE * 100,
      tax_amount: Math.round(taxAmount * 100) / 100,
      total_with_tax: Math.round(totalWithTax * 100) / 100,
      currency: 'RON',
    };
  }
}
