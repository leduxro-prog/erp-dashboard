/**
 * Financial Transaction Service
 *
 * Manages financial flow with:
 * - reserveCredit(orderId, amount) - Reserve credit for order
 * - createOrder(cartId, customerId) - Create order from cart
 * - captureCredit(orderId) - Capture reserved credit
 * - rollbackOrder(orderId) - Rollback on failure
 * - releaseCredit(orderId) - Release credit reservation
 */

import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TransactionManager, TransactionOptions, TransactionResult } from './TransactionManager';
import {
  CreditReservationEntity,
  CreditReservationStatus,
} from '../domain/entities/CreditReservationEntity';
import { CartEntity, CartStatus } from '../domain/entities/CartEntity';
import {
  ReserveCreditRequest,
  CreditReservationResult,
  CreateOrderFromCartRequest,
  OrderCreationResult,
  CaptureCreditRequest,
  CreditCaptureResult,
  ReleaseCreditRequest,
  CreditReleaseResult,
  RollbackOrderRequest,
  CreditLimitCheckResult,
} from '../domain/types/checkout.types';
import { B2BCustomerEntity } from '@modules/b2b-portal/src/infrastructure/entities/B2BCustomerEntity';
import { CreditTransactionEntity } from '@modules/b2b-portal/src/infrastructure/entities/CreditTransactionEntity';
import {
  OrderEntity,
  OrderStatus,
  PaymentStatus,
} from '@modules/orders/src/infrastructure/entities/OrderEntity';
import { OrderItemEntity } from '@modules/orders/src/infrastructure/entities/OrderItemEntity';
import logger from '@shared/utils/logger';

/**
 * Financial Transaction Service Configuration
 */
export interface FinancialTransactionServiceConfig {
  transactionManager: TransactionManager;
  reservationTimeoutMinutes?: number;
}

/**
 * Financial Transaction Service
 *
 * Handles all financial operations for checkout flow
 */
export class FinancialTransactionService {
  private readonly transactionManager: TransactionManager;
  private readonly reservationTimeoutMinutes: number;

  constructor(config: FinancialTransactionServiceConfig) {
    this.transactionManager = config.transactionManager;
    this.reservationTimeoutMinutes = config.reservationTimeoutMinutes ?? 30;
  }

  getDataSource(): DataSource {
    return this.transactionManager.getDataSource();
  }

