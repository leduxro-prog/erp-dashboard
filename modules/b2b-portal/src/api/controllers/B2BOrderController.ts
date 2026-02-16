import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource, QueryRunner } from 'typeorm';
import { TierCalculationService } from '../../domain/services/TierCalculationService';
import { ValidationError } from '@shared/errors/BaseError';
import { InsufficientCreditError, CustomerSuspendedError } from '../../domain/errors/b2b.errors';
import { VAT_RATE } from '@shared/constants';

interface CartItem {
  id: string;
  product_id: string | number;
  sku: string;
  product_name: string;
  quantity: number;
  base_price: number;
  added_at: string;
}

interface OrderItemInput {
  product_id: string | number;
  quantity: number;
  price?: number;
}

interface CreateOrderRequest {
  items?: OrderItemInput[];
  shipping_address:
    | string
    | {
        street: string;
        city: string;
        state?: string;
        postal_code: string;
        country?: string;
      };
  billing_address?:
    | string
    | {
        street: string;
        city: string;
        state?: string;
        postal_code: string;
        country?: string;
      };
  use_different_billing?: boolean;
  contact_name: string;
  contact_phone: string;
  payment_method?: 'CREDIT' | 'TRANSFER' | 'CASH';
  notes?: string;
  purchase_order_number?: string;
}

interface StockValidationIssue {
  product_id: string | number;
  product_name: string;
  requested: number;
  available: number;
  shortfall: number;
}

interface CSVImportItem {
  sku: string;
  quantity: number;
  notes?: string;
}

interface CSVImportResult {
  valid_items: Array<{
    product_id: string | number;
    sku: string;
    product_name: string;
    quantity: number;
    base_price: number;
    unit_price: number;
    stock_available: number;
    notes?: string;
  }>;
  invalid_items: Array<{
    sku: string;
    quantity: number;
    reason: string;
    notes?: string;
  }>;
  total_items: number;
  valid_count: number;
  invalid_count: number;
}

export class B2BOrderController {
  private tierService: TierCalculationService;

  constructor(private readonly dataSource: DataSource) {
    this.tierService = new TierCalculationService();
  }

