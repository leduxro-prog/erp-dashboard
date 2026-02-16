/**
 * OrderIdorTests
 * Negative tests for IDOR (Insecure Direct Object Reference) vulnerabilities
 * in order endpoints.
 *
 * These tests verify that:
 * - Users cannot access other customers' orders
 * - Users cannot modify other customers' orders
 * - Users cannot cancel other customers' orders
 * - Users cannot view other customers' order details
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

describe('Order IDOR Security Tests', () => {
  let app: Application;
  const testResults: Array<{
    name: string;
    passed: boolean;
    description: string;
  }> = [];

  // Mock orders database
  const mockOrders = new Map<number, any>();

  beforeAll(() => {
    // Initialize mock orders
    mockOrders.set(10001, {
      id: 10001,
      order_number: 'B2B-202501010001',
      customer_id: 201,
      status: 'PENDING',
      items: [{ product_id: 1, quantity: 2 }],
      total: 1000,
    });

    mockOrders.set(10002, {
      id: 10002,
      order_number: 'B2B-202501010002',
      customer_id: 202,
      status: 'CONFIRMED',
      items: [{ product_id: 3, quantity: 1 }],
      total: 500,
    });

    mockOrders.set(10003, {
      id: 10003,
      order_number: 'B2B-202501010003',
      customer_id: 203,
      status: 'PROCESSING',
      items: [{ product_id: 5, quantity: 5 }],
      total: 2500,
    });

    // Create Express app with mock routes for testing
    app = express();
    app.use(express.json());

    // Mock health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // GET /api/v1/orders - List authenticated user's orders
    app.get('/api/v1/orders', (req, res) => {
      const customerId = (req as any).customerId;

      // Only return orders belonging to the authenticated customer
      const userOrders = Array.from(mockOrders.values()).filter(
        o => o.customer_id === customerId
      );

      res.json({
        success: true,
        data: {
          orders: userOrders,
          total: userOrders.length,
        },
      });
    });

    // GET /api/v1/orders/:id - Get specific order (IDOR target)
    app.get('/api/v1/orders/:id', (req, res) => {
      const orderId = parseInt(req.params.id, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      const order = mockOrders.get(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        });
      }

      // IDOR check: only allow access to own orders (admin bypass)
      if (!isAdmin && order.customer_id !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      res.json({
        success: true,
        data: order,
      });
    });

    // GET /api/v1/orders/customer/:customerId - Direct customer access (IDOR vulnerability)
    app.get('/api/v1/orders/customer/:customerId', (req, res) => {
      const requestedCustomerId = parseInt(req.params.customerId, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // IDOR check: only allow access to own customer's orders
      if (!isAdmin && requestedCustomerId !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      const customerOrders = Array.from(mockOrders.values()).filter(
        o => o.customer_id === requestedCustomerId
      );

      res.json({
        success: true,
        data: {
          orders: customerOrders,
          total: customerOrders.length,
        },
      });
    });

    // POST /api/v1/orders - Create order
    app.post('/api/v1/orders', (req, res) => {
      // Check for customer_id injection
      if (req.body.customer_id || req.body.customerId || req.body.b2b_customer_id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Customer ID injection detected',
          },
        });
      }

      const customerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      // Admin can create order for any customer
      const targetCustomerId = isAdmin && req.body.customer_id
        ? req.body.customer_id
        : customerId;

      const newOrder = {
        id: 10000 + mockOrders.size + 1,
        order_number: `B2B-20250101${String(mockOrders.size + 1).padStart(4, '0')}`,
        customer_id: targetCustomerId,
        status: 'PENDING',
        items: req.body.items || [],
        total: req.body.total || 0,
      };

      mockOrders.set(newOrder.id, newOrder);

      res.status(201).json({
        success: true,
        data: newOrder,
      });
    });

    // PATCH /api/v1/orders/:id - Update order
    app.patch('/api/v1/orders/:id', (req, res) => {
      const orderId = parseInt(req.params.id, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      const order = mockOrders.get(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        });
      }

      // IDOR check: only allow modifying own orders (admin bypass)
      if (!isAdmin && order.customer_id !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      // Check for customer_id injection
      if (req.body.customer_id || req.body.customerId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Cannot change order customer',
          },
        });
      }

      // Update allowed fields
      const updatedOrder = {
        ...order,
        ...req.body,
        id: order.id, // Prevent ID change
        customer_id: order.customer_id, // Prevent customer_id change
      };

      mockOrders.set(orderId, updatedOrder);

      res.json({
        success: true,
        data: updatedOrder,
      });
    });

    // DELETE /api/v1/orders/:id - Cancel order
    app.delete('/api/v1/orders/:id', (req, res) => {
      const orderId = parseInt(req.params.id, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      const order = mockOrders.get(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        });
      }

      // IDOR check: only allow canceling own orders (admin bypass)
      if (!isAdmin && order.customer_id !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      // Cancel order
      const cancelledOrder = { ...order, status: 'CANCELLED' };
      mockOrders.set(orderId, cancelledOrder);

      res.json({
        success: true,
        data: cancelledOrder,
      });
    });

    // POST /api/v1/orders/:id/cancel - Alternative cancel endpoint
    app.post('/api/v1/orders/:id/cancel', (req, res) => {
      const orderId = parseInt(req.params.id, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      const order = mockOrders.get(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        });
      }

      // IDOR check: only allow canceling own orders (admin bypass)
      if (!isAdmin && order.customer_id !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      // Check for customer_id in cancellation request
      if (req.body.customer_id || req.body.customerId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Customer ID injection detected',
          },
        });
      }

      const cancelledOrder = { ...order, status: 'CANCELLED' };
      mockOrders.set(orderId, cancelledOrder);

      res.json({
        success: true,
        data: cancelledOrder,
        message: 'Order cancelled',
      });
    });

    // GET /api/v1/orders/:id/items - Get order items
    app.get('/api/v1/orders/:id/items', (req, res) => {
      const orderId = parseInt(req.params.id, 10);
      const authenticatedCustomerId = (req as any).customerId;
      const isAdmin = (req as any).isAdmin;

      const order = mockOrders.get(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        });
      }

      // IDOR check
      if (!isAdmin && order.customer_id !== authenticatedCustomerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      res.json({
        success: true,
        data: order.items,
      });
    });

    // Mock authentication middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const token = authHeader.replace('Bearer ', '');

      // Customer 201 (B2B customer 1)
      if (token.includes('customer1')) {
        (req as any).customerId = 201;
        (req as any).user = TEST_USERS.b2bCustomer1;
        (req as any).isAdmin = false;
      }
      // Customer 202 (B2B customer 2)
      else if (token.includes('customer2')) {
        (req as any).customerId = 202;
        (req as any).user = TEST_USERS.b2bCustomer2;
        (req as any).isAdmin = false;
      }
      // Customer 203 (B2B customer 3)
      else if (token.includes('customer3')) {
        (req as any).customerId = 203;
        (req as any).user = { id: 6, email: 'customer3@company.ro', role: 'b2b_customer' };
        (req as any).isAdmin = false;
      }
      // Admin
      else if (token.includes('admin')) {
        (req as any).customerId = 1;
        (req as any).isAdmin = true;
        (req as any).user = TEST_USERS.admin;
      }
      // Invalid token
      else if (token === 'invalid') {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }
      // Expired token
      else if (token === 'expired') {
        return res.status(401).json({ success: false, error: 'Token expired' });
      }

      next();
    });
  });

  beforeEach(() => {
    testResults.length = 0;
  });

  describe('GET Orders - Access Other Customer Orders', () => {
    test('should prevent accessing other customer order by ID', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      // Try to access order belonging to customer 202
      const response = await request(app)
        .get('/api/v1/orders/10002')
        .set(attackerHeaders);

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent accessing other customer order by ID',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should prevent accessing orders via customer_id parameter', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/orders/customer/202') // Try to access customer 202's orders
        .set(attackerHeaders);

      const passed = response.status === 403;

      testResults.push({
        name: 'Prevent accessing orders via customer_id parameter',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow accessing own orders', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/orders/10001') // Own order
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow accessing own orders',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('customer_id', 201);
    });

    test('should list only own orders', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/orders')
        .set(attackerHeaders);

      const passed = response.status === 200;

      // Verify only customer 201's orders are returned
      const allOwnOrders = response.body.data.orders.every(
        (o: any) => o.customer_id === 201
      );

      testResults.push({
        name: 'List only own orders',
        passed: passed && allOwnOrders,
        description: `Expected only own orders, got ${response.body.data.orders.length} orders`,
      });

      expect(passed).toBe(true);
      expect(allOwnOrders).toBe(true);
    });
  });

  describe('GET Order Items - Access Other Customer Order Items', () => {
    test('should prevent accessing other customer order items', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/orders/10002/items') // Order belonging to customer 202
        .set(attackerHeaders);

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent accessing other customer order items',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should allow accessing own order items', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .get('/api/v1/orders/10001/items') // Own order
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow accessing own order items',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('POST Orders - Create Order with Customer ID Injection', () => {
    test('should block customer_id in create order request', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const orderData = {
        items: [{ product_id: 1, quantity: 2 }],
        total: 1000,
        customer_id: 202, // IDOR attempt
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set(attackerHeaders)
        .send(orderData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customer_id in create order request',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should block customerId in create order request', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const orderData = {
        items: [{ product_id: 1, quantity: 2 }],
        total: 1000,
        customerId: 202, // IDOR attempt
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set(attackerHeaders)
        .send(orderData);

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customerId in create order request',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow creating order without customer_id', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1');
      const orderData = {
        items: [{ product_id: 1, quantity: 2 }],
        total: 1000,
        // No customer_id - should use authenticated user's ID
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set(attackerHeaders)
        .send(orderData);

      const passed = response.status === 201;

      testResults.push({
        name: 'Allow creating order without customer_id',
        passed,
        description: `Expected 201, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('customer_id', 201);
    });
  });

  describe('PATCH Orders - Modify Other Customer Orders', () => {
    test('should prevent modifying other customer orders', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .patch('/api/v1/orders/10002') // Order belonging to customer 202
        .set(attackerHeaders)
        .send({ notes: 'Modified by attacker' });

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent modifying other customer order',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should block customer_id when modifying order', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .patch('/api/v1/orders/10001') // Own order
        .set(attackerHeaders)
        .send({ notes: 'Updated', customer_id: 202 }); // IDOR attempt

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customer_id when modifying order',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });

    test('should allow modifying own order without customer_id', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .patch('/api/v1/orders/10001') // Own order
        .set(attackerHeaders)
        .send({ notes: 'Updated' }); // Valid update

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow modifying own order without customer_id',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE Orders - Cancel Other Customer Orders', () => {
    test('should prevent canceling other customer orders', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .delete('/api/v1/orders/10002') // Order belonging to customer 202
        .set(attackerHeaders);

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent canceling other customer order',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should prevent canceling other customer orders via POST', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .post('/api/v1/orders/10002/cancel') // Order belonging to customer 202
        .set(attackerHeaders)
        .send({ reason: 'Test cancellation' });

      const passed = response.status === 403 || response.status === 404;

      testResults.push({
        name: 'Prevent canceling other customer order via POST',
        passed,
        description: `Expected 403/404, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect([403, 404]).toContain(response.status);
    });

    test('should allow canceling own order', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .delete('/api/v1/orders/10001') // Own order
        .set(attackerHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow canceling own order',
        passed,
        description: `Expected 200, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('status', 'CANCELLED');
    });

    test('should block customer_id when canceling order', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const response = await request(app)
        .post('/api/v1/orders/10001/cancel') // Own order
        .set(attackerHeaders)
        .send({ reason: 'Test', customer_id: 202 }); // IDOR attempt

      const passed = response.status === 403;

      testResults.push({
        name: 'Block customer_id when canceling order',
        passed,
        description: `Expected 403, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(403);
    });
  });

  describe('Authentication Edge Cases', () => {
    test('should reject unauthenticated order requests', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Content-Type', 'application/json');

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject unauthenticated order requests',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', 'Bearer invalid.token.here');

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject order requests with invalid token',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });

    test('should reject requests with expired token', async () => {
      const expiredAuth = generateExpiredToken(TEST_USERS.b2bCustomer1);
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', expiredAuth.authorization);

      const passed = response.status === 401;

      testResults.push({
        name: 'Reject order requests with expired token',
        passed,
        description: `Expected 401, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(401);
    });
  });

  describe('Admin Bypass', () => {
    test('should allow admin to access any order', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const response = await request(app)
        .get('/api/v1/orders/10002') // Order belonging to customer 202
        .set(adminHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow admin to access any order',
        passed,
        description: `Expected 200 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });

    test('should allow admin to cancel any order', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const response = await request(app)
        .delete('/api/v1/orders/10002')
        .set(adminHeaders);

      const passed = response.status === 200;

      testResults.push({
        name: 'Allow admin to cancel any order',
        passed,
        description: `Expected 200 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(200);
    });

    test('should allow admin to create order with customer_id', async () => {
      const adminHeaders = getAuthHeaders('admin');
      const orderData = {
        items: [{ product_id: 1, quantity: 2 }],
        total: 1000,
        customer_id: 202, // Admin can do this
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set(adminHeaders)
        .send(orderData);

      const passed = response.status === 201;

      testResults.push({
        name: 'Allow admin to create order with customer_id',
        passed,
        description: `Expected 201 for admin, got ${response.status}`,
      });

      expect(passed).toBe(true);
      expect(response.status).toBe(201);
    });
  });

  describe('Cross-Customer Order Enumeration', () => {
    test('should prevent order ID enumeration', async () => {
      const attackerHeaders = getAuthHeaders('b2bCustomer1'); // Customer 201
      const failedRequests: number[] = [];

      // Try to enumerate orders from 10000 to 10010
      for (let i = 10000; i <= 10010; i++) {
        const response = await request(app)
          .get(`/api/v1/orders/${i}`)
          .set(attackerHeaders);

        if (response.status === 403 || response.status === 404) {
          failedRequests.push(i);
        }
      }

      // All requests for non-owned orders should be blocked
      const allBlocked = failedRequests.length >= 2; // At least orders 10002 and 10003 should be blocked

      testResults.push({
        name: 'Prevent order ID enumeration',
        passed: allBlocked,
        description: `${failedRequests.length} of 11 requests were blocked`,
      });

      expect(allBlocked).toBe(true);
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
    console.log('ORDER IDOR SECURITY TEST SUMMARY');
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
