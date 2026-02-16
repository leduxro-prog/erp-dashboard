import { DataSource } from 'typeorm';
import { CreditService } from './CreditService';
import { InsufficientCreditError, CustomerSuspendedError } from '../errors/b2b.errors';
import { ValidationError } from '@shared/errors/BaseError';
import { VAT_RATE } from '@shared/constants';

export interface CheckoutItem {
  product_id: number;
  sku?: string;
  quantity: number;
  price: number;
}

export interface CheckoutAddress {
  street: string;
  city: string;
  state?: string;
  postal_code: string;
  country?: string;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  shipping_address: CheckoutAddress | string;
  billing_address?: CheckoutAddress | string;
  use_different_billing?: boolean;
  contact_name: string;
  contact_phone: string;
  payment_method: 'CREDIT' | 'TRANSFER' | 'CASH';
  notes?: string;
  purchase_order_number?: string;
  save_address?: boolean;
  address_label?: string;
}

export interface StockValidationResult {
  valid: boolean;
  errors: Array<{
    product_id: number;
    product_name?: string;
    requested: number;
    available: number;
  }>;
}

export interface CheckoutResult {
  order_id: number;
  order_number: string;
  customer_id: number;
  status: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  payment_method: string;
  payment_due_date: string;
  payment_terms_days: number;
  created_at: Date;
  items: Array<{
    product_id: number;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export class B2BCheckoutService {
  private creditService: CreditService;

  constructor(private dataSource: DataSource) {
    this.creditService = new CreditService();
  }

  async validateStock(items: CheckoutItem[]): Promise<StockValidationResult> {
    const errors: StockValidationResult['errors'] = [];

    for (const item of items) {
      const stockResult = await this.dataSource.query(
        `SELECT 
          p.id, p.name, p.sku,
          COALESCE(SUM(sl.quantity_available), 0) as stock_available
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.id = $1
        GROUP BY p.id, p.name, p.sku`,
        [item.product_id],
      );

      if (stockResult.length === 0) {
        errors.push({
          product_id: item.product_id,
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      const product = stockResult[0];
      const stockAvailable = parseInt(product.stock_available) || 0;

      if (stockAvailable < item.quantity) {
        errors.push({
          product_id: item.product_id,
          product_name: product.name,
          requested: item.quantity,
          available: stockAvailable,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateCredit(
    customerId: number,
    amount: number,
  ): Promise<{
    valid: boolean;
    credit_limit: number;
    credit_used: number;
    credit_available: number;
    error?: string;
  }> {
    const customerResult = await this.dataSource.query(
      `SELECT id, company_name, tier, credit_limit, credit_used, payment_terms_days, status
       FROM b2b_customers
       WHERE id = $1`,
      [customerId],
    );

    if (customerResult.length === 0) {
      return {
        valid: false,
        credit_limit: 0,
        credit_used: 0,
        credit_available: 0,
        error: 'Customer not found',
      };
    }

    const customer = customerResult[0];

    if (customer.status !== 'ACTIVE') {
      return {
        valid: false,
        credit_limit: customer.credit_limit,
        credit_used: customer.credit_used,
        credit_available: 0,
        error: 'Customer account is not active',
      };
    }

    const creditAvailable = parseFloat(customer.credit_limit) - parseFloat(customer.credit_used);

    if (creditAvailable < amount) {
      return {
        valid: false,
        credit_limit: parseFloat(customer.credit_limit),
        credit_used: parseFloat(customer.credit_used),
        credit_available: creditAvailable,
        error: `Insufficient credit. Available: ${creditAvailable.toFixed(2)} RON, Required: ${amount.toFixed(2)} RON`,
      };
    }

    return {
      valid: true,
      credit_limit: parseFloat(customer.credit_limit),
      credit_used: parseFloat(customer.credit_used),
      credit_available: creditAvailable,
    };
  }

  generateOrderNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `B2B-${year}${month}${day}-${random}`;
  }

  calculatePaymentDueDate(paymentTermsDays: number): Date {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    return dueDate;
  }

  formatAddress(address: CheckoutAddress | string): string {
    if (typeof address === 'string') {
      return address;
    }
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country || 'Romania',
    ].filter(Boolean);
    return parts.join(', ');
  }

  async processCheckout(
    customerId: number,
    request: CheckoutRequest,
    userId?: string | number,
  ): Promise<CheckoutResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const customerResult = await queryRunner.query(
        `SELECT id, company_name, tier, credit_limit, credit_used, payment_terms_days, 
                status, discount_percentage, email, contact_person
         FROM b2b_customers
         WHERE id = $1
         FOR UPDATE`,
        [customerId],
      );

      if (customerResult.length === 0) {
        throw new ValidationError('B2B Customer not found');
      }

      const customer = customerResult[0];

      if (customer.status !== 'ACTIVE') {
        throw new CustomerSuspendedError(customerId.toString());
      }

      const stockValidation = await this.validateStock(request.items);
      if (!stockValidation.valid) {
        throw new ValidationError(
          `Insufficient stock for ${stockValidation.errors.length} item(s): ${JSON.stringify(stockValidation.errors)}`,
        );
      }

      const subtotal = request.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const discountPercent = parseFloat(customer.discount_percentage) || 0;
      const discountAmount = subtotal * (discountPercent / 100);
      const subtotalAfterDiscount = subtotal - discountAmount;
      const vatAmount = subtotalAfterDiscount * VAT_RATE;
      const total = subtotalAfterDiscount + vatAmount;

      const creditValidation = await this.validateCredit(customerId, total);
      if (!creditValidation.valid) {
        throw new InsufficientCreditError(creditValidation.credit_available, total);
      }

      const paymentTermsDays = parseInt(customer.payment_terms_days) || 30;
      const paymentDueDate = this.calculatePaymentDueDate(paymentTermsDays);
      const orderNumber = this.generateOrderNumber();

      const shippingAddressStr = this.formatAddress(request.shipping_address);
      const billingAddressStr =
        request.use_different_billing && request.billing_address
          ? this.formatAddress(request.billing_address)
          : shippingAddressStr;

      const orderResult = await queryRunner.query(
        `INSERT INTO b2b_orders (
          order_number, customer_id, status, order_type,
          subtotal, discount_amount, vat_amount, total, currency_code,
          payment_method, payment_status, payment_due_date,
          shipping_address, billing_address, notes, created_by,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING id, order_number, status, created_at`,
        [
          orderNumber,
          customerId,
          'PENDING',
          'STANDARD',
          subtotal,
          discountAmount,
          vatAmount,
          total,
          'RON',
          request.payment_method,
          'UNPAID',
          paymentDueDate,
          shippingAddressStr,
          billingAddressStr,
          request.notes || '',
          userId || 'system',
        ],
      );

      const order = orderResult[0];

      const orderItems: CheckoutResult['items'] = [];
      for (const item of request.items) {
        const productResult = await queryRunner.query(
          `SELECT name, sku, base_price, metadata FROM products WHERE id = $1`,
          [item.product_id],
        );

        const product = productResult[0] || { name: 'Unknown Product', sku: item.sku || '' };
        const itemTotal = item.price * item.quantity;

        // Snapshot cost at time of sale
        const meta = product.metadata
          ? typeof product.metadata === 'string'
            ? JSON.parse(product.metadata)
            : product.metadata
          : {};
        const metadataCost = meta?.cost != null ? parseFloat(meta.cost) : null;
        const estimatedCost = product.base_price ? parseFloat(product.base_price) * 0.7 : null;
        const costPriceSnapshot = metadataCost ?? estimatedCost;
        const costSource =
          metadataCost != null
            ? meta?.cost_source || 'metadata'
            : estimatedCost != null
              ? 'estimated'
              : null;

        await queryRunner.query(
          `INSERT INTO b2b_order_items (
            order_id, product_id, sku, product_name, quantity,
            unit_price, discount_percent, total_price, stock_source,
            cost_price_snapshot, cost_source, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [
            order.id,
            item.product_id,
            item.sku || product.sku,
            product.name,
            item.quantity,
            item.price,
            discountPercent,
            itemTotal,
            'LOCAL',
            costPriceSnapshot,
            costSource,
          ],
        );

        orderItems.push({
          product_id: item.product_id,
          product_name: product.name,
          sku: item.sku || product.sku,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: itemTotal,
        });
      }

      // Deduct stock for each ordered item
      for (const item of request.items) {
        await queryRunner.query(
          `UPDATE stock_levels
           SET quantity_available = quantity_available - $1,
               updated_at = NOW()
           WHERE product_id = $2
           AND id = (
             SELECT id FROM stock_levels
             WHERE product_id = $2 AND quantity_available >= $1
             LIMIT 1
           )`,
          [item.quantity, item.product_id],
        );
      }

      const newCreditUsed = parseFloat(customer.credit_used) + total;
      await queryRunner.query(
        `UPDATE b2b_customers 
         SET credit_used = $1, 
             last_order_at = NOW(), 
             total_orders = total_orders + 1, 
             total_spent = total_spent + $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newCreditUsed, total, customerId],
      );

      if (request.save_address && request.address_label) {
        await this.saveCustomerAddress(
          customerId,
          request.address_label,
          request.shipping_address,
          'shipping',
        );
      }

      await queryRunner.commitTransaction();

      return {
        order_id: order.id,
        order_number: order.order_number,
        customer_id: customerId,
        status: order.status,
        subtotal,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        total,
        payment_method: request.payment_method,
        payment_due_date: paymentDueDate.toISOString(),
        payment_terms_days: paymentTermsDays,
        created_at: order.created_at,
        items: orderItems,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async saveCustomerAddress(
    customerId: number,
    label: string,
    address: CheckoutAddress | string,
    addressType: 'shipping' | 'billing' | 'both' = 'both',
  ): Promise<void> {
    const addressStr = this.formatAddress(address);

    const existingResult = await this.dataSource.query(
      `SELECT id FROM customer_addresses 
       WHERE customer_id = $1 AND label = $2`,
      [customerId, label],
    );

    if (existingResult.length > 0) {
      await this.dataSource.query(
        `UPDATE customer_addresses 
         SET address = $1, address_type = $2, updated_at = NOW()
         WHERE customer_id = $3 AND label = $4`,
        [addressStr, addressType, customerId, label],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO customer_addresses (customer_id, label, address, address_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [customerId, label, addressStr, addressType],
      );
    }
  }

  async getCustomerAddresses(customerId: number): Promise<
    Array<{
      id: number;
      label: string;
      address: string;
      address_type: string;
      is_default: boolean;
    }>
  > {
    const result = await this.dataSource.query(
      `SELECT id, label, address, address_type, is_default
       FROM customer_addresses
       WHERE customer_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [customerId],
    );

    return result;
  }

  async getCustomerProfile(customerId: number): Promise<{
    id: number;
    company_name: string;
    tier: string;
    credit_limit: number;
    credit_used: number;
    credit_available: number;
    payment_terms_days: number;
    discount_percentage: number;
  } | null> {
    const result = await this.dataSource.query(
      `SELECT id, company_name, tier, credit_limit, credit_used,
              (credit_limit - credit_used) as credit_available,
              payment_terms_days, discount_percentage
       FROM b2b_customers
       WHERE id = $1`,
      [customerId],
    );

    return result[0] || null;
  }
}