  private getB2BCustomerId(req: AuthenticatedRequest): string | number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    return b2bCustomer?.customer_id ?? b2bCustomer?.id;
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.user?.role === 'admin';
  }

  private async generateOrderNumber(queryRunner: QueryRunner): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    const countResult = await queryRunner.query(
      `SELECT COUNT(*) as count FROM b2b_orders WHERE order_number LIKE $1`,
      [`B2B-${datePrefix}-%`],
    );

    const orderCount = parseInt(countResult[0]?.count || '0') + 1;
    const orderNumber = `B2B-${datePrefix}-${String(orderCount).padStart(4, '0')}`;

    return orderNumber;
  }

  private formatAddress(address: string | object): string {
    if (typeof address === 'string') {
      return address;
    }

    const addr = address as any;
    const parts = [
      addr.street,
      addr.city,
      addr.state,
      addr.postal_code,
      addr.country || 'Romania',
    ].filter(Boolean);

    return parts.join(', ');
  }

  private async validateStock(
    queryRunner: QueryRunner,
    items: Array<{ product_id: string | number; quantity: number }>,
  ): Promise<StockValidationIssue[]> {
    const issues: StockValidationIssue[] = [];

    for (const item of items) {
      const stockResult = await queryRunner.query(
        `SELECT 
          p.id, p.name, p.sku,
          COALESCE(SUM(sl.quantity_available), 0) as stock_available
         FROM products p
         LEFT JOIN stock_levels sl ON p.id = sl.product_id
         WHERE p.id = $1 AND p.is_active = true
         GROUP BY p.id, p.name, p.sku`,
        [item.product_id],
      );

      if (stockResult.length === 0) {
        issues.push({
          product_id: item.product_id,
          product_name: 'Unknown Product',
          requested: item.quantity,
          available: 0,
          shortfall: item.quantity,
        });
        continue;
      }

      const product = stockResult[0];
      const stockAvailable = parseInt(product.stock_available) || 0;

      if (stockAvailable < item.quantity) {
        issues.push({
          product_id: item.product_id,
          product_name: product.name,
          requested: item.quantity,
          available: stockAvailable,
          shortfall: item.quantity - stockAvailable,
        });
      }
    }

    return issues;
  }

  private async validateCredit(
    queryRunner: QueryRunner,
    customerId: string | number,
    amount: number,
  ): Promise<{
    valid: boolean;
    creditLimit: number;
    usedCredit: number;
    creditAvailable: number;
    error?: string;
  }> {
    const customerResult = await queryRunner.query(
      `SELECT 
        id, company_name, tier, credit_limit, credit_used,
        status, discount_percentage, payment_terms_days
       FROM b2b_customers
       WHERE id = $1
       FOR UPDATE`,
      [customerId],
    );

    if (customerResult.length === 0) {
      return {
        valid: false,
        creditLimit: 0,
        usedCredit: 0,
        creditAvailable: 0,
        error: 'CUSTOMER_NOT_FOUND',
      };
    }

    const customer = customerResult[0];

    if (customer.status !== 'ACTIVE') {
      return {
        valid: false,
        creditLimit: parseFloat(customer.credit_limit) || 0,
        usedCredit: parseFloat(customer.credit_used) || 0,
        creditAvailable: 0,
        error: 'ACCOUNT_INACTIVE',
      };
    }

    const creditLimit = parseFloat(customer.credit_limit) || 0;
    const usedCredit = parseFloat(customer.credit_used) || 0;
    const creditAvailable = creditLimit - usedCredit;

    if (creditAvailable < amount) {
      return {
        valid: false,
        creditLimit,
        usedCredit,
        creditAvailable,
        error: 'INSUFFICIENT_CREDIT',
      };
    }

    return {
      valid: true,
      creditLimit,
      usedCredit,
      creditAvailable,
    };
  }

  async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const scopedB2BCustomerId = this.getB2BCustomerId(req);
      const customerId = scopedB2BCustomerId ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      const body: CreateOrderRequest = req.body;
      let items: Array<{ product_id: string | number; quantity: number; price?: number }> = [];
      let cartId: string | null = null;

      if (body.items && body.items.length > 0) {
        items = body.items;
      } else {
        const cartResult = await queryRunner.query(
          `SELECT id, items FROM session_carts WHERE customer_id = $1 LIMIT 1`,
          [customerId],
        );

        if (cartResult.length === 0 || !cartResult[0].items || cartResult[0].items.length === 0) {
          res.status(400).json({
            success: false,
            error: { code: 'EMPTY_CART', message: 'No items in cart and no items provided' },
          });
          return;
        }

        cartId = cartResult[0].id;
        items = cartResult[0].items.map((item: CartItem) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.base_price,
        }));
      }

      if (!body.shipping_address || !body.contact_name || !body.contact_phone) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_DELIVERY_INFO',
            message: 'Shipping address, contact name and phone are required',
          },
        });
        return;
      }

      const customerResult = await queryRunner.query(
        `SELECT
          id, company_name, tier, credit_limit, credit_used,
          status, discount_percentage, payment_terms_days,
          status = 'ACTIVE' as is_active
         FROM b2b_customers
         WHERE id = $1`,
        [customerId],
      );

      if (customerResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'B2B customer not found' },
        });
        return;
      }

      const customer = customerResult[0];

      if (!customer.is_active || customer.status !== 'ACTIVE') {
        res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_INACTIVE', message: 'Customer account is not active' },
        });
        return;
      }

      const stockIssues = await this.validateStock(queryRunner, items);

      if (stockIssues.length > 0) {
        await queryRunner.rollbackTransaction();
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Some products have insufficient stock',
            details: stockIssues,
          },
        });
        return;
      }

      const tierDiscount = this.tierService.getDiscountForTier(customer.tier as any);
      const customerDiscount = parseFloat(customer.discount_percentage) || 0;
      const totalDiscountPercent = tierDiscount + customerDiscount / 100;

      let subtotal = 0;
      let discountAmount = 0;
      const orderItems: Array<{
        product_id: string | number;
        sku: string;
        product_name: string;
        quantity: number;
        base_price: number;
        unit_price: number;
        discount_percent: number;
        total_price: number;
        cost_price_snapshot: number | null;
        cost_source: string | null;
      }> = [];

      for (const item of items) {
        const productResult = await queryRunner.query(
          `SELECT id, sku, name, base_price, metadata FROM products WHERE id = $1 AND is_active = true`,
          [item.product_id],
        );

        if (productResult.length === 0) {
          await queryRunner.rollbackTransaction();
          res.status(404).json({
            success: false,
            error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.product_id} not found` },
          });
          return;
        }

        const product = productResult[0];
        const basePrice = item.price ?? parseFloat(product.base_price) ?? 0;
        const itemDiscount = basePrice * totalDiscountPercent;
        const unitPrice = basePrice - itemDiscount;
        const totalPrice = unitPrice * item.quantity;

        // Snapshot cost at time of sale
        const metadataCost = product.metadata
          ? (typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata)
              ?.cost
          : null;
        const costPriceSnapshot = metadataCost != null ? parseFloat(metadataCost) : basePrice * 0.7;
        const costSource =
          metadataCost != null ? product.metadata?.cost_source || 'metadata' : 'estimated';

        subtotal += basePrice * item.quantity;
        discountAmount += itemDiscount * item.quantity;

        orderItems.push({
          product_id: item.product_id,
          sku: product.sku,
          product_name: product.name,
          quantity: item.quantity,
          base_price: Math.round(basePrice * 100) / 100,
          unit_price: Math.round(unitPrice * 100) / 100,
          discount_percent: Math.round(totalDiscountPercent * 100 * 100) / 100,
          total_price: Math.round(totalPrice * 100) / 100,
          cost_price_snapshot: Math.round(costPriceSnapshot * 100) / 100,
          cost_source: costSource,
        });
      }

      const subtotalAfterDiscount = subtotal - discountAmount;
      const vatAmount = subtotalAfterDiscount * VAT_RATE;
      const totalAmount = subtotalAfterDiscount + vatAmount;

      const creditValidation = await this.validateCredit(queryRunner, customerId, totalAmount);

      if (!creditValidation.valid) {
        await queryRunner.rollbackTransaction();

        const errorResponse: any = {
          success: false,
          error: {
            code: creditValidation.error,
            message:
              creditValidation.error === 'INSUFFICIENT_CREDIT'
                ? 'Order total exceeds available credit'
                : creditValidation.error === 'ACCOUNT_INACTIVE'
                  ? 'Customer account is not active'
                  : 'Customer not found',
            credit_limit: creditValidation.creditLimit,
            credit_used: creditValidation.usedCredit,
            credit_available: creditValidation.creditAvailable,
            order_total: totalAmount,
          },
        };

        if (creditValidation.error === 'INSUFFICIENT_CREDIT') {
          errorResponse.error.shortfall = totalAmount - creditValidation.creditAvailable;
        }

        res.status(402).json(errorResponse);
        return;
      }

      const orderNumber = await this.generateOrderNumber(queryRunner);
      const shippingAddressStr = this.formatAddress(body.shipping_address);
      const billingAddressStr =
        body.use_different_billing && body.billing_address
          ? this.formatAddress(body.billing_address)
          : shippingAddressStr;

      const paymentTermsDays = parseInt(customer.payment_terms_days) || 30;
      const paymentDueDate = new Date();
      paymentDueDate.setDate(paymentDueDate.getDate() + paymentTermsDays);

      const orderResult = await queryRunner.query(
        `INSERT INTO b2b_orders (
          order_number, customer_id, status, order_type,
          subtotal, discount_amount, vat_amount, total, currency_code,
          payment_method, payment_status, payment_due_date,
          shipping_address, billing_address, notes, purchase_order_number,
          created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING id, order_number, status, created_at`,
        [
          orderNumber,
          customerId,
          'PENDING',
          'STANDARD',
          subtotal,
          discountAmount,
          vatAmount,
          totalAmount,
          'RON',
          body.payment_method || 'CREDIT',
          'UNPAID',
          paymentDueDate,
          shippingAddressStr,
          billingAddressStr,
          body.notes || '',
          body.purchase_order_number || null,
          req.user?.id || 'system',
        ],
      );

      const order = orderResult[0];

      for (const item of orderItems) {
        await queryRunner.query(
          `INSERT INTO b2b_order_items (
            order_id, product_id, sku, product_name, quantity,
            unit_price, discount_percent, total_price, stock_source,
            cost_price_snapshot, cost_source, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [
            order.id,
            item.product_id,
            item.sku,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.discount_percent,
            item.total_price,
            'LOCAL',
            item.cost_price_snapshot,
            item.cost_source,
          ],
        );

        await queryRunner.query(
          `UPDATE stock_levels 
           SET quantity_available = quantity_available - $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id],
        );
      }

      const newUsedCredit = creditValidation.usedCredit + totalAmount;
      await queryRunner.query(
        `UPDATE b2b_customers 
         SET credit_used = $1, 
             last_order_at = NOW(),
             total_orders = total_orders + 1,
             total_spent = total_spent + $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newUsedCredit, totalAmount, customerId],
      );

      const transactionId = `txn_${randomUUID()}`;
      await queryRunner.query(
        `INSERT INTO b2b_credit_transactions (
          id, customer_id, amount, type, description, order_id,
          balance_before, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          transactionId,
          customerId,
          totalAmount,
          'ORDER',
          `Order ${orderNumber} - Credit used`,
          order.id,
          creditValidation.creditAvailable,
          creditValidation.creditAvailable - totalAmount,
        ],
      );

      if (cartId) {
        await queryRunner.query(
          `UPDATE session_carts SET items = '[]'::jsonb, updated_at = NOW() WHERE id = $1`,
          [cartId],
        );
      }

      await queryRunner.commitTransaction();

      res.status(201).json({
        success: true,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          customer_id: customerId,
          company_name: customer.company_name,
          status: order.status,
          subtotal: Math.round(subtotal * 100) / 100,
          discount_amount: Math.round(discountAmount * 100) / 100,
          discount_percent: Math.round(totalDiscountPercent * 100 * 100) / 100,
          vat_amount: Math.round(vatAmount * 100) / 100,
          total: Math.round(totalAmount * 100) / 100,
          currency: 'RON',
          payment_method: body.payment_method || 'CREDIT',
          payment_status: 'UNPAID',
          payment_due_date: paymentDueDate.toISOString(),
          payment_terms_days: paymentTermsDays,
          shipping_address: shippingAddressStr,
          billing_address: billingAddressStr,
          contact_name: body.contact_name,
          contact_phone: body.contact_phone,
          credit_used: newUsedCredit,
          credit_remaining: creditValidation.creditLimit - newUsedCredit,
          created_at: order.created_at,
          items: orderItems,
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      next(error);
    } finally {
      await queryRunner.release();
    }
  }

  async getOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status } = req.query as Record<string, any>;
      const offset = (Number(page) - 1) * Number(limit);

      const scopedB2BCustomerId = this.getB2BCustomerId(req);
      const customerId = scopedB2BCustomerId ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      let whereClause = 'WHERE o.customer_id = $1';
      const params: any[] = [customerId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND o.status = $${paramIndex}`;
        params.push(status.toUpperCase());
        paramIndex++;
      }

      params.push(Number(limit), offset);

      const orders = await this.dataSource.query(
        `SELECT 
          o.id, o.order_number, o.status, o.order_type,
          o.subtotal, o.discount_amount, o.vat_amount, o.total,
          o.currency_code, o.payment_method, o.payment_status,
          o.payment_due_date, o.shipping_address,
          o.created_at, o.confirmed_at, o.shipped_at, o.delivered_at,
          c.company_name, c.tier
         FROM b2b_orders o
         LEFT JOIN b2b_customers c ON o.customer_id = c.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
      );

      const countParams = [customerId];
      if (status) {
        countParams.push(status.toUpperCase());
      }

      const countWhereClause = status
        ? 'WHERE customer_id = $1 AND status = $2'
        : 'WHERE customer_id = $1';

      const totalResult = await this.dataSource.query(
        `SELECT COUNT(*) as total FROM b2b_orders ${countWhereClause}`,
        countParams,
      );

      const total = parseInt(totalResult[0]?.total || '0', 10);

      const enrichedOrders = await Promise.all(
        orders.map(async (order: any) => {
          const itemCountResult = await this.dataSource.query(
            `SELECT COUNT(*) as item_count, SUM(quantity) as total_items 
             FROM b2b_order_items WHERE order_id = $1`,
            [order.id],
          );

          return {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            order_type: order.order_type,
            company_name: order.company_name,
            tier: order.tier,
            subtotal: parseFloat(order.subtotal) || 0,
            discount_amount: parseFloat(order.discount_amount) || 0,
            vat_amount: parseFloat(order.vat_amount) || 0,
            total: parseFloat(order.total) || 0,
            currency_code: order.currency_code,
            payment_method: order.payment_method,
            payment_status: order.payment_status,
            payment_due_date: order.payment_due_date,
            shipping_address: order.shipping_address,
            item_count: parseInt(itemCountResult[0]?.item_count || '0'),
            total_items: parseInt(itemCountResult[0]?.total_items || '0'),
            created_at: order.created_at,
            confirmed_at: order.confirmed_at,
            shipped_at: order.shipped_at,
            delivered_at: order.delivered_at,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data: {
          orders: enrichedOrders,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            total_pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const scopedB2BCustomerId = this.getB2BCustomerId(req);
      const customerId = scopedB2BCustomerId ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      const orderResult = await this.dataSource.query(
        `SELECT 
          o.*,
          c.company_name, c.tier, c.cui, c.email, c.phone
         FROM b2b_orders o
         LEFT JOIN b2b_customers c ON o.customer_id = c.id
         WHERE o.id = $1 AND o.customer_id = $2`,
        [id, customerId],
      );

      if (orderResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
        return;
      }

      const order = orderResult[0];

      const items = await this.dataSource.query(
        `SELECT 
          oi.id, oi.product_id, oi.sku, oi.product_name,
          oi.quantity, oi.unit_price, oi.discount_percent, oi.total_price,
          oi.stock_source, oi.notes, oi.created_at,
          p.base_price, p.is_active as product_active
         FROM b2b_order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [id],
      );

      const statusHistory = await this.dataSource
        .query(
          `SELECT 
          id, status, notes, created_by, created_at
         FROM order_status_history
         WHERE order_id = $1
         ORDER BY created_at DESC`,
          [id],
        )
        .catch(() => []);

      res.status(200).json({
        success: true,
        data: {
          id: order.id,
          order_number: order.order_number,
          smartbill_id: order.smartbill_id,
          status: order.status,
          order_type: order.order_type,
          customer: {
            id: order.customer_id,
            company_name: order.company_name,
            tier: order.tier,
            cui: order.cui,
            email: order.email,
            phone: order.phone,
          },
          pricing: {
            subtotal: parseFloat(order.subtotal) || 0,
            discount_amount: parseFloat(order.discount_amount) || 0,
            shipping_cost: parseFloat(order.shipping_cost) || 0,
            vat_amount: parseFloat(order.vat_amount) || 0,
            total: parseFloat(order.total) || 0,
            currency_code: order.currency_code,
          },
          payment: {
            method: order.payment_method,
            status: order.payment_status,
            due_date: order.payment_due_date,
            terms_days: Math.ceil(
              (new Date(order.payment_due_date).getTime() - new Date(order.created_at).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          },
          shipping: {
            shipping_address: order.shipping_address,
            billing_address: order.billing_address,
          },
          dates: {
            created_at: order.created_at,
            confirmed_at: order.confirmed_at,
            shipped_at: order.shipped_at,
            delivered_at: order.delivered_at,
            updated_at: order.updated_at,
          },
          notes: order.notes,
          internal_notes: order.internal_notes,
          purchase_order_number: order.purchase_order_number,
          items: items.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            sku: item.sku,
            product_name: item.product_name,
            quantity: item.quantity,
            base_price: parseFloat(item.base_price) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            discount_percent: parseFloat(item.discount_percent) || 0,
            total_price: parseFloat(item.total_price) || 0,
            stock_source: item.stock_source,
            notes: item.notes,
            product_active: item.product_active,
          })),
          status_history: statusHistory,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerCredit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const scopedB2BCustomerId = this.getB2BCustomerId(req);
      const customerId = scopedB2BCustomerId ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      const customerResult = await this.dataSource.query(
        `SELECT
          id, company_name, tier,
          credit_limit, credit_used,
          credit_limit - credit_used as credit_available,
          payment_terms_days, discount_percentage,
          status, status = 'ACTIVE' as is_active
         FROM b2b_customers
         WHERE id = $1`,
        [customerId],
      );

      if (customerResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' },
        });
        return;
      }

      const customer = customerResult[0];
      const tierDiscount = this.tierService.getDiscountForTier(customer.tier as any);

      const pendingOrdersResult = await this.dataSource.query(
        `SELECT 
          COUNT(*) as pending_orders,
          COALESCE(SUM(total), 0) as pending_orders_value
         FROM b2b_orders
         WHERE customer_id = $1 
           AND status IN ('PENDING', 'CONFIRMED', 'PROCESSING')`,
        [customerId],
      );

      const pendingOrders = parseInt(pendingOrdersResult[0]?.pending_orders || '0');
      const pendingOrdersValue = parseFloat(pendingOrdersResult[0]?.pending_orders_value || '0');

      res.status(200).json({
        success: true,
        data: {
          customer_id: customer.id,
          company_name: customer.company_name,
          tier: customer.tier,
          status: customer.status,
          is_active: customer.is_active,
          credit_limit: parseFloat(customer.credit_limit) || 0,
          credit_used: parseFloat(customer.credit_used) || 0,
          credit_available: parseFloat(customer.credit_available) || 0,
          payment_terms_days: customer.payment_terms_days || 0,
          discount_percentage: parseFloat(customer.discount_percentage) || 0,
          tier_discount_percentage: tierDiscount * 100,
          total_discount_percentage:
            tierDiscount * 100 + (parseFloat(customer.discount_percentage) || 0),
          pending_orders: pendingOrders,
          pending_orders_value: pendingOrdersValue,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { id } = req.params;
      const { reason } = req.body;

      const scopedB2BCustomerId = this.getB2BCustomerId(req);
      const customerId = scopedB2BCustomerId ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      const orderResult = await queryRunner.query(
        `SELECT * FROM b2b_orders WHERE id = $1 AND customer_id = $2 FOR UPDATE`,
        [id, customerId],
      );

      if (orderResult.length === 0) {
        await queryRunner.rollbackTransaction();
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
        return;
      }

      const order = orderResult[0];

      if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
        await queryRunner.rollbackTransaction();
        res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_CANCEL',
            message: `Cannot cancel order with status: ${order.status}`,
          },
        });
        return;
      }

      const orderTotal = parseFloat(order.total) || 0;

      await queryRunner.query(
        `UPDATE b2b_orders 
         SET status = 'CANCELLED', 
             internal_notes = COALESCE(internal_notes, '') || $1,
             updated_at = NOW()
         WHERE id = $2`,
        [`\nCancelled: ${reason || 'Customer request'}`, id],
      );

      const items = await queryRunner.query(
        `SELECT product_id, quantity FROM b2b_order_items WHERE order_id = $1`,
        [id],
      );

      for (const item of items) {
        await queryRunner.query(
          `UPDATE stock_levels 
           SET quantity_available = quantity_available + $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id],
        );
      }

      if (orderTotal > 0) {
        await queryRunner.query(
          `UPDATE b2b_customers 
           SET credit_used = GREATEST(0, credit_used - $1),
               updated_at = NOW()
           WHERE id = $2`,
          [orderTotal, customerId],
        );

        const customerResult = await queryRunner.query(
          `SELECT credit_limit, credit_used FROM b2b_customers WHERE id = $1`,
          [customerId],
        );

        const creditLimit = parseFloat(customerResult[0]?.credit_limit) || 0;
        const usedCredit = parseFloat(customerResult[0]?.credit_used) || 0;

        const transactionId = `txn_${randomUUID()}`;
        await queryRunner.query(
          `INSERT INTO b2b_credit_transactions (
            id, customer_id, amount, type, description, order_id,
            balance_before, balance_after, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            transactionId,
            customerId,
            orderTotal,
            'RELEASE',
            `Order ${order.order_number} cancelled - Credit released`,
            id,
            creditLimit - usedCredit - orderTotal,
            creditLimit - usedCredit,
          ],
        );
      }

      await queryRunner.commitTransaction();

      res.status(200).json({
        success: true,
        data: {
          order_id: id,
          order_number: order.order_number,
          status: 'CANCELLED',
          credit_released: orderTotal,
          message: 'Order cancelled successfully',
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      next(error);
    } finally {
      await queryRunner.release();
    }
  }

  async importCSV(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req) ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No CSV file provided' },
        });
        return;
      }

      const MAX_FILE_SIZE = 1024 * 1024;
      if (req.file.size > MAX_FILE_SIZE) {
        res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds 1MB limit' },
        });
        return;
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'EMPTY_FILE', message: 'CSV file is empty' },
        });
        return;
      }

      const hasHeader =
        lines[0].toLowerCase().includes('sku') ||
        lines[0].toLowerCase().includes('cod') ||
        lines[0].toLowerCase().includes('product');

      const dataLines = hasHeader ? lines.slice(1) : lines;

      if (dataLines.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_DATA', message: 'CSV file has no data rows' },
        });
        return;
      }

      const MAX_ITEMS = 100;
      if (dataLines.length > MAX_ITEMS) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_ITEMS',
            message: `Maximum ${MAX_ITEMS} items allowed per import. Found: ${dataLines.length}`,
          },
        });
        return;
      }

      const customerResult = await this.dataSource.query(
        `SELECT id, tier, discount_percentage FROM b2b_customers WHERE id = $1`,
        [customerId],
      );

      if (customerResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'B2B customer not found' },
        });
        return;
      }

      const customer = customerResult[0];
      const tierDiscount = this.tierService.getDiscountForTier(customer.tier as any);
      const customerDiscount = parseFloat(customer.discount_percentage) || 0;
      const totalDiscountPercent = tierDiscount + customerDiscount / 100;

      const items: CSVImportItem[] = [];
      const parseErrors: Array<{ line: number; error: string }> = [];

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const lineNum = hasHeader ? i + 2 : i + 1;

        const separator = line.includes(';') ? ';' : ',';
        const parts = line.split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ''));

        if (parts.length < 2) {
          parseErrors.push({
            line: lineNum,
            error: 'Invalid format: need at least SKU and quantity',
          });
          continue;
        }

        const sku = parts[0];
        const quantityStr = parts[1];
        const notes = parts.length > 2 ? parts.slice(2).join(', ') : undefined;

        if (!sku) {
          parseErrors.push({ line: lineNum, error: 'SKU is required' });
          continue;
        }

        const quantity = parseInt(quantityStr, 10);
        if (isNaN(quantity) || quantity < 1) {
          parseErrors.push({
            line: lineNum,
            error: `Invalid quantity: "${quantityStr}" must be a positive number`,
          });
          continue;
        }

        items.push({ sku, quantity, notes });
      }

      if (parseErrors.length > 0 && items.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'PARSE_ERRORS',
            message: 'All rows have parsing errors',
            details: parseErrors,
          },
        });
        return;
      }

      const validItems: CSVImportResult['valid_items'] = [];
      const invalidItems: CSVImportResult['invalid_items'] = [];

      for (const item of items) {
        const productResult = await this.dataSource.query(
          `SELECT 
            p.id, p.sku, p.name, p.base_price, p.is_active,
            COALESCE(SUM(sl.quantity_available), 0) as stock_available
           FROM products p
           LEFT JOIN stock_levels sl ON p.id = sl.product_id
           WHERE LOWER(p.sku) = LOWER($1)
           GROUP BY p.id, p.sku, p.name, p.base_price, p.is_active`,
          [item.sku],
        );

        if (productResult.length === 0) {
          invalidItems.push({
            sku: item.sku,
            quantity: item.quantity,
            reason: 'Product not found',
            notes: item.notes,
          });
          continue;
        }

        const product = productResult[0];

        if (!product.is_active) {
          invalidItems.push({
            sku: item.sku,
            quantity: item.quantity,
            reason: 'Product is inactive',
            notes: item.notes,
          });
          continue;
        }

        const stockAvailable = parseInt(product.stock_available) || 0;
        const basePrice = parseFloat(product.base_price) || 0;
        const unitPrice = basePrice * (1 - totalDiscountPercent);

        if (stockAvailable < item.quantity) {
          invalidItems.push({
            sku: item.sku,
            quantity: item.quantity,
            reason: `Insufficient stock. Available: ${stockAvailable}`,
            notes: item.notes,
          });
          continue;
        }

        validItems.push({
          product_id: product.id,
          sku: product.sku,
          product_name: product.name,
          quantity: item.quantity,
          base_price: Math.round(basePrice * 100) / 100,
          unit_price: Math.round(unitPrice * 100) / 100,
          stock_available: stockAvailable,
          notes: item.notes,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          valid_items: validItems,
          invalid_items: invalidItems,
          parse_errors: parseErrors,
          total_items: items.length,
          valid_count: validItems.length,
          invalid_count: invalidItems.length,
          parse_error_count: parseErrors.length,
          tier_discount_percent: tierDiscount * 100,
          customer_discount_percent: customerDiscount,
          total_discount_percent: totalDiscountPercent * 100,
          subtotal:
            Math.round(
              validItems.reduce((sum, item) => sum + item.base_price * item.quantity, 0) * 100,
            ) / 100,
          subtotal_with_discount:
            Math.round(
              validItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) * 100,
            ) / 100,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async importCSVAddToCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const customerId = this.getB2BCustomerId(req) ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_ITEMS', message: 'No items provided' },
        });
        return;
      }

      const MAX_ITEMS = 100;
      if (items.length > MAX_ITEMS) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_ITEMS',
            message: `Maximum ${MAX_ITEMS} items allowed per import`,
          },
        });
        return;
      }

      const cartResult = await queryRunner.query(
        `SELECT id FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1`,
        [customerId],
      );

      let cartId: number;
      if (cartResult.length > 0) {
        cartId = cartResult[0].id;
      } else {
        const newCart = await queryRunner.query(
          `INSERT INTO b2b_cart (customer_id, name, is_active, created_at, updated_at)
           VALUES ($1, 'Default Cart', true, NOW(), NOW())
           RETURNING id`,
          [customerId],
        );
        cartId = newCart[0].id;
      }

      let addedCount = 0;
      let updatedCount = 0;
      const addedItems: Array<{
        product_id: number;
        sku: string;
        product_name: string;
        quantity: number;
        action: 'added' | 'updated';
      }> = [];

      for (const item of items) {
        const { product_id, quantity, notes } = item;

        const productResult = await queryRunner.query(
          `SELECT p.id, p.sku, p.name, p.is_active,
                  COALESCE(SUM(sl.quantity_available), 0) as stock_available
           FROM products p
           LEFT JOIN stock_levels sl ON p.id = sl.product_id
           WHERE p.id = $1
           GROUP BY p.id, p.sku, p.name, p.is_active`,
          [product_id],
        );

        if (productResult.length === 0 || !productResult[0].is_active) {
          continue;
        }

        const product = productResult[0];
        const stockAvailable = parseInt(product.stock_available) || 0;

        const existingItem = await queryRunner.query(
          `SELECT id, quantity FROM b2b_cart_items WHERE cart_id = $1 AND product_id = $2`,
          [cartId, product_id],
        );

        const newQuantity =
          existingItem.length > 0 ? existingItem[0].quantity + quantity : quantity;

        if (stockAvailable < newQuantity) {
          continue;
        }

        if (existingItem.length > 0) {
          await queryRunner.query(
            `UPDATE b2b_cart_items SET quantity = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3`,
            [newQuantity, notes || 'Added via CSV import', existingItem[0].id],
          );
          updatedCount++;
          addedItems.push({
            product_id: parseInt(product_id),
            sku: product.sku,
            product_name: product.name,
            quantity: newQuantity,
            action: 'updated',
          });
        } else {
          await queryRunner.query(
            `INSERT INTO b2b_cart_items (cart_id, product_id, quantity, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [cartId, product_id, quantity, notes || 'Added via CSV import'],
          );
          addedCount++;
          addedItems.push({
            product_id: parseInt(product_id),
            sku: product.sku,
            product_name: product.name,
            quantity: quantity,
            action: 'added',
          });
        }
      }

      await queryRunner.commitTransaction();

      res.status(200).json({
        success: true,
        data: {
          cart_id: cartId,
          added_count: addedCount,
          updated_count: updatedCount,
          total_processed: addedCount + updatedCount,
          items: addedItems,
          message: `Successfully added ${addedCount} items and updated ${updatedCount} items in cart`,
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      next(error);
    } finally {
      await queryRunner.release();
    }
  }

  async reorder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { add_to_cart = true } = req.query;

      const scopedB2BCustomerId = this.getB2BCustomerId(req);
      const customerId = scopedB2BCustomerId ?? (req.user as any)?.b2bCustomerId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer context required' },
        });
        return;
      }

      const orderResult = await this.dataSource.query(
        `SELECT o.id, o.order_number, o.customer_id, o.status
         FROM b2b_orders o
         WHERE o.id = $1 AND o.customer_id = $2`,
        [id, customerId],
      );

      if (orderResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
        return;
      }

      const order = orderResult[0];

      const items = await this.dataSource.query(
        `SELECT 
          oi.product_id, oi.sku, oi.product_name, oi.quantity, 
          oi.unit_price, p.is_active, p.base_price,
          COALESCE(SUM(sl.quantity_available), 0) as stock_available
         FROM b2b_order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         LEFT JOIN stock_levels sl ON p.id = sl.product_id
         WHERE oi.order_id = $1
         GROUP BY oi.id, oi.product_id, oi.sku, oi.product_name, oi.quantity, 
                  oi.unit_price, p.is_active, p.base_price`,
        [id],
      );

      if (items.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'EMPTY_ORDER', message: 'Original order has no items' },
        });
        return;
      }

      const unavailableItems: Array<{
        product_id: number;
        product_name: string;
        reason: string;
        requested: number;
        available: number;
      }> = [];

      const availableItems: Array<{
        product_id: number;
        sku: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        stock_available: number;
      }> = [];

      for (const item of items) {
        const stockAvailable = parseInt(item.stock_available) || 0;

        if (!item.is_active) {
          unavailableItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            reason: 'Product no longer available',
            requested: item.quantity,
            available: 0,
          });
        } else if (stockAvailable < item.quantity) {
          unavailableItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            reason: 'Insufficient stock',
            requested: item.quantity,
            available: stockAvailable,
          });
          if (stockAvailable > 0) {
            availableItems.push({
              product_id: item.product_id,
              sku: item.sku,
              product_name: item.product_name,
              quantity: stockAvailable,
              unit_price: parseFloat(item.base_price) || item.unit_price,
              stock_available: stockAvailable,
            });
          }
        } else {
          availableItems.push({
            product_id: item.product_id,
            sku: item.sku,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: parseFloat(item.base_price) || item.unit_price,
            stock_available: stockAvailable,
          });
        }
      }

      if (add_to_cart === 'true' || add_to_cart === true) {
        const cartResult = await this.dataSource.query(
          `SELECT id FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1`,
          [customerId],
        );

        let cartId: number;
        if (cartResult.length > 0) {
          cartId = cartResult[0].id;
        } else {
          const newCart = await this.dataSource.query(
            `INSERT INTO b2b_cart (customer_id, name, is_active, created_at, updated_at)
             VALUES ($1, 'Default Cart', true, NOW(), NOW())
             RETURNING id`,
            [customerId],
          );
          cartId = newCart[0].id;
        }

        for (const item of availableItems) {
          const existingItem = await this.dataSource.query(
            `SELECT id, quantity FROM b2b_cart_items WHERE cart_id = $1 AND product_id = $2`,
            [cartId, item.product_id],
          );

          if (existingItem.length > 0) {
            await this.dataSource.query(
              `UPDATE b2b_cart_items 
               SET quantity = quantity + $1, updated_at = NOW() 
               WHERE id = $2`,
              [item.quantity, existingItem[0].id],
            );
          } else {
            await this.dataSource.query(
              `INSERT INTO b2b_cart_items (cart_id, product_id, quantity, notes, created_at, updated_at)
               VALUES ($1, $2, $3, 'Added from reorder', NOW(), NOW())`,
              [cartId, item.product_id, item.quantity],
            );
          }
        }

        res.status(200).json({
          success: true,
          data: {
            original_order_id: parseInt(id),
            original_order_number: order.order_number,
            added_to_cart: true,
            cart_id: cartId,
            items_added: availableItems.length,
            total_quantity: availableItems.reduce((sum, item) => sum + item.quantity, 0),
            available_items: availableItems,
            unavailable_items: unavailableItems,
            message:
              unavailableItems.length > 0
                ? `${availableItems.length} items added to cart. ${unavailableItems.length} items unavailable.`
                : 'All items added to cart successfully',
          },
        });
      } else {
        res.status(200).json({
          success: true,
          data: {
            original_order_id: parseInt(id),
            original_order_number: order.order_number,
            added_to_cart: false,
            available_items: availableItems,
            unavailable_items: unavailableItems,
            total_available: availableItems.reduce((sum, item) => sum + item.quantity, 0),
            message:
              unavailableItems.length > 0
                ? `${availableItems.length} items available for reorder. ${unavailableItems.length} items unavailable.`
                : 'All items available for reorder',
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
}