  /**
   * Reserve credit for an order
   *
   * This operation:
   * 1. Validates customer credit limit
   * 2. Locks customer record for update
   * 3. Creates credit reservation
   * 4. Updates customer's used credit
   *
   * All operations are done within a single transaction for ACID compliance.
   *
   * @param request - Reserve credit request
   * @param options - Transaction options
   * @returns Credit reservation result
   */
  async reserveCredit(
    request: ReserveCreditRequest,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<CreditReservationResult>> {
    const txOptions: TransactionOptions = {
      ...options,
      metadata: {
        ...options.metadata,
        operation: 'reserveCredit',
      },
    };

    return this.transactionManager.executeInTransaction(async (em: EntityManager) => {
      // Step 1: Get customer with FOR UPDATE lock to prevent concurrent modifications
      const customer = await em.findOne(B2BCustomerEntity, {
        where: { id: request.customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!customer) {
        throw new Error(`Customer not found: ${request.customerId}`);
      }

      if (!customer.isActive) {
        throw new Error(`Customer is not active: ${request.customerId}`);
      }

      // Step 2: Check if order already has a reservation
      const existingReservation = await em.findOne(CreditReservationEntity, {
        where: { orderId: request.orderId, status: CreditReservationStatus.ACTIVE },
      });

      if (existingReservation) {
        logger.warn('Credit reservation already exists for order', {
          orderId: request.orderId,
          reservationId: existingReservation.id,
        });

        return {
          success: true,
          reservationId: existingReservation.id,
          availableCredit: customer.creditLimit - customer.usedCredit,
          reservedAmount: existingReservation.amount,
        };
      }

      // Step 3: Check credit limit
      const checkResult = this.checkCreditLimit(customer, request.amount);
      if (!checkResult.withinLimit) {
        throw new Error(
          `Insufficient credit. Available: ${checkResult.availableCredit}, Requested: ${checkResult.requestedAmount}`,
        );
      }

      // Step 4: Create credit reservation
      const reservationId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.reservationTimeoutMinutes * 60 * 1000);

      const balanceBefore = customer.usedCredit;
      const balanceAfter = balanceBefore + request.amount;

      const reservation = em.create(CreditReservationEntity, {
        id: reservationId,
        customerId: request.customerId,
        orderId: request.orderId,
        amount: request.amount,
        balanceBefore,
        balanceAfter,
        status: CreditReservationStatus.ACTIVE,
        reservedAt: now,
        expiresAt,
        notes: request.notes,
        createdBy: request.userId,
        metadata: {
          requestAmount: request.amount,
        },
      });

      await em.save(reservation);

      // Step 5: Update customer's used credit
      customer.usedCredit = balanceAfter;
      await em.save(customer);

      logger.info('Credit reserved successfully', {
        reservationId,
        orderId: request.orderId,
        customerId: request.customerId,
        amount: request.amount,
        balanceBefore,
        balanceAfter,
      });

      return {
        success: true,
        reservationId,
        availableCredit: customer.creditLimit - customer.usedCredit,
        reservedAmount: request.amount,
      };
    }, txOptions);
  }

  /**
   * Create an order from a cart
   *
   * This operation:
   * 1. Validates cart and locks it
   * 2. Creates order record
   * 3. Creates order items
   * 4. Updates cart status
   *
   * @param request - Create order request
   * @param options - Transaction options
   * @returns Order creation result
   */
  async createOrder(
    request: CreateOrderFromCartRequest,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<OrderCreationResult>> {
    const txOptions: TransactionOptions = {
      ...options,
      metadata: {
        ...options.metadata,
        operation: 'createOrder',
      },
    };

    return this.transactionManager.executeInTransaction(async (em: EntityManager) => {
      // Step 1: Get and lock cart
      const cart = await em.findOne(CartEntity, {
        where: { id: request.cartId, status: CartStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });

      if (!cart) {
        throw new Error(`Cart not found or not active: ${request.cartId}`);
      }

      if (cart.customerId && cart.customerId !== request.customerId) {
        throw new Error('Cart belongs to a different customer');
      }

      if (!cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      // Step 2: Generate order number
      const orderNumber = await this.generateOrderNumber(em);

      // Step 3: Create order
      const orderId = uuidv4();
      const now = new Date();
      const taxRate = cart.subtotal > 0 ? (cart.taxAmount / cart.subtotal) * 100 : 0;

      const order = em.create(OrderEntity, {
        id: orderId,
        order_number: orderNumber,
        customer_id: request.customerId,
        customer_name: await this.getCustomerName(em, request.customerId),
        customer_email: await this.getCustomerEmail(em, request.customerId),
        status: OrderStatus.ORDER_CONFIRMED,
        subtotal: cart.subtotal,
        discount_amount: cart.discountAmount,
        tax_rate: taxRate,
        tax_amount: cart.taxAmount,
        shipping_cost: cart.shippingCost,
        grand_total: cart.total,
        currency: 'RON',
        payment_terms: 'NET30',
        payment_status: PaymentStatus.UNPAID,
        notes: request.notes,
        billing_address: request.billingAddress,
        shipping_address: request.shippingAddress,
        created_by: request.userId,
      });

      await em.save(order);

      // Step 4: Create order items
      const orderItems = cart.items.map((item) => {
        return em.create(OrderItemEntity, {
          id: uuidv4(),
          order_id: orderId,
          product_id: item.productId,
          product_name: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.totalPrice,
        });
      });

      await em.save(orderItems);

      // Step 5: Update cart status
      cart.status = CartStatus.CONVERTED;
      cart.orderId = orderId;
      await em.save(cart);

      logger.info('Order created from cart', {
        orderId,
        orderNumber,
        cartId: request.cartId,
        customerId: request.customerId,
        itemCount: cart.items.length,
        total: cart.total,
      });

      return {
        success: true,
        orderId,
        orderNumber,
      };
    }, txOptions);
  }

  /**
   * Capture reserved credit for an order
   *
   * This operation:
   * 1. Finds the active reservation
   * 2. Creates credit transaction
   * 3. Updates reservation status
   * 4. Updates order payment status
   *
   * @param request - Capture credit request
   * @param options - Transaction options
   * @returns Credit capture result
   */
  async captureCredit(
    request: CaptureCreditRequest,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<CreditCaptureResult>> {
    const txOptions: TransactionOptions = {
      ...options,
      metadata: {
        ...options.metadata,
        operation: 'captureCredit',
      },
    };

    return this.transactionManager.executeInTransaction(async (em: EntityManager) => {
      // Step 1: Find active reservation
      const reservation = await em.findOne(CreditReservationEntity, {
        where: { orderId: request.orderId, status: CreditReservationStatus.ACTIVE },
      });

      if (!reservation) {
        throw new Error(`No active credit reservation found for order: ${request.orderId}`);
      }

      // Step 2: Check if reservation has expired
      if (new Date() > reservation.expiresAt) {
        // Mark as expired
        reservation.status = CreditReservationStatus.EXPIRED;
        await em.save(reservation);

        // Release credit back to customer
        await this.releaseCreditInternal(
          em,
          request.orderId,
          reservation.customerId,
          'Reservation expired during capture',
        );

        throw new Error(`Credit reservation has expired for order: ${request.orderId}`);
      }

      // Step 3: Get customer with lock
      const customer = await em.findOne(B2BCustomerEntity, {
        where: { id: reservation.customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!customer) {
        throw new Error(`Customer not found: ${reservation.customerId}`);
      }

      // Step 4: Create credit transaction
      const transactionId = uuidv4();
      const now = new Date();

      const balanceBefore = customer.usedCredit;
      // Balance doesn't change on capture (credit was already reserved)
      const balanceAfter = balanceBefore;

      const creditTransaction = em.create(CreditTransactionEntity, {
        id: transactionId,
        customerId: reservation.customerId,
        type: 'DEBIT',
        amount: reservation.amount,
        balanceBefore,
        balanceAfter,
        description: `Order payment - ${request.orderId}`,
        referenceId: request.orderId,
        referenceType: 'ORDER',
        createdBy: request.userId,
        metadata: {
          reservationId: reservation.id,
          orderId: request.orderId,
          notes: request.notes,
        },
      });

      await em.save(creditTransaction);

      // Step 5: Update reservation status
      reservation.status = CreditReservationStatus.CAPTURED;
      reservation.capturedAt = now;
      await em.save(reservation);

      // Step 6: Update order payment status
      const order = await em.findOne(OrderEntity, { where: { id: request.orderId } });
      if (order) {
        order.payment_status = PaymentStatus.PAID;
        await em.save(order);
      }

      logger.info('Credit captured successfully', {
        transactionId,
        reservationId: reservation.id,
        orderId: request.orderId,
        customerId: reservation.customerId,
        amount: reservation.amount,
      });

      return {
        success: true,
        transactionId,
        capturedAmount: reservation.amount,
        remainingCredit: customer.creditLimit - customer.usedCredit,
      };
    }, txOptions);
  }

  /**
   * Rollback an order and release reserved resources
   *
   * This operation:
   * 1. Cancels the order
   * 2. Releases credit reservation if active
   * 3. Releases stock reservation if exists
   *
   * @param request - Rollback order request
   * @param options - Transaction options
   * @returns Rollback result
   */
  async rollbackOrder(
    request: RollbackOrderRequest,
    options: TransactionOptions = {},
  ): Promise<
    TransactionResult<{ orderId: string; creditReleased?: number; stockReleased?: boolean }>
  > {
    const txOptions: TransactionOptions = {
      ...options,
      metadata: {
        ...options.metadata,
        operation: 'rollbackOrder',
      },
    };

    return this.transactionManager.executeInTransaction(async (em: EntityManager) => {
      // Step 1: Get order
      const order = await em.findOne(OrderEntity, { where: { id: request.orderId } });

      if (!order) {
        throw new Error(`Order not found: ${request.orderId}`);
      }

      let creditReleased = 0;
      let stockReleased = false;

      // Step 2: Release credit if requested
      if (request.releaseCredit !== false) {
        const releaseResult = await this.releaseCreditInternal(
          em,
          request.orderId,
          undefined,
          request.reason,
        );
        creditReleased = releaseResult;
      }

      // Step 3: Release stock if requested
      if (request.releaseStock !== false) {
        stockReleased = await this.releaseStockInternal(em, request.orderId, request.reason);
      }

      // Step 4: Update order status
      order.status = OrderStatus.CANCELLED;
      await em.save(order);

      logger.info('Order rolled back successfully', {
        orderId: request.orderId,
        reason: request.reason,
        creditReleased,
        stockReleased,
      });

      return {
        orderId: request.orderId,
        creditReleased,
        stockReleased,
      };
    }, txOptions);
  }

  /**
   * Release credit reservation
   *
   * @param request - Release credit request
   * @param options - Transaction options
   * @returns Credit release result
   */
  async releaseCredit(
    request: ReleaseCreditRequest,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<CreditReleaseResult>> {
    const txOptions: TransactionOptions = {
      ...options,
      metadata: {
        ...options.metadata,
        operation: 'releaseCredit',
      },
    };

    return this.transactionManager.executeInTransaction(async (em: EntityManager) => {
      const releasedAmount = await this.releaseCreditInternal(
        em,
        request.orderId,
        undefined,
        request.reason,
      );

      if (releasedAmount === 0) {
        throw new Error(`No active credit reservation found for order: ${request.orderId}`);
      }

      // Get customer credit info
      const reservation = await em.findOne(CreditReservationEntity, {
        where: { orderId: request.orderId, status: CreditReservationStatus.RELEASED },
      });

      let availableCredit = 0;
      if (reservation) {
        const customer = await em.findOne(B2BCustomerEntity, {
          where: { id: reservation.customerId },
        });
        if (customer) {
          availableCredit = customer.creditLimit - customer.usedCredit;
        }
      }

      logger.info('Credit released successfully', {
        orderId: request.orderId,
        releasedAmount,
        availableCredit,
      });

      return {
        success: true,
        releasedAmount,
        availableCredit,
      };
    }, txOptions);
  }

  /**
   * Check customer credit limit
   *
   * @param customerId - Customer ID
   * @param amount - Amount to reserve
   * @returns Credit limit check result
   */
  async checkCreditLimitForCustomer(
    customerId: string,
    amount: number,
  ): Promise<CreditLimitCheckResult> {
    const customer = await this.transactionManager
      .getDataSource()
      .getRepository(B2BCustomerEntity)
      .findOne({ where: { id: customerId } });

    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    return this.checkCreditLimit(customer, amount);
  }

  /**
   * Internal method to check credit limit
   */
  private checkCreditLimit(customer: B2BCustomerEntity, amount: number): CreditLimitCheckResult {
    const availableCredit = customer.creditLimit - customer.usedCredit;

    return {
      withinLimit: amount <= availableCredit,
      availableCredit,
      requestedAmount: amount,
      creditLimit: customer.creditLimit,
      usedCredit: customer.usedCredit,
    };
  }

  /**
   * Internal method to release credit
   */
  private async releaseCreditInternal(
    em: EntityManager,
    orderId: string,
    customerId?: string,
    reason?: string,
  ): Promise<number> {
    // Find active reservation
    const reservation = await em.findOne(CreditReservationEntity, {
      where: { orderId, status: CreditReservationStatus.ACTIVE },
    });

    if (!reservation) {
      return 0;
    }

    const targetCustomerId = customerId || reservation.customerId;

    // Get customer with lock
    const customer = await em.findOne(B2BCustomerEntity, {
      where: { id: targetCustomerId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!customer) {
      throw new Error(`Customer not found: ${targetCustomerId}`);
    }

    // Create reversal transaction
    const transactionId = uuidv4();
    const now = new Date();

    const balanceBefore = customer.usedCredit;
    const balanceAfter = balanceBefore - reservation.amount;

    const creditTransaction = em.create(CreditTransactionEntity, {
      id: transactionId,
      customerId: targetCustomerId,
      type: 'CREDIT',
      amount: reservation.amount,
      balanceBefore,
      balanceAfter,
      description: reason || `Credit release - ${orderId}`,
      referenceId: orderId,
      referenceType: 'ORDER',
      metadata: {
        reservationId: reservation.id,
        reason,
      },
    });

    await em.save(creditTransaction);

    // Update customer's used credit
    customer.usedCredit = balanceAfter;
    await em.save(customer);

    // Update reservation status
    reservation.status = CreditReservationStatus.RELEASED;
    reservation.releasedAt = now;
    await em.save(reservation);

    return reservation.amount;
  }

  /**
   * Internal method to release stock
   */
  private async releaseStockInternal(
    em: EntityManager,
    orderId: string,
    reason?: string,
  ): Promise<boolean> {
    // This would integrate with the stock reservation system
    // For now, return true to indicate successful release
    // TODO: Implement actual stock reservation release
    logger.info('Stock release would be performed', { orderId, reason });
    return true;
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(em: EntityManager): Promise<string> {
    const prefix = 'ORD';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Find last order number for today
    const lastOrder = await em
      .getRepository(OrderEntity)
      .createQueryBuilder('order')
      .where('order.order_number LIKE :pattern', { pattern: `${prefix}${dateStr}%` })
      .orderBy('order.order_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastOrder && lastOrder.order_number) {
      const lastSequence = parseInt(lastOrder.order_number.slice(-6), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    const sequenceStr = sequence.toString().padStart(6, '0');
    return `${prefix}${dateStr}${sequenceStr}`;
  }

  /**
   * Get customer name
   */
  private async getCustomerName(em: EntityManager, customerId: string): Promise<string> {
    const customer = await em.findOne(B2BCustomerEntity, { where: { id: customerId } });
    return customer?.companyName || 'Unknown Customer';
  }

  /**
   * Get customer email
   */
  private async getCustomerEmail(em: EntityManager, customerId: string): Promise<string> {
    // This would get the email from the customer/user entity
    // For now, return a placeholder
    return `customer-${customerId}@example.com`;
  }
}

export default FinancialTransactionService;
