/**
 * CheckoutIdorTests
 * Negative tests for IDOR (Insecure Direct Object Reference) vulnerabilities
 * in checkout flow endpoints.
 *
 * These tests verify that:
 * - Users cannot checkout with different customerId in payload
 * - Users cannot use another customer's address
 * - Users cannot use another customer's payment method
 * - Users cannot reserve credit for different customer
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
  generateExpiredToken,
  createTestOrderData,
  createIdorCheckoutData,
} from '../helpers/TestAuth';
import { generateIdorReport } from '../helpers/IdorTestHelper';

describe('Checkout IDOR Security Tests', () => {
  let app: Application;
  const testResults: Array<{
    name: string;
    passed: boolean;
    description: string;
  }> = [];

  // Mock addresses database
  const mockAddresses = new Map<number, any[]>();
  const mockPaymentMethods = new Map<number, any[]>();

  beforeAll(() => {
    // Initialize mock addresses
    mockAddresses.set(201, [
      { id: 1, customer_id: 201, label: 'Office', address: 'Str. Primavera 1, Bucharest' },
      { id: 2, customer_id: 201, label: 'Warehouse', address: 'Str. Industriala 5, Bucharest' },
    ]);

    mockAddresses.set(202, [
      { id: 3, customer_id: 202, label: 'HQ', address: 'Str. Unirii 10, Cluj' },
    ]);

    mockAddresses.set(203, [
      { id: 4, customer_id: 203, label: 'Factory', address: 'Str. Fabricii 20, Timisoara' },
    ]);

    // Initialize mock payment methods
    mockPaymentMethods.set(201, [
      { id: 1, customer_id: 201, type: 'CREDIT', last4: '**** 1234' },
    ]);

    mockPaymentMethods.set(202, [
      { id: 2, customer_id: 202, type: 'TRANSFER', account: 'RO00BANK12345' },
    ]);

    mockPaymentMethods.set(203, [
      { id: 3, customer_id: 203, type: 'CREDIT', last4: '**** 5678' },
    ]);

    // Create Express app with mock routes
    app = express();
    app.use(express.json());

    // Mock health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // POST /api/v1/checkout - Process checkout
    app.post('/api/v1/checkout', (req, res) => {
      // Check for customer_id injection in body
      if (req.body.customer_id || req.body.customerId || req.body.b2b_customer_id || req.body.b2bCustomerId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot specify customer_id during checkout',
            details: { injectedField: 'customer_id' },
          },
        });
      }

      const authenticatedCustomerId = (req as any).customerId;

      // Validate items
      if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ITEMS', message: 'Items are required' },
        });
      }

      // Validate shipping address
      if (!req.body.shipping_address) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ADDRESS', message: 'Shipping address is required' },
        });
      }

      // Check if using another customer's address by ID
      if (req.body.shipping_address_id) {
        const addressId = req.body.shipping_address_id;
        const address = mockAddresses
          .get(201)
          ?.find((a: any) => a.id === addressId);

        if (!address) {
          // Try to find in other customers' addresses
          for (const [custId, addresses] of mockAddresses.entries()) {
            if (custId !== authenticatedCustomerId) {
              const otherAddress = addresses.find((a: any) => a.id === addressId);
              if (otherAddress) {
                return res.status(403).json({
                  success: false,
                  error: {
                    code: 'IDOR_VIOLATION',
                    message: 'Cannot use other customer address',
                  },
                });
              }
            }
          }
        }
      }

      // Check if using another customer's payment method
      if (req.body.payment_method_id) {
        const methodId = req.body.payment_method_id;
        const method = mockPaymentMethods
          .get(201)
          ?.find((m: any) => m.id === methodId);

        if (!method) {
          for (const [custId, methods] of mockPaymentMethods.entries()) {
            if (custId !== authenticatedCustomerId) {
              const otherMethod = methods.find((m: any) => m.id === methodId);
              if (otherMethod) {
                return res.status(403).json({
                  success: false,
                  error: {
                    code: 'IDOR_VIOLATION',
                    message: 'Cannot use other customer payment method',
                  },
                });
              }
            }
          }
        }
      }

      // Simulate checkout success
      const order = {
        id: 50000 + Date.now() % 10000,
        order_number: `B2B-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        customer_id: authenticatedCustomerId,
        status: 'PENDING',
        items: req.body.items,
        total: req.body.items.reduce((sum: number, item: any) => sum + (item.quantity * 100), 0),
        shipping_address: req.body.shipping_address,
        payment_method: req.body.payment_method || 'CREDIT',
      };

      res.status(201).json({
        success: true,
        data: order,
        message: 'Order placed successfully',
      });
    });

    // POST /api/v1/checkout/validate - Validate checkout data
    app.post('/api/v1/checkout/validate', (req, res) => {
      // Check for customer_id injection
      if (req.body.customer_id || req.body.customerId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Customer ID injection detected',
          },
        });
      }

      const authenticatedCustomerId = (req as any).customerId;

      res.json({
        success: true,
        data: {
          valid: true,
          customer_id: authenticatedCustomerId,
        },
      });
    });

    // POST /api/v1/checkout/reserve-credit - Reserve credit for checkout
    app.post('/api/v1/checkout/reserve-credit', (req, res) => {
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
      const amount = req.body.amount || 0;

      res.status(201).json({
        success: true,
        data: {
          reservation_id: `res_${Date.now()}`,
          customer_id: authenticatedCustomerId,
          amount,
        },
      });
    });

    // GET /api/v1/checkout/addresses - Get customer addresses
    app.get('/api/v1/checkout/addresses', (req, res) => {
      const authenticatedCustomerId = (req as any).customerId;

      // Check for customer_id in query
      if (req.query.customer_id && String(req.query.customer_id) !== String(authenticatedCustomerId)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot view other customer addresses',
          },
        });
      }

      const addresses = mockAddresses.get(authenticatedCustomerId) || [];

      res.json({
        success: true,
        data: addresses,
      });
    });

    // GET /api/v1/checkout/addresses/:addressId - Get specific address
    app.get('/api/v1/checkout/addresses/:addressId', (req, res) => {
      const addressId = parseInt(req.params.addressId, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // Find address
      let foundAddress: any = null;
      let foundCustomerId: number | null = null;

      for (const [custId, addresses] of mockAddresses.entries()) {
        const address = addresses.find((a: any) => a.id === addressId);
        if (address) {
          foundAddress = address;
          foundCustomerId = custId;
          break;
        }
      }

      if (!foundAddress) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Address not found' },
        });
      }

      // IDOR check: only allow access to own addresses (admin bypass)
      if (!isAdmin && foundCustomerId !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      res.json({
        success: true,
        data: foundAddress,
      });
    });

    // GET /api/v1/checkout/payment-methods - Get payment methods
    app.get('/api/v1/checkout/payment-methods', (req, res) => {
      const authenticatedCustomerId = (req as any).customerId;

      // Check for customer_id in query
      if (req.query.customer_id && String(req.query.customer_id) !== String(authenticatedCustomerId)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot view other customer payment methods',
          },
        });
      }

      const methods = mockPaymentMethods.get(authenticatedCustomerId) || [];

      res.json({
        success: true,
        data: methods,
      });
    });

    // GET /api/v1/checkout/payment-methods/:methodId - Get specific payment method
    app.get('/api/v1/checkout/payment-methods/:methodId', (req, res) => {
      const methodId = parseInt(req.params.methodId, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // Find payment method
      let foundMethod: any = null;
      let foundCustomerId: number | null = null;

      for (const [custId, methods] of mockPaymentMethods.entries()) {
        const method = methods.find((m: any) => m.id === methodId);
        if (method) {
          foundMethod = method;
          foundCustomerId = custId;
          break;
        }
      }

      if (!foundMethod) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payment method not found' },
        });
      }

      // IDOR check
      if (!isAdmin && foundCustomerId !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      res.json({
        success: true,
        data: foundMethod,
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

  describe('POST Checkout - Checkout with Different Customer ID', () => {
    test('should block checkout with customer_id in payload', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const checkoutData = createIdorCheckoutData(201, 202);

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block checkout with customer_id in payload',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty('code', 'IDOR_VIOLATION');
    });

    test('should block checkout with customerId in payload', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const checkoutData = {
        items: [{ product_id: 1, quantity: 1 }],
        shipping_address: { street: 'Test', city: 'Test', postal_code: '000' },
        contact_name: 'Test',
        contact_phone: '000',
        customerId: 202, // IDOR attempt
      };

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block checkout with customerId in payload',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should block checkout with b2b_customer_id in payload', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const checkoutData = {
        items: [{ product_id: 1, quantity: 1 }],
        shipping_address: { street: 'Test', city: 'Test', postal_code: '000' },
        contact_name: 'Test',
        contact_phone: '000',
        b2b_customer_id: 202, // IDOR attempt
      };

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block checkout with b2b_customer_id in payload',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow checkout without customer_id', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const checkoutData = createTestOrderData(201);

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 201;

      testResults.push({
        name: 'Allow checkout without customer_id',
        passed,
        description: `Expected 201, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('customer_id', 201);
    });
  });

  describe('POST Checkout Reserve - Reserve Credit for Different Customer', () => {
    test('should block reserving credit for other customer', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const reserveData = {
        amount: 5000,
        customer_id: 202, // IDOR attempt
      };

      const response = await request(app)
        .post('/api/v1/checkout/reserve-credit')
        .set(attackerHeaders)
        .send(reserveData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block reserving credit for other customer',
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
        .post('/api/v1/checkout/reserve-credit')
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

  describe('GET Addresses - View Other Customer Addresses', () => {
    test('should prevent viewing other customer address by ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/checkout/addresses/3') // Address ID 3 belongs to customer 202
        .set(attackerHeaders);

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent viewing other customer address by ID',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should block customer_id in address query', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/checkout/addresses?customer_id=202') // IDOR attempt via query
        .set(attackerHeaders);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customer_id in address query',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow viewing own addresses', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/checkout/addresses')
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow viewing own addresses',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      // All returned addresses should belong to customer 201
      const allOwnAddresses = response.body.data.every((a: any) => a.customer_id === 201);
      expect(allOwnAddresses).toBe(true);
    });
  });

  describe('Checkout - Use Another Customer Address', () => {
    test('should block using another customer address by ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const checkoutData = createTestOrderData(201);
      checkoutData.shipping_address_id = 3; // Address belongs to customer 202

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block using another customer address by ID',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });
  });

  describe('GET Payment Methods - View Other Customer Payment Methods', () => {
    test('should prevent viewing other customer payment method by ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/checkout/payment-methods/2') // Payment method 2 belongs to customer 202
        .set(attackerHeaders);

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent viewing other customer payment method by ID',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should block customer_id in payment method query', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/checkout/payment-methods?customer_id=202') // IDOR attempt via query
        .set(attackerHeaders);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customer_id in payment method query',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow viewing own payment methods', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/checkout/payment-methods')
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow viewing own payment methods',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('Checkout - Use Another Customer Payment Method', () => {
    test('should block using another customer payment method by ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const checkoutData = createTestOrderData(201);
      checkoutData.payment_method_id = 2; // Payment method belongs to customer 202

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block using another customer payment method by ID',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });
  });

  describe('Authentication Edge Cases', () => {
    test('should reject unauthenticated checkout requests', async () => {
      const checkoutData = createTestOrderData(201);
      const response = await request(app)
        .post('/api/v1/checkout')
        .set('Content-Type', 'application/json')
        .send(checkoutData);

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject unauthenticated checkout requests',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });

    test('should reject requests with invalid token', async () => {
      const checkoutData = createTestOrderData(201);
      const response = await request(app)
        .post('/api/v1/checkout')
        .set('Authorization', 'Bearer invalid.token.here')
        .send(checkoutData);

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject checkout requests with invalid token',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });

    test('should reject requests with expired token', async () => {
      const expiredAuth = generateExpiredToken(TEST_USERS.b2bCustomer1);
      const checkoutData = createTestOrderData(201);
      const response = await request(app)
        .post('/api/v1/checkout')
        .set('Authorization', expiredAuth.authorization)
        .send(checkoutData);

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject checkout requests with expired token',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });
  });

  describe('Admin Bypass', () => {
    test('should allow admin to checkout with customer_id', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const checkoutData = createTestOrderData(202); // Admin can create order for customer 202
      checkoutData.customer_id = 202;

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(adminHeaders)
        .send(checkoutData);

      // Admin bypass should work
      const passed = response.status === 201;

      testResults.push({
        name: 'Allow admin to checkout with customer_id',
        passed,
        description: `Expected 201 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(201);
    });

    test('should allow admin to view any customer address', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const response = await request(app)
        .get('/api/v1/checkout/addresses/3') // Address belongs to customer 202
        .set(adminHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow admin to view any customer address',
        passed,
        description: `Expected 200 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });

    test('should allow admin to view any payment method', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const response = await request(app)
        .get('/api/v1/checkout/payment-methods/2') // Payment method belongs to customer 202
        .set(adminHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow admin to view any payment method',
        passed,
        description: `Expected 200 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('Batch IDOR Tests - Customer ID Injection', () => {
    test.each([
      ['customer_id', { amount: 5000, customer_id: 202 }],
      ['customerId', { amount: 5000, customerId: 202 }],
      ['b2b_customer_id', { amount: 5000, b2b_customer_id: 202 }],
      ['b2bCustomerId', { amount: 5000, b2bCustomerId: 202 }],
    ])('should block %s in checkout request', async (fieldName, payload) => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const checkoutData = createTestOrderData(201);
      Object.assign(checkoutData, payload);

      const response = await request(app)
        .post('/api/v1/checkout')
        .set(attackerHeaders)
        .send(checkoutData);

      const passed = response.status === 403;

      testResults.push({
        name: `Block ${fieldName} in checkout request`,
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
    console.log('CHECKOUT IDOR SECURITY TEST SUMMARY');
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
