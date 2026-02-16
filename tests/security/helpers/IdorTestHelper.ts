/**
 * IdorTestHelper
 * Utility functions for IDOR (Insecure Direct Object Reference) testing
 */

import { Response } from 'supertest';
import { TestUser } from './TestAuth';

/**
 * IDOR test result
 */
export interface IdorTestResult {
  /** Test name/description */
  testName: string;

  /** Whether IDOR was prevented (true = security working) */
  prevented: boolean;

  /** HTTP status code */
  statusCode: number;

  /** Response body */
  responseBody: Record<string, unknown>;

  /** Attack description */
  attack: string;

  /** Expected status code */
  expectedStatus: number;

  /** Test passed (prevention worked as expected) */
  passed: boolean;
}

/**
 * IDOR test case
 */
export interface IdorTestCase {
  /** Test name */
  name: string;

  /** Test description */
  description: string;

  /** Attacking user */
  attacker: TestUser;

  /** Victim user (resource owner) */
  victim: TestUser;

  /** Resource type */
  resourceType: string;

  /** Resource ID */
  resourceId: string | number;

  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** Endpoint path */
  endpoint: string;

  /** Request body (for POST/PUT/PATCH) */
  body?: Record<string, unknown>;

  /** Expected status code when IDOR is prevented */
  expectedStatus: number;

  /** Whether admin should be able to bypass */
  adminBypass: boolean;
}

/**
 * IDOR test suite
 */
export interface IdorTestSuite {
  /** Suite name */
  name: string;

  /** Description */
  description: string;

  /** Test cases */
  tests: IdorTestCase[];
}

/**
 * Create a GET IDOR test case
 *
 * @param name - Test name
 * @param attacker - Attacking user
 * @param victim - Victim user
 * @param resourceType - Type of resource
 * @param endpoint - API endpoint
 * @param resourceId - Resource ID to access
 * @returns IDOR test case
 */
export function createGetIdorTest(
  name: string,
  attacker: TestUser,
  victim: TestUser,
  resourceType: string,
  endpoint: string,
  resourceId: string | number
): IdorTestCase {
  return {
    name,
    description: `${attacker.email} attempts to GET ${resourceType} belonging to ${victim.email}`,
    attacker,
    victim,
    resourceType,
    resourceId,
    method: 'GET',
    endpoint: endpoint.replace(':id', String(resourceId)),
    expectedStatus: 403,
    adminBypass: true,
  };
}

/**
 * Create a POST IDOR test case with body injection
 *
 * @param name - Test name
 * @param attacker - Attacking user
 * @param victim - Victim user
 * @param resourceType - Type of resource
 * @param endpoint - API endpoint
 * @param body - Request body
 * @param injectedField - Field with injected customer ID
 * @returns IDOR test case
 */
export function createPostIdorTest(
  name: string,
  attacker: TestUser,
  victim: TestUser,
  resourceType: string,
  endpoint: string,
  body: Record<string, unknown>,
  injectedField: string
): IdorTestCase {
  return {
    name,
    description: `${attacker.email} attempts POST with ${injectedField}=${victim.customerId || victim.b2bCustomerId}`,
    attacker,
    victim,
    resourceType,
    resourceId: 'n/a',
    method: 'POST',
    endpoint,
    body,
    expectedStatus: 403,
    adminBypass: true,
  };
}

/**
 * Create a DELETE IDOR test case
 *
 * @param name - Test name
 * @param attacker - Attacking user
 * @param victim - Victim user
 * @param resourceType - Type of resource
 * @param endpoint - API endpoint
 * @param resourceId - Resource ID to delete
 * @returns IDOR test case
 */
export function createDeleteIdorTest(
  name: string,
  attacker: TestUser,
  victim: TestUser,
  resourceType: string,
  endpoint: string,
  resourceId: string | number
): IdorTestCase {
  return {
    name,
    description: `${attacker.email} attempts to DELETE ${resourceType} belonging to ${victim.email}`,
    attacker,
    victim,
    resourceType,
    resourceId,
    method: 'DELETE',
    endpoint: endpoint.replace(':id', String(resourceId)),
    expectedStatus: 403,
    adminBypass: true,
  };
}

/**
 * Assert IDOR is prevented
 *
 * @param result - Test result
 * @returns Assertion message
 */
export function assertIdorPrevented(result: IdorTestResult): string {
  if (!result.prevented) {
    return `FAIL: IDOR was NOT prevented. Attacker could access resource.
    Test: ${result.testName}
    Attack: ${result.attack}
    Status: ${result.statusCode}
    Expected: ${result.expectedStatus}
    Response: ${JSON.stringify(result.responseBody)}`;
  }

  return `PASS: IDOR was prevented. Attacker blocked from accessing resource.
    Test: ${result.testName}
    Attack: ${result.attack}
    Status: ${result.statusCode} (correct)`;
}

/**
 * Assert admin can bypass IDOR check
 *
 * @param result - Test result
 * @returns Assertion message
 */
export function assertAdminBypass(result: IdorTestResult): string {
  if (!result.prevented) {
    return `PASS: Admin successfully bypassed IDOR check as expected.
    Test: ${result.testName}
    Status: ${result.statusCode}`;
  }

  return `FAIL: Admin was incorrectly blocked.
    Test: ${result.testName}
    Status: ${result.statusCode}`;
}

/**
 * Analyze response for IDOR vulnerability
 *
 * @param response - HTTP response
 * @param test - Test case
 * @returns IDOR test result
 */
