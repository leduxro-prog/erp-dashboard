/**
 * Checkout Flow Transaction Tests
 *
 * End-to-end flow tests for the checkout transaction system:
 * - Normal checkout flow (happy path)
 * - Credit reserve failure (rollback)
 * - Order creation failure (credit released)
 * - Credit capture failure (order cancelled, credit released)
 * - Concurrent checkout attempts (race condition)
 * - Database connection failure during transaction
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { TransactionManager } from '@modules/checkout/src/services/TransactionManager';
import { FinancialTransactionService } from '@modules/checkout/src/services/FinancialTransactionService';
import { TransactionOrchestrator } from '@modules/checkout/src/services/TransactionOrchestrator';
import { TransactionTestHelper } from './helpers';
import { getTestDataSource, clearTestData } from './setup';

describe('Checkout Flow Transaction Tests', () => {
  let dataSource: DataSource;
  let transactionManager: TransactionManager;
  let financialService: FinancialTransactionService;
  let orchestrator: TransactionOrchestrator;
  let helper: TransactionTestHelper;

  beforeEach(async () => {
    dataSource = await getTestDataSource();
    await clearTestData();

    transactionManager = new TransactionManager({
      dataSource,
      defaultIsolationLevel: 'READ COMMITTED' as any,
      defaultMaxRetries: 3,
      enableMetrics: true,
    });

    financialService = new FinancialTransactionService({
      transactionManager,
      reservationTimeoutMinutes: 30,
    });

    orchestrator = new TransactionOrchestrator({
      financialTransactionService: financialService,
      enableCompensation: true,
      enableRetry: true,
      maxRetries: 3,
    });

    helper = new TransactionTestHelper(dataSource);
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('Happy Path - Normal Checkout Flow', () => {
    test('should complete full checkout flow successfully', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);

      // Act
      const result = await orchestrator.executeCheckoutFlow(cart.id, customer.id, {
        reserveCredit: true,
        reserveStock: false, // Stock reservation not implemented yet
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.orderNumber).toBeDefined();
      expect(result.reservationId).toBeDefined();
      expect(result.transactionId).toBeDefined();
      expect(result.steps).toBeDefined();

      // Verify all steps completed
      const steps = result.steps!;
      const completedSteps = steps.filter((s) => s.status === 'COMPLETED');
      expect(completedSteps.length).toBeGreaterThan(0);

      // Verify order exists in database
      await helper.verifyOrderStatus(result.orderId!, 'PENDING' as any);
    });

    test('should properly reserve credit for order', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.reservationId).toBeDefined();
      expect(result.data?.reservedAmount).toBe(cart.total);

      // Verify customer credit state
      await helper.verifyCustomerCredit(customer.id, 10000, cart.total);

      // Verify reservation exists
      await helper.verifyReservationStatus(orderId, 'ACTIVE' as any);
    });

    test('should create order from cart', async () => {
      // Arrange
      const customer = await helper.createTestCustomer();
      const cart = await helper.createTestCart(customer.id);

      // Act
      const result = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.orderId).toBeDefined();
      expect(result.data?.orderNumber).toBeDefined();

      // Verify cart status changed
      const updatedCart = await dataSource.getRepository(cart.constructor).findOne({
        where: { id: cart.id },
      });
      expect(updatedCart?.status).toBe('CONVERTED');
    });

    test('should capture reserved credit', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit first
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Act
      const captureResult = await financialService.captureCredit({
        orderId,
      });

      // Assert
      expect(captureResult.success).toBe(true);
      expect(captureResult.data?.transactionId).toBeDefined();
      expect(captureResult.data?.capturedAmount).toBe(cart.total);

      // Verify reservation status changed
      await helper.verifyReservationStatus(orderId, 'CAPTURED' as any);

      // Verify credit transactions created
      const transactionCount = await helper.countCreditTransactions(orderId);
      expect(transactionCount).toBeGreaterThan(0);
    });

    test('should release credit on rollback', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit first
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Act
      const releaseResult = await financialService.releaseCredit({
        orderId,
        reason: 'Test rollback',
      });

      // Assert
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.data?.releasedAmount).toBe(cart.total);

      // Verify customer credit state - should be back to original
      await helper.verifyCustomerCredit(customer.id, 10000, 0);

      // Verify reservation status changed
      await helper.verifyReservationStatus(orderId, 'RELEASED' as any);
    });
  });

  describe('Credit Reserve Failure - Rollback', () => {
    test('should handle insufficient credit gracefully', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 100 });
      const cart = await helper.createTestCart(customer.id, {
        total: 1000, // More than credit limit
      });
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 1000,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Insufficient credit');

      // Verify customer credit unchanged
      await helper.verifyCustomerCredit(customer.id, 100, 0);

      // Verify no reservation created
      const reservation = await dataSource
        .getRepository('CreditReservationEntity')
        .findOne({ where: { orderId } });
      expect(reservation).toBeUndefined();
    });

    test('should handle inactive customer', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({
        creditLimit: 10000,
        isActive: false,
      });
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 500,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not active');
    });

    test('should prevent double reservation for same order', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // First reservation
      const firstResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(firstResult.success).toBe(true);

      // Second reservation attempt
      const secondResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      expect(secondResult.success).toBe(true); // Should succeed with existing reservation
      expect(secondResult.data?.reservationId).toBe(firstResult.data?.reservationId);

      // Verify only one reservation
      const reservations = await dataSource.getRepository('CreditReservationEntity').find({
        where: { orderId },
      });
      expect(reservations.length).toBe(1);

      // Verify credit only reserved once
      await helper.verifyCustomerCredit(customer.id, 10000, cart.total);
    });
  });

  describe('Order Creation Failure - Credit Released', () => {
    test('should fail order creation for non-existent cart', async () => {
      // Arrange
      const customer = await helper.createTestCustomer();
      const cartId = helper.generateId();

      // Act
      const result = await financialService.createOrder({
        cartId,
        customerId: customer.id,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should fail order creation for empty cart', async () => {
      // Arrange
      const customer = await helper.createTestCustomer();
      const cart = await helper.createTestCart(customer.id, {
        items: [],
        total: 0,
      });

      // Act
      const result = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Credit Capture Failure - Order Cancelled', () => {
    test('should handle expired reservation', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create expired reservation
      const reservation = await helper.createTestCreditReservation(
        customer.id,
        orderId,
        cart.total,
        {
          status: 'ACTIVE' as any,
          expiresAt: new Date(Date.now() - 1000), // Expired
        }
      );

      // Update customer credit
      const customerRepo = dataSource.getRepository(customer.constructor);
      const updatedCustomer = await customerRepo.findOne({ where: { id: customer.id } });
      if (updatedCustomer) {
        updatedCustomer.usedCredit = cart.total;
        await customerRepo.save(updatedCustomer);
      }

      // Act
      const result = await financialService.captureCredit({
        orderId,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('expired');

      // Verify credit was released
      await helper.verifyCustomerCredit(customer.id, 10000, 0);

      // Verify reservation status
      const updatedReservation = await dataSource
        .getRepository(reservation.constructor)
        .findOne({ where: { id: reservation.id } });
      expect(updatedReservation?.status).toBe('EXPIRED' as any);
    });

    test('should handle capture for non-existent reservation', async () => {
      // Arrange
      const orderId = helper.generateId();

      // Act
      const result = await financialService.captureCredit({
        orderId,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No active credit reservation');
    });
  });

  describe('Concurrent Checkout Attempts - Race Condition', () => {
    test('should prevent double spending with concurrent reservations', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 1000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();
      const amount = 600; // Each order is less than limit, but total exceeds

      // Act - Execute concurrent reservations
      const [result1, result2] = await Promise.all([
        financialService.reserveCredit({
          customerId: customer.id,
          orderId: orderId1,
          amount,
        }),
        financialService.reserveCredit({
          customerId: customer.id,
          orderId: orderId2,
          amount,
        }),
      ]);

      // Assert - One should succeed, one should fail due to insufficient credit
      expect(result1.success || result2.success).toBe(true);
      expect(result1.success && result2.success).toBe(false);

      // Verify credit is not overspent
      const customerRepo = dataSource.getRepository(customer.constructor);
      const updatedCustomer = await customerRepo.findOne({ where: { id: customer.id } });
      expect(updatedCustomer?.usedCredit).toBeLessThanOrEqual(customer.creditLimit);
    });

    test('should handle sequential reservations correctly', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 1000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();
      const amount1 = 400;
      const amount2 = 300;

      // Act - Sequential reservations
      const result1 = await financialService.reserveCredit({
        customerId: customer.id,
        orderId: orderId1,
        amount: amount1,
      });

      const result2 = await financialService.reserveCredit({
        customerId: customer.id,
        orderId: orderId2,
        amount: amount2,
      });

      // Assert - Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify correct credit usage
      await helper.verifyCustomerCredit(customer.id, 1000, 700);
    });
  });

  describe('Database Connection Failure During Transaction', () => {
    test('should rollback on transaction timeout', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create transaction manager with very short timeout
      const shortTimeoutManager = new TransactionManager({
        dataSource,
        defaultTimeoutMs: 10, // 10ms timeout
      });

      const shortTimeoutService = new FinancialTransactionService({
        transactionManager: shortTimeoutManager,
      });

      // Act - Try to reserve credit (will timeout)
      const result = await shortTimeoutService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify customer credit unchanged (rolled back)
      await helper.verifyCustomerCredit(customer.id, 10000, 0);
    });

    test('should handle transaction isolation correctly', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Act - Reserve credit in READ COMMITTED isolation
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      expect(result.success).toBe(true);

      // Verify reservation is visible to other transactions (READ COMMITTED behavior)
      const reservation = await dataSource.getRepository('CreditReservationEntity').findOne({
        where: { orderId },
      });
      expect(reservation).toBeDefined();
      expect(reservation?.status).toBe('ACTIVE' as any);
    });
  });

  describe('Transaction Metrics and Logging', () => {
    test('should track transaction metrics', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Get initial metrics
      const initialMetrics = transactionManager.getMetrics();

      // Act
      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      const finalMetrics = transactionManager.getMetrics();
      expect(finalMetrics.totalTransactions).toBe(initialMetrics.totalTransactions + 1);
      expect(finalMetrics.committedTransactions).toBe(initialMetrics.committedTransactions + 1);
    });

    test('should track rolled back transactions', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 100 });
      const orderId = helper.generateId();

      // Get initial metrics
      const initialMetrics = transactionManager.getMetrics();

      // Act - Reserve credit that will fail
      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 1000, // More than available
      });

      // Assert
      const finalMetrics = transactionManager.getMetrics();
      expect(finalMetrics.totalTransactions).toBe(initialMetrics.totalTransactions + 1);
      expect(finalMetrics.rolledBackTransactions).toBe(initialMetrics.rolledBackTransactions + 1);
    });
  });

  describe('Rollback Order', () => {
    test('should rollback order and release credit', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit first
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Create order
      const orderResult = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });
      expect(orderResult.success).toBe(true);

      // Act
      const rollbackResult = await financialService.rollbackOrder({
        orderId: orderResult.data!.orderId!,
        reason: 'Test rollback',
        releaseCredit: true,
        releaseStock: false,
      });

      // Assert
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.data?.creditReleased).toBe(cart.total);

      // Verify credit released
      await helper.verifyCustomerCredit(customer.id, 10000, 0);

      // Verify order cancelled
      await helper.verifyOrderStatus(orderResult.data!.orderId!, 'CANCELLED' as any);
    });

    test('should rollback order without releasing credit', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit first
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Create order
      const orderResult = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });
      expect(orderResult.success).toBe(true);

      // Act - Rollback without releasing credit
      const rollbackResult = await financialService.rollbackOrder({
        orderId: orderResult.data!.orderId!,
        reason: 'Test rollback',
        releaseCredit: false,
        releaseStock: false,
      });

      // Assert
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.data?.creditReleased).toBe(0);

      // Verify credit NOT released
      await helper.verifyCustomerCredit(customer.id, 10000, cart.total);

      // Verify order cancelled
      await helper.verifyOrderStatus(orderResult.data!.orderId!, 'CANCELLED' as any);
    });
  });
});
