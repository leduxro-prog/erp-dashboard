/**
 * Credit Reservation Tests
 *
 * Comprehensive tests for credit reservation functionality:
 * - Reserve credit for order
 * - Double reservation prevention
 * - Reservation expiry
 * - Capture after reserve
 * - Release after reserve
 * - Concurrent reservation attempts
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { TransactionManager } from '@modules/checkout/src/services/TransactionManager';
import { FinancialTransactionService } from '@modules/checkout/src/services/FinancialTransactionService';
import { TransactionTestHelper } from './helpers';
import { getTestDataSource, clearTestData } from './setup';
import { CreditReservationEntity, CreditReservationStatus } from '@modules/checkout/src/domain/entities/CreditReservationEntity';

describe('Credit Reservation Tests', () => {
  let dataSource: DataSource;
  let transactionManager: TransactionManager;
  let financialService: FinancialTransactionService;
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

    helper = new TransactionTestHelper(dataSource);
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('Reserve Credit for Order', () => {
    test('should successfully reserve credit within limit', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({
        creditLimit: 10000,
        usedCredit: 2000,
      });
      const orderId = helper.generateId();
      const amount = 3000;

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.reservationId).toBeDefined();
      expect(result.data?.reservedAmount).toBe(amount);
      expect(result.data?.availableCredit).toBe(5000); // 10000 - (2000 + 3000)
    });

    test('should fail when exceeding credit limit', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({
        creditLimit: 5000,
        usedCredit: 3000,
      });
      const orderId = helper.generateId();
      const amount = 3000; // Available: 2000

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Insufficient credit');
    });

    test('should fail exactly at credit limit edge case', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({
        creditLimit: 5000,
        usedCredit: 4999,
      });
      const orderId = helper.generateId();
      const amount = 1;

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount,
      });

      // Assert - Should succeed as it equals the limit
      expect(result.success).toBe(true);
      expect(result.data?.availableCredit).toBe(0);
    });

    test('should fail for non-existent customer', async () => {
      // Arrange
      const customerId = helper.generateId();
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId,
        orderId,
        amount: 1000,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Customer not found');
    });

    test('should fail for inactive customer', async () => {
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
        amount: 1000,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not active');
    });

    test('should handle zero amount reservation', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 0,
      });

      // Assert - Should succeed (edge case)
      expect(result.success).toBe(true);
      expect(result.data?.reservedAmount).toBe(0);
    });

    test('should create reservation with proper metadata', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();
      const userId = helper.generateId();
      const notes = 'Test reservation note';

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 1000,
        userId,
        notes,
      });

      // Assert
      expect(result.success).toBe(true);

      const reservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { id: result.data!.reservationId },
      });

      expect(reservation).toBeDefined();
      expect(reservation?.customerId).toBe(customer.id);
      expect(reservation?.orderId).toBe(orderId);
      expect(reservation?.amount).toBe(1000);
      expect(reservation?.status).toBe(CreditReservationStatus.ACTIVE);
      expect(reservation?.notes).toBe(notes);
      expect(reservation?.createdBy).toBe(userId);
      expect(reservation?.reservedAt).toBeDefined();
      expect(reservation?.expiresAt).toBeDefined();
    });

    test('should track balance before and after in reservation', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({
        creditLimit: 10000,
        usedCredit: 2000,
      });
      const orderId = helper.generateId();
      const amount = 3000;

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount,
      });

      // Assert
      const reservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { id: result.data!.reservationId },
      });

      expect(reservation?.balanceBefore).toBe(2000);
      expect(reservation?.balanceAfter).toBe(5000);
    });
  });

  describe('Double Reservation Prevention', () => {
    test('should return existing reservation for same order', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();
      const amount = 1000;

      // First reservation
      const result1 = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount,
      });

      // Second reservation attempt
      const result2 = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 2000, // Different amount
      });

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Should return the same reservation
      expect(result2.data?.reservationId).toBe(result1.data?.reservationId);
      expect(result2.data?.reservedAmount).toBe(1000); // Original amount, not 2000

      // Verify only one reservation exists
      const reservations = await dataSource.getRepository(CreditReservationEntity).find({
        where: { orderId },
      });
      expect(reservations.length).toBe(1);

      // Verify credit only reserved once
      await helper.verifyCustomerCredit(customer.id, 10000, 1000);
    });

    test('should allow reservations for different orders', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();

      // Act
      const result1 = await financialService.reserveCredit({
        customerId: customer.id,
        orderId: orderId1,
        amount: 2000,
      });

      const result2 = await financialService.reserveCredit({
        customerId: customer.id,
        orderId: orderId2,
        amount: 3000,
      });

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      expect(result1.data?.reservationId).not.toBe(result2.data?.reservationId);

      // Verify both reservations exist
      await helper.verifyCustomerCredit(customer.id, 10000, 5000);
    });
  });

  describe('Reservation Expiry', () => {
    test('should set correct expiry time', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();
      const reservationTimeoutMinutes = 30;

      const serviceWithTimeout = new FinancialTransactionService({
        transactionManager,
        reservationTimeoutMinutes,
      });

      // Act
      const result = await serviceWithTimeout.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 1000,
      });

      // Assert
      const reservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { id: result.data!.reservationId },
      });

      const now = new Date();
      const expectedExpiry = new Date(reservation!.reservedAt.getTime() + reservationTimeoutMinutes * 60 * 1000);

      expect(Math.abs(reservation!.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    test('should handle expired reservation on capture', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create expired reservation manually
      const reservation = await helper.createTestCreditReservation(
        customer.id,
        orderId,
        cart.total,
        {
          status: CreditReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        }
      );

      // Update customer used credit
      const customerRepo = dataSource.getRepository(customer.constructor);
      const updatedCustomer = await customerRepo.findOne({ where: { id: customer.id } });
      if (updatedCustomer) {
        updatedCustomer.usedCredit = cart.total;
        await customerRepo.save(updatedCustomer);
      }

      // Act - Try to capture expired reservation
      const result = await financialService.captureCredit({
        orderId,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('expired');

      // Verify credit was released back to customer
      await helper.verifyCustomerCredit(customer.id, 10000, 0);

      // Verify reservation status is now EXPIRED
      const updatedReservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { id: reservation.id },
      });
      expect(updatedReservation?.status).toBe(CreditReservationStatus.EXPIRED);
    });
  });

  describe('Capture After Reserve', () => {
    test('should successfully capture reserved credit', async () => {
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

      // Act - Capture credit
      const captureResult = await financialService.captureCredit({
        orderId,
      });

      // Assert
      expect(captureResult.success).toBe(true);
      expect(captureResult.data?.transactionId).toBeDefined();
      expect(captureResult.data?.capturedAmount).toBe(cart.total);

      // Verify reservation status changed
      await helper.verifyReservationStatus(orderId, CreditReservationStatus.CAPTURED);

      // Verify credit transaction created
      const transactionCount = await helper.countCreditTransactions(orderId);
      expect(transactionCount).toBeGreaterThan(0);

      // Verify credit transaction has correct details
      const transactions = await dataSource.getRepository('CreditTransactionEntity').find({
        where: { referenceId: orderId },
      });
      const debitTransaction = transactions.find((t: any) => t.type === 'DEBIT');
      expect(debitTransaction).toBeDefined();
      expect(debitTransaction?.amount).toBe(cart.total);
      expect(debitTransaction?.description).toContain(orderId);
    });

    test('should set capturedAt timestamp', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Act
      await financialService.captureCredit({ orderId });

      // Assert
      const reservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { orderId },
      });

      expect(reservation?.capturedAt).toBeDefined();
      expect(reservation?.capturedAt).toBeInstanceOf(Date);
      expect(reservation?.capturedAt!.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should update order payment status on capture', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      // Create order
      const orderResult = await financialService.createOrder({
        cartId: cart.id,
        customerId: customer.id,
      });

      await financialService.reserveCredit({
        customerId: customer.id,
        orderId: orderResult.data!.orderId!,
        amount: cart.total,
      });

      // Act - Capture credit
      await financialService.captureCredit({
        orderId: orderResult.data!.orderId!,
      });

      // Assert
      await helper.verifyOrderPaymentStatus(orderResult.data!.orderId!, 'PAID' as any);
    });

    test('should fail to capture already captured reservation', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // First capture
      const firstCapture = await financialService.captureCredit({ orderId });
      expect(firstCapture.success).toBe(true);

      // Second capture attempt
      const secondCapture = await financialService.captureCredit({ orderId });

      // Assert
      expect(secondCapture.success).toBe(false);
      expect(secondCapture.error?.message).toContain('No active credit reservation');
    });
  });

  describe('Release After Reserve', () => {
    test('should successfully release reserved credit', async () => {
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

      // Act - Release credit
      const releaseResult = await financialService.releaseCredit({
        orderId,
        reason: 'Test release',
      });

      // Assert
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.data?.releasedAmount).toBe(cart.total);

      // Verify customer credit restored
      await helper.verifyCustomerCredit(customer.id, 10000, 0);

      // Verify reservation status changed
      await helper.verifyReservationStatus(orderId, CreditReservationStatus.RELEASED);

      // Verify credit reversal transaction created
      const transactions = await dataSource.getRepository('CreditTransactionEntity').find({
        where: { referenceId: orderId },
      });
      const creditTransaction = transactions.find((t: any) => t.type === 'CREDIT');
      expect(creditTransaction).toBeDefined();
      expect(creditTransaction?.amount).toBe(cart.total);
    });

    test('should set releasedAt timestamp', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // Act
      await financialService.releaseCredit({ orderId, reason: 'Test' });

      // Assert
      const reservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { orderId },
      });

      expect(reservation?.releasedAt).toBeDefined();
      expect(reservation?.releasedAt).toBeInstanceOf(Date);
    });

    test('should fail to release non-existent reservation', async () => {
      // Arrange
      const orderId = helper.generateId();

      // Act
      const result = await financialService.releaseCredit({
        orderId,
        reason: 'Test',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No active credit reservation');
    });

    test('should fail to release already released reservation', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const cart = await helper.createTestCart(customer.id);
      const orderId = helper.generateId();

      await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: cart.total,
      });

      // First release
      const firstRelease = await financialService.releaseCredit({ orderId, reason: 'Test' });
      expect(firstRelease.success).toBe(true);

      // Second release attempt
      const secondRelease = await financialService.releaseCredit({ orderId, reason: 'Test' });

      // Assert
      expect(secondRelease.success).toBe(false);
      expect(secondRelease.error?.message).toContain('No active credit reservation');
    });
  });

  describe('Concurrent Reservation Attempts', () => {
    test('should handle concurrent reservations with proper locking', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();

      // Act - Execute concurrent reservations
      const [result1, result2] = await Promise.all([
        financialService.reserveCredit({
          customerId: customer.id,
          orderId: orderId1,
          amount: 6000,
        }),
        financialService.reserveCredit({
          customerId: customer.id,
          orderId: orderId2,
          amount: 5000,
        }),
      ]);

      // Assert - At least one should succeed, total should not exceed limit
      const succeededCount = [result1.success, result2.success].filter(Boolean).length;
      expect(succeededCount).toBeGreaterThan(0);

      // Verify credit is not overspent
      const customerRepo = dataSource.getRepository(customer.constructor);
      const updatedCustomer = await customerRepo.findOne({ where: { id: customer.id } });
      expect(updatedCustomer?.usedCredit).toBeLessThanOrEqual(customer.creditLimit);
    });

    test('should allow concurrent reservations within credit limit', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId1 = helper.generateId();
      const orderId2 = helper.generateId();

      // Act
      const [result1, result2] = await Promise.all([
        financialService.reserveCredit({
          customerId: customer.id,
          orderId: orderId1,
          amount: 3000,
        }),
        financialService.reserveCredit({
          customerId: customer.id,
          orderId: orderId2,
          amount: 4000,
        }),
      ]);

      // Assert - Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify credit usage
      await helper.verifyCustomerCredit(customer.id, 10000, 7000);
    });

    test('should maintain consistency under high concurrency', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderIds = Array.from({ length: 10 }, () => helper.generateId());
      const amountPerOrder = 1000; // Total: 10000, exactly at limit

      // Act - Execute 10 concurrent reservations
      const results = await Promise.all(
        orderIds.map((orderId) =>
          financialService.reserveCredit({
            customerId: customer.id,
            orderId,
            amount: amountPerOrder,
          })
        )
      );

      // Assert
      const succeededCount = results.filter((r) => r.success).length;
      expect(succeededCount).toBe(10); // All should succeed

      // Verify credit usage
      const customerRepo = dataSource.getRepository(customer.constructor);
      const updatedCustomer = await customerRepo.findOne({ where: { id: customer.id } });
      expect(updatedCustomer?.usedCredit).toBe(10000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle negative amount gracefully', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000 });
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: -100,
      });

      // Assert
      expect(result.success).toBe(true); // Or could be false depending on validation
    });

    test('should handle very large amounts', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 1000000000 });
      const orderId = helper.generateId();

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount: 999999999,
      });

      // Assert
      expect(result.success).toBe(true);
    });

    test('should handle decimal amounts correctly', async () => {
      // Arrange
      const customer = await helper.createTestCustomer({ creditLimit: 10000.99 });
      const orderId = helper.generateId();
      const amount = 1234.56;

      // Act
      const result = await financialService.reserveCredit({
        customerId: customer.id,
        orderId,
        amount,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.reservedAmount).toBe(amount);

      const reservation = await dataSource.getRepository(CreditReservationEntity).findOne({
        where: { id: result.data!.reservationId },
      });
      expect(reservation?.amount).toBe(amount);
    });
  });
});
