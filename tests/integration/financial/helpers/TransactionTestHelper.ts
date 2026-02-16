/**
 * Transaction Test Helper
 *
 * Utilities for transaction testing including:
 * - Database fixtures
 * - Test data setup/teardown
 * - Mock data generation
 * - Assertion helpers
 */

import { DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { B2BCustomerEntity } from '@modules/b2b-portal/src/infrastructure/entities/B2BCustomerEntity';
import { CreditTransactionEntity } from '@modules/b2b-portal/src/infrastructure/entities/CreditTransactionEntity';
import { CartEntity, CartStatus, CartItem } from '@modules/checkout/src/domain/entities/CartEntity';
import {
  CreditReservationEntity,
  CreditReservationStatus,
} from '@modules/checkout/src/domain/entities/CreditReservationEntity';
import {
  OrderEntity,
  OrderStatus,
  PaymentStatus,
} from '@modules/orders/src/infrastructure/entities/OrderEntity';
import { OrderItemEntity } from '@modules/orders/src/infrastructure/entities/OrderItemEntity';
import {
  CreditReservationResult,
  OrderCreationResult,
  CreditCaptureResult,
  CreditReleaseResult,
} from '@modules/checkout/src/domain/types/checkout.types';

/**
 * Test fixture data
 */
export interface TestFixtures {
  customers: B2BCustomerEntity[];
  carts: CartEntity[];
  orders: OrderEntity[];
}

/**
 * Transaction test helper
 */
export class TransactionTestHelper {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Create a test B2B customer
   */
  async createTestCustomer(overrides?: Partial<B2BCustomerEntity>): Promise<B2BCustomerEntity> {
    const customerId = uuidv4();

    const customer = this.dataSource.getRepository(B2BCustomerEntity).create({
      id: customerId,
      registrationId: uuidv4(),
      companyName: `Test Company ${customerId.slice(0, 8)}`,
      cui: 'RO12345678',
      tier: 'STANDARD',
      creditLimit: 10000,
      usedCredit: 0,
      paymentTermsDays: 30,
      isActive: true,
      totalOrders: 0,
      totalSpent: 0,
      ...overrides,
    });

    await this.dataSource.getRepository(B2BCustomerEntity).save(customer);
    return customer;
  }

  /**
   * Create a test cart
   */
  async createTestCart(customerId: string, overrides?: Partial<CartEntity>): Promise<CartEntity> {
    const cartId = uuidv4();
    const items: CartItem[] = [
      {
        productId: uuidv4(),
        productName: 'Test Product 1',
        sku: 'TP001',
        quantity: 2,
        unitPrice: 100,
        totalPrice: 200,
      },
      {
        productId: uuidv4(),
        productName: 'Test Product 2',
        sku: 'TP002',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
      },
    ];

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0.21;
    const taxAmount = subtotal * taxRate;
    const shippingCost = 20;
    const total = subtotal + taxAmount + shippingCost;

    const cart = this.dataSource.getRepository(CartEntity).create({
      id: cartId,
      customerId,
      sessionId: null,
      status: CartStatus.ACTIVE,
      items,
      subtotal,
      discountRate: 0,
      discountAmount: 0,
      taxRate,
      taxAmount,
      shippingCost,
      total,
      metadata: {},
      ...overrides,
    });

    await this.dataSource.getRepository(CartEntity).save(cart);
    return cart;
  }

  /**
   * Create a test order
   */
  async createTestOrder(
    customerId: string,
    overrides?: Partial<OrderEntity>,
  ): Promise<OrderEntity> {
    const orderId = uuidv4();
    const orderNumber = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8)}`;

    const order = this.dataSource.getRepository(OrderEntity).create({
      id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      status: OrderStatus.ORDER_CONFIRMED,
      subtotal: 350,
      discount_amount: 0,
      tax_rate: 0.21,
      tax_amount: 66.5,
      shipping_cost: 20,
      grand_total: 436.5,
      currency: 'RON',
      payment_terms: 'NET30',
      payment_status: PaymentStatus.UNPAID,
      ...overrides,
    });

    await this.dataSource.getRepository(OrderEntity).save(order);
    return order;
  }

  /**
   * Create a test credit reservation
   */
  async createTestCreditReservation(
    customerId: string,
    orderId: string,
    amount: number,
    overrides?: Partial<CreditReservationEntity>,
  ): Promise<CreditReservationEntity> {
    const reservationId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    const reservation = this.dataSource.getRepository(CreditReservationEntity).create({
      id: reservationId,
      customerId,
      orderId,
      amount,
      balanceBefore: 0,
      balanceAfter: amount,
      status: CreditReservationStatus.ACTIVE,
      reservedAt: now,
      expiresAt,
      metadata: {},
      ...overrides,
    });

    await this.dataSource.getRepository(CreditReservationEntity).save(reservation);
    return reservation;
  }

  /**
   * Create complete test fixtures
   */
  async createFixtures(
    options: {
      customerCount?: number;
      cartCount?: number;
      orderCount?: number;
    } = {},
  ): Promise<TestFixtures> {
    const { customerCount = 1, cartCount = 1, orderCount = 0 } = options;

    const fixtures: TestFixtures = {
      customers: [],
      carts: [],
      orders: [],
    };

    // Create customers
    for (let i = 0; i < customerCount; i++) {
      const customer = await this.createTestCustomer({
        creditLimit: 10000 + i * 5000,
        companyName: `Test Company ${i + 1}`,
      });
      fixtures.customers.push(customer);
    }

    // Create carts
    for (let i = 0; i < cartCount; i++) {
      const customerId = fixtures.customers[i % fixtures.customers.length].id;
      const cart = await this.createTestCart(customerId);
      fixtures.carts.push(cart);
    }

    // Create orders
    for (let i = 0; i < orderCount; i++) {
      const customerId = fixtures.customers[i % fixtures.customers.length].id;
      const order = await this.createTestOrder(customerId);
      fixtures.orders.push(order);
    }

    return fixtures;
  }

  /**
   * Clear all test data
   */
  async clearFixtures(): Promise<void> {
    const repositories = [
      this.dataSource.getRepository(CreditReservationEntity),
      this.dataSource.getRepository(CartEntity),
      this.dataSource.getRepository(OrderItemEntity),
      this.dataSource.getRepository(OrderEntity),
      this.dataSource.getRepository(CreditTransactionEntity),
      this.dataSource.getRepository(B2BCustomerEntity),
    ];

    for (const repo of repositories) {
      await repo.clear();
    }
  }

  /**
   * Assert credit reservation result
   */
  assertCreditReservationResult(result: CreditReservationResult, expectedSuccess: boolean = true) {
    expect(result.success).toBe(expectedSuccess);

    if (expectedSuccess) {
      expect(result.reservationId).toBeDefined();
      expect(result.availableCredit).toBeGreaterThanOrEqual(0);
      expect(result.reservedAmount).toBeGreaterThan(0);
    } else {
      expect(result.error).toBeDefined();
    }
  }

  /**
   * Assert order creation result
   */
  assertOrderCreationResult(result: OrderCreationResult, expectedSuccess: boolean = true) {
    expect(result.success).toBe(expectedSuccess);

    if (expectedSuccess) {
      expect(result.orderId).toBeDefined();
      expect(result.orderNumber).toBeDefined();
      expect(result.orderNumber).toMatch(/^ORD\d{8}\d{6}$/);
    } else {
      expect(result.error).toBeDefined();
    }
  }

  /**
   * Assert credit capture result
   */
  assertCreditCaptureResult(result: CreditCaptureResult, expectedSuccess: boolean = true) {
    expect(result.success).toBe(expectedSuccess);

    if (expectedSuccess) {
      expect(result.transactionId).toBeDefined();
      expect(result.capturedAmount).toBeGreaterThan(0);
      expect(result.remainingCredit).toBeGreaterThanOrEqual(0);
    } else {
      expect(result.error).toBeDefined();
    }
  }

  /**
   * Assert credit release result
   */
  assertCreditReleaseResult(result: CreditReleaseResult, expectedSuccess: boolean = true) {
    expect(result.success).toBe(expectedSuccess);

    if (expectedSuccess) {
      expect(result.releasedAmount).toBeGreaterThan(0);
      expect(result.availableCredit).toBeGreaterThanOrEqual(0);
    } else {
      expect(result.error).toBeDefined();
    }
  }

  /**
   * Verify customer credit state
   */
  async verifyCustomerCredit(
    customerId: string,
    expectedCreditLimit: number,
    expectedUsedCredit: number,
  ): Promise<void> {
    const customer = await this.dataSource.getRepository(B2BCustomerEntity).findOne({
      where: { id: customerId },
    });

    expect(customer).toBeDefined();
    expect(customer?.creditLimit).toBe(expectedCreditLimit);
    expect(customer?.usedCredit).toBe(expectedUsedCredit);
    expect(customer?.creditLimit - customer?.usedCredit).toBeGreaterThanOrEqual(0);
  }

  /**
   * Verify reservation status
   */
  async verifyReservationStatus(
    orderId: string,
    expectedStatus: CreditReservationStatus,
  ): Promise<void> {
    const reservation = await this.dataSource.getRepository(CreditReservationEntity).findOne({
      where: { orderId },
    });

    expect(reservation).toBeDefined();
    expect(reservation?.status).toBe(expectedStatus);
  }

  /**
   * Verify order status
   */
  async verifyOrderStatus(orderId: string, expectedStatus: OrderStatus): Promise<void> {
    const order = await this.dataSource.getRepository(OrderEntity).findOne({
      where: { id: orderId },
    });

    expect(order).toBeDefined();
    expect(order?.status).toBe(expectedStatus);
  }

  /**
   * Verify order payment status
   */
  async verifyOrderPaymentStatus(orderId: string, expectedStatus: PaymentStatus): Promise<void> {
    const order = await this.dataSource.getRepository(OrderEntity).findOne({
      where: { id: orderId },
    });

    expect(order).toBeDefined();
    expect(order?.payment_status).toBe(expectedStatus);
  }

  /**
   * Count credit transactions for order
   */
  async countCreditTransactions(orderId: string): Promise<number> {
    return this.dataSource.getRepository(CreditTransactionEntity).count({
      where: { referenceId: orderId },
    });
  }

  /**
   * Simulate database failure for fault injection tests
   */
  async simulateDatabaseFailure(entityManager: EntityManager): Promise<void> {
    // Force an error by trying to insert invalid data
    await entityManager.query('SELECT 1/0'); // Division by zero
  }

  /**
   * Simulate deadlock for concurrency tests
   */
  async simulateDeadlock(transactionId: string): Promise<void> {
    // This would involve creating competing transactions
    // For now, it's a placeholder
    console.log(`Simulating deadlock for ${transactionId}`);
  }

  /**
   * Wait for a condition to be true
   */
  async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.sleep(interval);
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate random UUID
   */
  generateId(): string {
    return uuidv4();
  }
}

/**
 * Create a mock TransactionManager for testing
 */
export class MockTransactionManager {
  private readonly results: Map<string, any> = new Map();
  private shouldFailOnStep: Set<string> = new Set();
  private callLog: Array<{ step: string; timestamp: Date }> = [];

  setStepResult(step: string, result: any): void {
    this.results.set(step, result);
  }

  setStepFailure(step: string): void {
    this.shouldFailOnStep.add(step);
  }

  getCallLog(): Array<{ step: string; timestamp: Date }> {
    return [...this.callLog];
  }

  clear(): void {
    this.results.clear();
    this.shouldFailOnStep.clear();
    this.callLog = [];
  }

  async executeInTransaction<T>(
    callback: (em: any) => Promise<T>,
    options: any = {},
  ): Promise<any> {
    const step = options.metadata?.operation || 'unknown';
    this.callLog.push({ step, timestamp: new Date() });

    if (this.shouldFailOnStep.has(step)) {
      throw new Error(`Mock failure on step: ${step}`);
    }

    const result = this.results.get(step);
    if (result !== undefined) {
      return result;
    }

    // Default behavior
    return callback({} as any);
  }
}

export default TransactionTestHelper;