export function analyzeIdorResponse(
  response: Response,
  test: IdorTestCase
): IdorTestResult {
  const body = response.body as Record<string, unknown>;
  const is403Or404 = response.status === 403 || response.status === 404;
  const is401 = response.status === 401;

  // IDOR is prevented if we get 403/404/401
  const prevented = is403Or404 || is401;

  // Determine if this is an admin test
  const isAdmin = test.attacker.role === 'admin' || test.attacker.role === 'superadmin';

  // For admin tests, we expect success (200/201)
  const expectedForAdmin = isAdmin ? 200 : test.expectedStatus;

  return {
    testName: test.name,
    prevented,
    statusCode: response.status,
    responseBody: body,
    attack: test.description,
    expectedStatus: expectedForAdmin,
    passed: isAdmin ? response.status >= 200 && response.status < 300 : prevented,
  };
}

/**
 * Generate IDOR test report
 *
 * @param results - Test results
 * @returns Formatted report
 */
export function generateIdorReport(results: IdorTestResult[]): string {
  let report = '\n';
  report += '='.repeat(80) + '\n';
  report += 'IDOR SECURITY TEST REPORT\n';
  report += '='.repeat(80) + '\n\n';

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  report += `Total Tests: ${results.length}\n`;
  report += `Passed: ${passed}\n`;
  report += `Failed: ${failed}\n`;
  report += `Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n\n`;

  report += '-'.repeat(80) + '\n';
  report += 'FAILED TESTS\n';
  report += '-'.repeat(80) + '\n';

  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length === 0) {
    report += 'None!\n';
  } else {
    for (const test of failedTests) {
      report += `\n[FAILED] ${test.testName}\n`;
      report += `  Attack: ${test.attack}\n`;
      report += `  Status: ${test.statusCode} (expected: ${test.expectedStatus})\n`;
      report += `  Response: ${JSON.stringify(test.responseBody)}\n`;
    }
  }

  report += '\n' + '-'.repeat(80) + '\n';
  report += 'PASSED TESTS\n';
  report += '-'.repeat(80) + '\n';

  const passedTests = results.filter(r => r.passed);
  if (passedTests.length === 0) {
    report += 'None!\n';
  } else {
    for (const test of passedTests) {
      report += `\n[PASSED] ${test.testName}\n`;
      report += `  Attack: ${test.attack}\n`;
      report += `  Status: ${test.statusCode} (prevented IDOR)\n`;
    }
  }

  report += '\n' + '='.repeat(80) + '\n';

  return report;
}

/**
 * Cart IDOR test suite
 */
export function getCartIdorTestSuite(): IdorTestSuite {
  return {
    name: 'Cart IDOR Tests',
    description: 'Tests for IDOR vulnerabilities in cart endpoints',
    tests: [],
  };
}

/**
 * Order IDOR test suite
 */
export function getOrderIdorTestSuite(): IdorTestSuite {
  return {
    name: 'Order IDOR Tests',
    description: 'Tests for IDOR vulnerabilities in order endpoints',
    tests: [],
  };
}

/**
 * Credit IDOR test suite
 */
export function getCreditIdorTestSuite(): IdorTestSuite {
  return {
    name: 'Credit IDOR Tests',
    description: 'Tests for IDOR vulnerabilities in credit/payment endpoints',
    tests: [],
  };
}

/**
 * Checkout IDOR test suite
 */
export function getCheckoutIdorTestSuite(): IdorTestSuite {
  return {
    name: 'Checkout IDOR Tests',
    description: 'Tests for IDOR vulnerabilities in checkout flow',
    tests: [],
  };
}

/**
 * Mock Express request for testing
 */
export interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  securityContext?: {
    userId: string | number;
    email: string;
    role: string;
    customerId?: string | number;
    b2bCustomerId?: string | number;
  };
}

/**
 * Create mock request for middleware testing
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param user - Authenticated user
 * @param body - Request body
 * @returns Mock request
 */
export function createMockRequest(
  method: string,
  path: string,
  user: TestUser,
  body?: Record<string, unknown>
): MockRequest {
  return {
    method,
    path,
    headers: {
      'content-type': 'application/json',
    },
    body,
    query: {},
    params: {},
    securityContext: {
      userId: user.id,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      b2bCustomerId: user.b2bCustomerId,
    },
  };
}

/**
 * Create mock response for middleware testing
 */
export class MockResponse {
  public statusCode: number = 200;
  public headers: Record<string, string> = {};
  public body: Record<string, unknown> | string | null = null;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: Record<string, unknown>): this {
    this.body = body;
    return this;
  }

  send(body: unknown): this {
    this.body = body as Record<string, unknown>;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }
}

/**
 * Common customer ID injection payloads for testing
 */
export const CUSTOMER_ID_INJECTION_PAYLOADS = {
  direct: { customer_id: '999' },
  camelCase: { customerId: '999' },
  b2bDirect: { b2b_customer_id: '999' },
  b2bCamel: { b2bCustomerId: '999' },
  userId: { user_id: '999' },
  userIdCamel: { userId: '999' },
  nested: { data: { customer_id: '999' } },
  array: { items: [{ customer_id: '999' }] },
};

/**
 * Common IDOR attack patterns
 */
export const IDOR_ATTACK_PATTERNS = [
  'Direct parameter manipulation',
  'Body injection',
  'Nested field injection',
  'Array index manipulation',
  'Header manipulation',
  'Cookie manipulation',
  'Path traversal',
  'ID enumeration',
];
