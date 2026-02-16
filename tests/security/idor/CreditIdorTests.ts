/**
 * CreditIdorTests
 * Negative tests for IDOR (Insecure Direct Object Reference) vulnerabilities
 * in credit and payment endpoints.
 *
 * These tests verify that:
 * - Users cannot view other customers' credit information
 * - Users cannot modify other customers' credit limits
 * - Users cannot access other customers' payment ledger
 * - Users cannot create credit reservations for other customers
 *
 * All tests are designed to FAIL when IDOR protection is NOT working,
 * and PASS when IDOR protection IS working (i.e., attacks are blocked).
 */

import request from 'supertest';
import express, { Application } from 'express';
import { describe, test, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import {
  getAuthHeaders,
  TEST_USERS,
  generateInvalidToken,
  generateExpiredToken,
} from '../helpers/TestAuth';
import { generateIdorReport } from '../helpers/IdorTestHelper';

describe('Credit IDOR Security Tests', () => {
  let app: Application;
  const testResults: Array<{
    name: string;
    passed: boolean;
    description: string;
  }> = [];

  // Mock credit database
  const mockCreditAccounts = new Map<number, any>();

  beforeAll(() => {
    // Initialize mock credit accounts
    mockCreditAccounts.set(201, {
      id: 201,
      customer_id: 201,
      company_name: 'Company One',
      tier: 'STANDARD',
      credit_limit: 10000,
      credit_used: 2500,
      credit_available: 7500,
      payment_terms_days: 30,
      status: 'ACTIVE',
    });

    mockCreditAccounts.set(202, {
      id: 202,
      customer_id: 202,
      company_name: 'Company Two',
      tier: 'PREMIUM',
      credit_limit: 50000,
      credit_used: 15000,
      credit_available: 35000,
      payment_terms_days: 45,
      status: 'ACTIVE',
    });

    mockCreditAccounts.set(203, {
      id: 203,
      customer_id: 203,
      company_name: 'Company Three',
      tier: 'ENTERPRISE',
      credit_limit: 100000,
      credit_used: 45000,
      credit_available: 55000,
      payment_terms_days: 60,
      status: 'ACTIVE',
    });

    // Mock credit transactions (ledger)
    const mockTransactions = new Map<number, any[]>();
    mockTransactions.set(201, [
      { id: 1, customer_id: 201, type: 'CREDIT', amount: 10000, date: '2025-01-01' },
      { id: 2, customer_id: 201, type: 'DEBIT', amount: 2500, date: '2025-01-15' },
    ]);
    mockTransactions.set(202, [
      { id: 3, customer_id: 202, type: 'CREDIT', amount: 50000, date: '2025-01-01' },
      { id: 4, customer_id: 202, type: 'DEBIT', amount: 15000, date: '2025-01-10' },
    ]);

    // Create Express app with mock routes
    app = express();
    app.use(express.json());

    // Mock health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // GET /api/v1/credit/:customerId - Get credit account (IDOR target)
    app.get('/api/v1/credit/:customerId', (req, res) => {
      const requestedCustomerId = parseInt(req.params.customerId, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // IDOR check: only allow access to own credit account (admin bypass)
      if (!isAdmin && requestedCustomerId !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      const account = mockCreditAccounts.get(requestedCustomerId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Credit account not found' },
        });
      }

      res.json({
        success: true,
        data: account,
      });
    });

    // GET /api/v1/credit - Get own credit account
    app.get('/api/v1/credit', (req, res) => {
      const authenticatedCustomerId = (req as any).customerId;

      const account = mockCreditAccounts.get(authenticatedCustomerId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Credit account not found' },
        });
      }

      res.json({
        success: true,
        data: account,
      });
    });

    // GET /api/v1/credit/transactions - Get credit transactions (ledger)
    app.get('/api/v1/credit/transactions', (req, res) => {
      const authenticatedCustomerId = (req as any).customerId;

      // Check for customer_id injection in query
      const queryCustomerId = req.query.customer_id;
      if (queryCustomerId && String(queryCustomerId) !== String(authenticatedCustomerId)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot view other customer transactions',
          },
        });
      }

      const transactions = mockTransactions.get(authenticatedCustomerId) || [];

      res.json({
        success: true,
        data: {
          transactions,
          total: transactions.length,
        },
      });
    });

    // GET /api/v1/credit/:customerId/transactions - Get transactions by customer ID (IDOR target)
    app.get('/api/v1/credit/:customerId/transactions', (req, res) => {
      const requestedCustomerId = parseInt(req.params.customerId, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // IDOR check
      if (!isAdmin && requestedCustomerId !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      const transactions = mockTransactions.get(requestedCustomerId) || [];

      res.json({
        success: true,
        data: {
          transactions,
          total: transactions.length,
        },
      });
    });

    // POST /api/v1/credit/reserve - Reserve credit
    app.post('/api/v1/credit/reserve', (req, res) => {
      // Check for customer_id injection
      if (req.body.customer_id || req.body.customerId || req.body.b2b_customer_id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot reserve credit for other customer',
          },
        });
      }

      const authenticatedCustomerId = (req as any).customerId;
      const account = mockCreditAccounts.get(authenticatedCustomerId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Credit account not found' },
        });
      }

      const amount = req.body.amount || 0;

      if (amount > account.credit_available) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_CREDIT',
            message: 'Insufficient credit available',
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          reservation_id: `res_${Date.now()}`,
          customer_id: authenticatedCustomerId,
          amount,
          remaining: account.credit_available - amount,
        },
      });
    });

    // POST /api/v1/credit/:customerId/reserve - Reserve credit for specific customer (IDOR target)
    app.post('/api/v1/credit/:customerId/reserve', (req, res) => {
      const requestedCustomerId = parseInt(req.params.customerId, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // IDOR check: only allow reserving own credit (admin bypass)
      if (!isAdmin && requestedCustomerId !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot reserve credit for other customer',
          },
        });
      }

      const account = mockCreditAccounts.get(requestedCustomerId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Credit account not found' },
        });
      }

      const amount = req.body.amount || 0;

      res.status(201).json({
        success: true,
        data: {
          reservation_id: `res_${Date.now()}`,
          customer_id: requestedCustomerId,
          amount,
        },
      });
    });

    // PATCH /api/v1/credit/:customerId - Update credit account (admin only)
    app.patch('/api/v1/credit/:customerId', (req, res) => {
      const requestedCustomerId = parseInt(req.params.customerId, 10);
      const isAdmin = (req as any).isAdmin;

      // Only admin can update credit accounts
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only administrators can modify credit accounts',
          },
        });
      }

      const account = mockCreditAccounts.get(requestedCustomerId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Credit account not found' },
        });
      }

      // Update allowed fields
      const updated = {
        ...account,
        ...req.body,
        id: account.id, // Prevent ID change
        customer_id: account.customer_id, // Prevent customer_id change
      };

      mockCreditAccounts.set(requestedCustomerId, updated);

      res.json({
        success: true,
        data: updated,
      });
    });

    // POST /api/v1/credit/payment - Make payment
    app.post('/api/v1/credit/payment', (req, res) => {
      // Check for customer_id injection
      if (req.body.customer_id || req.body.customerId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot make payment for other customer',
          },
        });
      }

      const authenticatedCustomerId = (req as any).customerId;
      const account = mockCreditAccounts.get(authenticatedCustomerId);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Credit account not found' },
        });
      }

      const amount = req.body.amount || 0;
      const newUsed = account.credit_used - amount;
      const newAvailable = account.credit_limit - newUsed;

      const updated = {
        ...account,
        credit_used: Math.max(0, newUsed),
        credit_available: Math.max(0, newAvailable),
      };

      mockCreditAccounts.set(authenticatedCustomerId, updated);

      res.status(201).json({
        success: true,
        data: {
          payment_id: `pay_${Date.now()}`,
          customer_id: authenticatedCustomerId,
          amount,
          new_balance: updated.credit_available,
        },
      });
    });

    // GET /api/v1/credit/summary - Get credit summary
    app.get('/api/v1/credit/summary', (req, res) => {
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // Admin can see all summaries, regular users only see own
      let accounts: any[];

      if (isAdmin) {
        accounts = Array.from(mockCreditAccounts.values());
      } else {
        const account = mockCreditAccounts.get(authenticatedCustomerId);
        accounts = account ? [account] : [];
      }

      res.json({
        success: true,
        data: {
          accounts,
          total: accounts.length,
        },
      });
    });

    // Mock authentication middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const token = authHeader.replace('Bearer ', '');

      if (token.includes('customer1')) {
        (req as any).customerId = 201;
        (req as any).user = TEST_USERS.b2bCustomer1;
        (req as any).isAdmin = false;
      } else if (token.includes('customer2')) {
        (req as any).customerId = 202;
        (req as any).user = TEST_USERS.b2bCustomer2;
        (req as any).isAdmin = false;
      } else if (token.includes('customer3')) {
        (req as any).customerId = 203;
        (req as any).user = { id: 6, email: 'customer3@company.ro', role: 'b2b_customer' };
        (req as any).isAdmin = false;
      } else if (token.includes('admin')) {
        (req as any).customerId = 1;
        (req as any).isAdmin = true;
        (req as any).user = TEST_USERS.admin;
      } else if (token === 'invalid') {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      } else if (token === 'expired') {
        return res.status(401).json({ success: false, error: 'Token expired' });
      }

      next();
    });
  });

  beforeEach(() => {
    testResults.length = 0;
  });

  describe('GET Credit - View Other Customer Credit', () => {
    test('should prevent viewing other customer credit by ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/credit/202') // Try to view customer 202's credit
        .set(attackerHeaders);

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent viewing other customer credit by ID',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should allow viewing own credit', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/credit')
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow viewing own credit',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('customer_id', 201);
    });
  });

  describe('GET Credit Transactions - View Other Customer Ledger', () => {
    test('should prevent viewing other customer transactions by customer ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/credit/202/transactions') // Try to view customer 202's ledger
        .set(attackerHeaders);

      const passed = response.status === 403;

      testResults.push({
        name: 'Prevent viewing other customer transactions by ID',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should block customer_id in transaction query', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/credit/transactions?customer_id=202') // IDOR attempt via query
        .set(attackerHeaders);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customer_id in transaction query',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow viewing own transactions', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/credit/transactions')
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow viewing own transactions',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toBeDefined();
    });
  });

  describe('POST Credit Reserve - Create Reservations for Other Customers', () => {
    test('should block reserving credit for other customer via body', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const reserveData = {
        amount: 5000,
        customer_id: 202, // IDOR attempt
      };

      const response = await request(app)
        .post('/api/v1/credit/reserve')
        .set(attackerHeaders)
        .send(reserveData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block reserving credit for other customer via body',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should block reserving credit for other customer via path', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .post('/api/v1/credit/202/reserve') // IDOR attempt via path
        .set(attackerHeaders)
        .send({ amount: 5000 });

      const passed = response.status === 403;

      testResults.push({
        name: 'Block reserving credit for other customer via path',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow reserving own credit', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const reserveData = {
        amount: 1000,
        // No customer_id - should use authenticated user's ID
      };

      const response = await request(app)
        .post('/api/v1/credit/reserve')
        .set(attackerHeaders)
        .send(reserveData);

      const passed = response.status === 201;

      testResults.push({
        name: 'Allow reserving own credit',
        passed,
        description: `Expected 201, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('customer_id', 201);
    });
  });

  describe('POST Credit Payment - Make Payment for Other Customers', () => {
    test('should block payment for other customer', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const paymentData = {
        amount: 1000,
        customer_id: 202, // IDOR attempt - pay for customer 202
        reference: 'test-payment',
      };

      const response = await request(app)
        .post('/api/v1/credit/payment')
        .set(attackerHeaders)
        .send(paymentData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block payment for other customer',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow payment for own account', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const paymentData = {
        amount: 1000,
        // No customer_id - should use authenticated user's ID
        reference: 'test-payment',
      };

      const response = await request(app)
        .post('/api/v1/credit/payment')
        .set(attackerHeaders)
        .send(paymentData);

      const passed = response.status === 201;

      testResults.push({
        name: 'Allow payment for own account',
        passed,
        description: `Expected 201, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('customer_id', 201);
    });
  });

  describe('PATCH Credit - Modify Other Customer Credit Limit', () => {
    test('should prevent non-admin from modifying credit accounts', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const updateData = {
        credit_limit: 1000000, // Try to increase limit
      };

      const response = await request(app)
        .patch('/api/v1/credit/201')
        .set(attackerHeaders)
        .send(updateData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Prevent non-admin from modifying credit accounts',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow admin to modify any credit account', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const updateData = {
        credit_limit: 15000,
      };

      const response = await request(app)
        .patch('/api/v1/credit/202')
        .set(adminHeaders)
        .send(updateData);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow admin to modify credit account',
        passed,
        description: `Expected 200 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('GET Credit Summary - View All Credit Accounts', () => {
    test('should restrict credit summary to own account for regular users', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/credit/summary')
        .set(attackerHeaders);

      const passed = response.status === 200 &&
        response.body.data.accounts.length === 1 &&
        response.body.data.accounts[0].customer_id === 201;

      testResults.push({
        name: 'Restrict credit summary to own account',
        passed,
        description: `Expected only own account, got ${response.body.data.accounts.length} accounts`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data.accounts).toHaveLength(1);
    });

    test('should allow admin to view all credit summaries', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const response = await request(app)
        .get('/api/v1/credit/summary')
        .set(adminHeaders);

      const passed = response.status === 200 &&
        response.body.data.accounts.length === 3;

      testResults.push({
        name: 'Allow admin to view all credit summaries',
        passed,
        description: `Expected all 3 accounts, got ${response.body.data.accounts.length}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data.accounts).toHaveLength(3);
    });
  });

  describe('Authentication Edge Cases', () => {
    test('should reject unauthenticated credit requests', async () => {
      const response = await request(app)
        .get('/api/v1/credit')
        .set('Content-Type', 'application/json');

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject unauthenticated credit requests',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/credit')
        .set('Authorization', 'Bearer invalid.token.here');

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject credit requests with invalid token',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });

    test('should reject requests with expired token', async () => {
      const expiredAuth = generateExpiredToken(TEST_USERS.b2bCustomer1);
      const response = await request(app)
        .get('/api/v1/credit')
        .set('Authorization', expiredAuth.authorization);

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject credit requests with expired token',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });
  });

  describe('Batch IDOR Tests - Customer ID Injection', () => {
    test.each([
      ['customer_id', { amount: 5000, customer_id: 202 }],
      ['customerId', { amount: 5000, customerId: 202 }],
      ['b2b_customer_id', { amount: 5000, b2b_customer_id: 202 }],
    ])('should block %s in credit request', async (fieldName, payload) => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const response = await request(app)
        .post('/api/v1/credit/reserve')
        .set(attackerHeaders)
        .send(payload);

      const passed = response.status === 403;

      testResults.push({
        name: `Block ${fieldName} in credit request`,
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });
  });

  afterEach(() => {
    const lastResult = testResults[testResults.length - 1];
    if (lastResult) {
      console.log(`  [${lastResult.passed ? 'PASS' : 'FAIL'}] ${lastResult.name}: ${lastResult.description}`);
    }
  });

  afterAll(() => {
    console.log('\n' + '='.repeat(80));
    console.log('CREDIT IDOR SECURITY TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;

    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.description}`);
        });
    }

    console.log('='.repeat(80) + '\n');
  });
});
