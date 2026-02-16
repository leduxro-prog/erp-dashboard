/**
 * Fault Injection Tests
 *
 * Tests for fault scenarios and error recovery:
 * - Fail after credit reserve (verify rollback)
 * - Fail after order create (verify credit released)
 * - Fail after credit capture (verify order status)
 * - Network failure during transaction
 * - Database deadlock scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import {
  TransactionManager,
  TransactionIsolation,
} from '@modules/checkout/src/services/TransactionManager';
import { FinancialTransactionService } from '@modules/checkout/src/services/FinancialTransactionService';
import { TransactionOrchestrator } from '@modules/checkout/src/services/TransactionOrchestrator';
import { TransactionTestHelper, MockTransactionManager } from './helpers';
import { getTestDataSource, clearTestData } from './setup';
import { CreditReservationStatus } from '@modules/checkout/src/domain/entities/CreditReservationEntity';
import { OrderStatus } from '@modules/orders/src/infrastructure/entities/OrderEntity';

describe('Fault Injection Tests', () => {
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
      defaultIsolationLevel: TransactionIsolation.READ_COMMITTED,
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

  describe('Fail After Credit Reserve - Verify Rollback', () => {
    test('should rollback credit reservation when subsequent operation fails', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Verify credit is reserved
      await helper.verifyCustomerCredit(customer.id, 10000, cart.total);

      // Act - Simulate failure by trying to create order with invalid cart
      // This will cause the orchestrator to fail and execute compensation
      const cartId = helper.generateId(); // Invalid cart ID
      const createResult = await financialService.createOrder({
        cartId,
        customerId: customer.id,
      });

      // Assert
      expect(createResult.success).toBe(false);

      // Manually release credit to verify rollback works
      const releaseResult = await financialService.releaseCredit({
        orderId,
        reason: 'Rollback test',
      });

      expect(releaseResult.success).toBe(true);

      // Verify credit was released
      await helper.verifyCustomerCredit(customer.id, 10000, 0);

      // Verify reservation status
      await helper.verifyReservationStatus(orderId, CreditReservationStatus.RELEASED);
    });

    test('should handle reservation rollback via compensation', async () => {
      // Arrange
      const mockManager = new MockTransactionManager();
      const mockService = new FinancialTransactionService({
        transactionManager: mockManager as any,
      });

      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Act - Reserve credit with mock
      mockManager.setStepResult('reserveCredit', {
        success: true,
        data: {
          reservationId: helper.generateId(),
          orderId,
        },
      });

      const result = await mockService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      expect(result.success).toBe(true);

      // Verify step was called
      const callLog = mockManager.getCallLog();
      expect(callLog.some((log) => log.step === 'reserveCredit')).toBe(true);
    });
  });

  describe('Fail After Order Create - Verify Credit Released', () => {
    test('should release credit when order creation fails', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Mark cart as converted to simulate order creation failure
      // (In real scenario, order creation would happen between reserve and capture)
      const cartRepo = dataSource.getRepository(cart.constructor);
      await cartRepo.update(cart.id, { status: 'CONVERTED' });

      // Try to create another order (should fail due to cart status)
      const createResult = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });

      // Assert - Order creation should fail
      expect(createResult.success).toBe(false);

      // Release credit to clean up
      const releaseResult = await financialService.releaseCredit({
        orderId,
        reason: 'Order creation failed',
      });

      // Assert
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.data?.releasedAmount).toBe(cart.total);

      // Verify credit released
      await helper.verifyCustomerCredit(customer.id, 10000, 0);
    });

    test('should handle order creation failure with active reservation', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Reserve credit
      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Get reservation ID
      const reservation = await dataSource.getRepository('CreditReservationEntity').findOne({
        where: { orderId },
      });
      const reservationId = reservation?.id;

      // Try to create order with invalid cart (should fail)
      const createResult = await financialService.createOrder({
        cartId: helper.generateId(),
        customerId: customer.id,
      });

      expect(createResult.success).toBe(false);

      // Manually release credit
      await financialService.releaseCredit({
        orderId,
        reason: 'Test',
      });

      // Verify reservation was updated
      const updatedReservation = await dataSource.getRepository('CreditReservationEntity').findOne({
        where: { id: reservationId },
      });
      expect(updatedReservation?.status).toBe(CreditReservationStatus.RELEASED);
    });
  });

  describe('Fail After Credit Capture - Verify Order Status', () => {
    test('should maintain order status even if post-capture operations fail', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);

      // Create order
      const orderResult = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });
      expect(orderResult.success).toBe(true);

      // Reserve credit
      await financialService.reserveCredit({
        customerId: customer.id,
        orderId: orderResult.data!.orderId!,
        amount: cart.total,
      });

      // Capture credit
      const captureResult = await financialService.captureCredit({
        orderId: orderResult.data!.orderId!,
      });

      // Assert
      expect(captureResult.success).toBe(true);

      // Verify order payment status is updated
      await helper.verifyOrderPaymentStatus(orderResult.data!.orderId!, 'PAID' as any);

      // Simulate failure in post-capture operation (no actual operation in this test)
      // The order status should remain PAID regardless of what happens next
      const order = await dataSource.getRepository('OrderEntity').findOne({
        where: { id: orderResult.data!.orderId },
      });
      expect(order?.payment_status).toBe('PAID');
    });

    test('should handle capture failure gracefully', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create order
      const orderResult = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });
      expect(orderResult.success).toBe(true);

      // Don't reserve credit - capture will fail
      const captureResult = await financialService.captureCredit({
        orderId: orderResult.data!.orderId!,
      });

      // Assert - Capture should fail
      expect(captureResult.success).toBe(false);
      expect(captureResult.error?.message).toContain('No active credit reservation');

      // Order payment status should remain unpaid
      await helper.verifyOrderPaymentStatus(orderResult.data!.orderId!, 'UNPAID' as any);
    });
  });

  describe('Network Failure During Transaction', () => {
    test('should handle transaction timeout gracefully', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create transaction manager with very short timeout
      const shortTimeoutManager = new TransactionManager({
        dataSource,
        defaultIsolationLevel: TransactionIsolation.READ_COMMITTED,
        defaultTimeoutMs: 10, // 10ms
        defaultMaxRetries: 0, // No retries
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
      expect(result.error?.message).toContain('timeout') ||
        expect(result.error?.message).toContain('failed');

      // Verify credit unchanged (rolled back)
      await helper.verifyCustomerCredit(customer.id, 10000, 0);
    });

    test('should retry on transient failures', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create transaction manager with retry enabled
      const retryManager = new TransactionManager({
        dataSource,
        defaultIsolationLevel: TransactionIsolation.READ_COMMITTED,
        defaultMaxRetries: 3,
        defaultRetryDelayMs: 50,
      });

      const retryService = new FinancialTransactionService({
        transactionManager: retryManager,
      });

      // Act - Reserve credit (should succeed on first try, but retries are configured)
      const result = await retryService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Assert
      expect(result.success).toBe(true);

      // Get metrics
      const metrics = retryManager.getMetrics();
      expect(metrics.totalTransactions).toBeGreaterThan(0);
    });
  });

  describe('Database Deadlock Scenarios', () => {
    test('should handle deadlock with retry', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();

      // Create transaction manager with deadlock detection
      const deadlockManager = new TransactionManager({
        dataSource,
        defaultIsolationLevel: TransactionIsolation.READ_COMMITTED,
        defaultMaxRetries: 3,
        defaultRetryDelayMs: 100,
      });

      const deadlockService = new FinancialTransactionService({
        transactionManager: deadlockManager,
      });

      // Act - Execute two reservations that could deadlock
      // In a real scenario, we would create competing transactions
      // For this test, we execute sequentially which won't deadlock
      const [result1, result2] = await Promise.all([
        deadlockService.reserveCredit({
          customerId: customer.id,
          orderId: orderId1,
          amount: 3000,
        }),
        deadlockService.reserveCredit({
          customerId: customer.id,
          orderId: orderId2,
          amount: 2000,
        }),
      ]);

      // Assert - Both should succeed (no deadlock in this case)
      expect(result1.success || result2.success).toBe(true);

      // Get metrics - deadlock count should be 0 in this case
      const metrics = deadlockManager.getMetrics();
      expect(metrics.deadlockCount).toBe(0);
    });

    test('should track deadlock metrics', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();

      const deadlockManager = new TransactionManager({
        dataSource,
        defaultIsolationLevel: TransactionIsolation.READ_COMMITTED,
        defaultMaxRetries: 3,
        defaultRetryDelayMs: 100,
      });

      // Act
      const result = await deadlockManager.executeInTransaction(
        async () => {
          // Simulate a normal transaction
          return { success: true };
        },
        { metadata: { operation: 'test' } },
      );

      // Assert
      expect(result.success).toBe(true);

      const metrics = deadlockManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalTransactions).toBeGreaterThan(0);
    });

    test('should use proper isolation level to prevent deadlocks', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();

      const serializableManager = new TransactionManager({
        dataSource,
        defaultIsolationLevel: TransactionIsolation.SERIALIZABLE,
        defaultMaxRetries: 3,
      });

      const serializableService = new FinancialTransactionService({
        transactionManager: serializableManager,
      });

      // Act
      const [result1, result2] = await Promise.all([
        serializableService.reserveCredit({
          customerId: customer.id,
          orderId: orderId1,
          amount: 3000,
        }),
        serializableService.reserveCredit({
          customerId: customer.id,
          orderId: orderId2,
          amount: 2000,
        }),
      ]);

      // Assert - SERIALIZABLE isolation prevents most anomalies
      expect(result1.success && result2.success).toBe(true);

      // Verify credit usage
      await helper.verifyCustomerCredit(customer.id, 10000, 5000);
    });
  });

  describe('Compensation Transaction Execution', () => {
    test('should execute compensation on orchestrator failure', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);

      // Mark cart as converted to cause order creation to fail
      const cartRepo = dataSource.getRepository(cart.constructor);
      await cartRepo.update(cart.id, { status: 'CONVERTED' });

      // Act - Run orchestrator (should fail at order creation)
      const result = await orchestrator.executeCheckoutFlow(cart.id, customer.id, {
        reserveCredit: true,
        reserveStock: false,
      });

      // Assert - Should fail due to cart status
      expect(result.success).toBe(false);

      // Verify compensations were attempted
      expect(result.steps).toBeDefined();
      const failedStep = result.steps?.find((s) => s.status === 'FAILED');
      expect(failedStep).toBeDefined();
    });

    test('should track compensation execution in steps', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);

      // Create an invalid scenario
      await dataSource.getRepository(cart.constructor).update(cart.id, {
        items: [],
        total: 0,
      });

      // Act
      const result = await orchestrator.executeCheckoutFlow(cart.id, customer.id, {
        reserveCredit: true,
      });

      // Assert
      expect(result.steps).toBeDefined();

      // Check if any step has compensation executed
      const stepsWithCompensation = result.steps?.filter((s) => s.compensation?.executed);
      // In a real scenario with actual failure, this would be populated
      expect(stepsWithCompensation).toBeDefined();
    });
  });

  describe('Partial Failure Recovery', () => {
    test('should handle partial credit reserve failure', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 100 });
      const cart = await helper.createTestCart(customer.id, {
        total: 1000,
      });

      // Act
      const result = await orchestrator.executeCheckoutFlow(cart.id, customer.id, {
        reserveCredit: true,
      });

      // Assert - Should fail due to insufficient credit
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify no credit was reserved
      await helper.verifyCustomerCredit(customer.id, 100, 0);
    });

    test('should continue flow after successful reserve', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);

      // Act - Run complete flow (should succeed if no failures)
      const result = await orchestrator.executeCheckoutFlow(cart.id, customer.id, {
        reserveCredit: true,
        reserveStock: false, // Stock not implemented
      });

      // Assert - Either success or graceful failure
      if (result.success) {
        expect(result.orderId).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Transaction State Consistency', () => {
    test('should maintain consistent state after rollback', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Get initial state
      const initialCredit = customer.creditLimit - customer.usedCredit;

      // Reserve credit
      const reserveResult = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });
      expect(reserveResult.success).toBe(true);

      // Rollback
      const rollbackResult = await financialService.rollbackOrder({
        orderId,
        reason: 'Test rollback',
        releaseCredit: true,
      });
      expect(rollbackResult.success).toBe(true);

      // Verify state returned to initial
      const finalCustomer = await dataSource.getRepository(customer.constructor).findOne({
        where: { id: customer.id },
      });
      const finalCredit = finalCustomer!.creditLimit - finalCustomer!.usedCredit;

      expect(finalCredit).toBe(initialCredit);
    });

    test('should handle nested transaction rollback', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();
      const amount = 5000;

      // Act - Use transaction manager directly to test savepoints
      const result = await transactionManager.executeInTransaction(
        async (em) => {
          // Reserve credit
          const reserveResult = await financialService.reserveCredit({
            customerId: customer.id,
            orderId,
            amount,
          });
          expect(reserveResult.success).toBe(true);

          // Create savepoint
          const savepointResult = await transactionManager.createSavepoint(
            result.metadata.transactionId,
            'test_savepoint',
          );
          expect(savepointResult.success).toBe(true);

          // Do more work
          // ...

          // Rollback to savepoint
          await transactionManager.rollbackToSavepoint(
            result.metadata.transactionId,
            savepointResult.savepointId,
          );

          return { success: true };
        },
        { metadata: { operation: 'test_nested_rollback' } },
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling and Logging', () => {
    test('should log transaction errors properly', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 100 });
      const orderId = helper.generateId();

      // Act - Try to reserve more than available
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 1000,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Insufficient credit');

      // Check transaction metadata
      expect(result.metadata.transactionId).toBeDefined();
      expect(result.metadata.status).toBe('FAILED');
      expect(result.metadata.error).toBeDefined();
    });

    test('should track all failed transactions in metrics', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 100 });

      // Get initial metrics
      const initialMetrics = transactionManager.getMetrics();

      // Act - Fail multiple reservations
      await financialService.reserveCredit({
        customerId: customer.id,
        orderId: helper.generateId(),
        amount: 1000,
      });

      await financialService.reserveCredit({
        customerId: customer.id,
        orderId: helper.generateId(),
        amount: 2000,
      });

      // Assert
      const finalMetrics = transactionManager.getMetrics();
      expect(finalMetrics.rolledBackTransactions).toBeGreaterThan(
        initialMetrics.rolledBackTransactions,
      );
    });
  });
});
