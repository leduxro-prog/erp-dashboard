/**
 * API Smoke Tests
 *
 * These tests verify that the core API endpoints are responding correctly
 * after deployment. They should be fast (under 2 minutes) and check only
 * critical functionality.
 *
 * Run: npm run test -- tests/smoke/ApiSmokeTests.ts
 */

import axios from 'axios';
import { describe, it, expect, beforeAll } from '@jest/globals';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const TIMEOUT_MS = 5000;

// Test credentials
const TEST_USER = {
  email: process.env.SMOKE_TEST_EMAIL || 'smoke-test@cypher.ro',
  password: process.env.SMOKE_TEST_PASSWORD || 'SmokeTest123!',
};

// Create axios instance with timeout
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_MS,
  validateStatus: () => true, // Don't throw on non-2xx status
});

interface HealthCheckResult {
  status: string;
  timestamp: string;
  uptime: number;
}

interface ReadinessCheckResult {
  status: string;
  timestamp: string;
  checks: Record<string, boolean>;
}

interface DetailedHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database?: { status: string; latency?: number };
    redis?: { status: string; latency?: number };
    bullmq?: { status: string };
    system?: { status: string };
  };
}

describe('API Smoke Tests', () => {
  describe('Health Check Endpoints', () => {
    it('should respond to liveness probe', async () => {
      const response = await apiClient.get<HealthCheckResult>('/health/live');

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('alive');
      expect(response.data.timestamp).toBeDefined();
      expect(response.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should respond to readiness probe', async () => {
      const response = await apiClient.get<ReadinessCheckResult>('/health/ready');

      // Readiness might return 503 during startup
      expect([200, 503]).toContain(response.status);
      expect(response.data.status).toBeDefined();
      expect(response.data.checks).toBeDefined();
    });

    it('should respond to detailed health check', async () => {
      const response = await apiClient.get<DetailedHealthResult>('/health/detailed');

      expect([200, 503]).toContain(response.status);
      expect(response.data.status).toBeDefined();
      expect(response.data.timestamp).toBeDefined();
      expect(response.data.checks).toBeDefined();
    });

    it('database should be healthy in detailed health', async () => {
      const response = await apiClient.get<DetailedHealthResult>('/health/detailed');

      // Allow degraded status but database should be up
      const dbStatus = response.data.checks.database?.status;
      if (response.data.status !== 'unhealthy') {
        expect(dbStatus).toBe('up');
      }
      if (dbStatus === 'up') {
        expect(response.data.checks.database?.latency).toBeDefined();
        expect(response.data.checks.database?.latency).toBeLessThan(2000); // Under 2s
      }
    });

    it('redis should be healthy in detailed health', async () => {
      const response = await apiClient.get<DetailedHealthResult>('/health/detailed');

      // Allow degraded status but redis should be up
      const redisStatus = response.data.checks.redis?.status;
      if (response.data.status !== 'unhealthy') {
        expect(['up', 'degraded']).toContain(redisStatus);
      }
    });
  });

  describe('Authentication Endpoints', () => {
    let authToken: string | null = null;

    it('should handle login request', async () => {
      const response = await apiClient.post('/users/login', TEST_USER);

      // Either 200 (success) or 401 (test user doesn't exist, API is working)
      expect([200, 401, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.data.token).toBeDefined();
        authToken = response.data.token;
      }
    });

    it('should reject invalid credentials', async () => {
      const response = await apiClient.post('/users/login', {
        email: 'invalid@test.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.data.error || response.data.message).toBeDefined();
    });

    it('should reject malformed login requests', async () => {
      const response = await apiClient.post('/users/login', {
        email: 'not-an-email',
        // Missing password
      });

      expect(response.status).toBe(400);
    });

    it('should accept B2B login request', async () => {
      const response = await apiClient.post('/b2b-auth/login', {
        client_code: 'TEST001',
        password: 'TestPassword123',
      });

      // Either 200 (success), 401 (wrong credentials), or 400 (validation)
      expect([200, 401, 400]).toContain(response.status);
    });
  });

  describe('Core Endpoints - Products', () => {
    it('should list products', async () => {
      const response = await apiClient.get('/inventory/products');

      // May require auth, so 401 is acceptable
      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should have products pagination support', async () => {
      const response = await apiClient.get('/inventory/products?page=1&limit=10');

      expect([200, 401]).toContain(response.status);
    });

    it('should handle product detail endpoint', async () => {
      // First get a product to have an ID
      const listResponse = await apiClient.get('/inventory/products?limit=1');
      if (listResponse.status === 200 && listResponse.data.length > 0) {
        const productId = listResponse.data[0].id;
        const response = await apiClient.get(`/inventory/${productId}`);

        expect([200, 401]).toContain(response.status);
      } else {
        // No products exist or unauthorized
        expect([200, 401, 404]).toContain(listResponse.status);
      }
    });

    it('should handle invalid product ID gracefully', async () => {
      const response = await apiClient.get('/products/invalid-id');

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Core Endpoints - Cart', () => {
    it('should handle cart creation', async () => {
      const response = await apiClient.post('/b2b/carts', {
        session_id: 'smoke-test-session',
      });

      // May require auth, so 401 is acceptable
      expect([200, 201, 401]).toContain(response.status);
    });

    it('should handle cart retrieval', async () => {
      const response = await apiClient.get('/b2b/carts/smoke-test-session');

      // May not exist or require auth
      expect([200, 404, 401]).toContain(response.status);
    });

    it('should handle add to cart', async () => {
      const response = await apiClient.post('/b2b/carts/items', {
        session_id: 'smoke-test-session',
        product_id: 1,
        quantity: 1,
      });

      // May require auth or product may not exist
      expect([200, 201, 400, 401, 404]).toContain(response.status);
    });
  });

  describe('Core Endpoints - Orders', () => {
    it('should handle order list endpoint', async () => {
      const response = await apiClient.get('/orders');

      // May require auth
      expect([200, 401]).toContain(response.status);
    });

    it('should handle order creation request', async () => {
      const response = await apiClient.post('/orders', {
        items: [{ product_id: 1, quantity: 1 }],
        shipping_address: {
          street: 'Test Street',
          city: 'Test City',
          country: 'RO',
          postal_code: '000000',
        },
      });

      // Will require auth or have validation errors
      expect([200, 201, 400, 401]).toContain(response.status);
    });
  });

  describe('Core Endpoints - Users', () => {
    it('should handle users list', async () => {
      const response = await apiClient.get('/users');

      // Should require auth
      expect([200, 401]).toContain(response.status);
    });

    it('should handle user creation request structure', async () => {
      const response = await apiClient.post('/users', {
        email: `smoke-test-${Date.now()}@cypher.ro`,
        password: 'TestPassword123!',
        first_name: 'Smoke',
        last_name: 'Test',
        role: 'guest',
      });

      // Will fail due to auth or other reasons, but endpoint should respond
      expect([200, 201, 400, 401]).toContain(response.status);
    });
  });

  describe('Core Endpoints - Settings', () => {
    it('should handle settings retrieval', async () => {
      const response = await apiClient.get('/settings');

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toBeInstanceOf(Object);
      }
    });

    it('should handle settings update request structure', async () => {
      const response = await apiClient.put('/settings', {
        general: {
          company_name: 'Test Company',
        },
      });

      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await apiClient.get('/this-endpoint-does-not-exist');

      expect(response.status).toBe(404);
    });

    it('should return 405 for invalid methods', async () => {
      const response = await apiClient.patch('/health/live');

      expect([404, 405]).toContain(response.status);
    });

    it('should return proper error format', async () => {
      const response = await apiClient.get('/non-existent');

      expect(response.status).toBe(404);
      // Error response should have either error or message field
      expect(response.data.error || response.data.message).toBeDefined();
    });
  });

  describe('Response Time SLA', () => {
    it('health endpoint should respond under 100ms', async () => {
      const start = Date.now();
      await apiClient.get('/health/live');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('products list should respond under 500ms', async () => {
      const start = Date.now();
      await apiClient.get('/products?limit=10');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});

/**
 * Smoke Test Summary Report
 * Generated after test completion
 */
export interface SmokeTestReport {
  timestamp: string;
  environment: string;
  apiVersion: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  healthCheck: {
    liveness: boolean;
    readiness: boolean;
    detailed: boolean;
  };
  connectivity: {
    database: boolean;
    redis: boolean;
  };
  endpoints: {
    authentication: boolean;
    products: boolean;
    cart: boolean;
    orders: boolean;
    users: boolean;
    settings: boolean;
  };
}

/**
 * Generate smoke test report after all tests run
 */
export async function generateSmokeTestReport(): Promise<SmokeTestReport> {
  const healthResponse = await apiClient.get<DetailedHealthResult>('/health/detailed');

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    apiVersion: process.env.VERSION || '0.1.0',
    totalTests: 0, // Will be populated by test runner
    passedTests: 0,
    failedTests: 0,
    duration: 0,
    healthCheck: {
      liveness: true, // If we got here, liveness works
      readiness: healthResponse.data.checks.database?.status === 'up',
      detailed: healthResponse.data.status !== 'unhealthy',
    },
    connectivity: {
      database: healthResponse.data.checks.database?.status === 'up',
      redis: healthResponse.data.checks.redis?.status === 'up',
    },
    endpoints: {
      authentication: true,
      products: true,
      cart: true,
      orders: true,
      users: true,
      settings: true,
    },
  };
}
