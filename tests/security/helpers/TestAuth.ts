/**
 * TestAuth Helper
 * Utility functions for authentication in security tests
 */

import jwt from 'jsonwebtoken';
import { JwtPayload } from '@modules/security/src/types/AuthContext';

/**
 * Test user data
 */
export interface TestUser {
  /** User ID */
  id: string | number;

  /** User email */
  email: string;

  /** User role */
  role: string;

  /** Customer ID (if applicable) */
  customerId?: string | number;

  /** B2B customer ID (if applicable) */
  b2bCustomerId?: string | number;

  /** Permissions */
  permissions?: string[];

  /** Token realm */
  realm?: 'erp' | 'b2b';
}

/**
 * Auth token result
 */
export interface AuthTokenResult {
  /** JWT token */
  token: string;

  /** Authorization header value */
  authorization: string;

  /** User data */
  user: TestUser;

  /** Token payload */
  payload: JwtPayload;
}

/**
 * Test customer data
 */
export interface TestCustomer {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'b2b_customer';
  tier?: string;
  company_name?: string;
  credit_limit?: number;
  credit_used?: number;
}

/**
 * Default test users
 */
export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    id: 1,
    email: 'admin@cypher.ro',
    role: 'admin',
    realm: 'erp',
  },
  manager: {
    id: 2,
    email: 'manager@cypher.ro',
    role: 'manager',
    realm: 'erp',
  },
  regularUser: {
    id: 3,
    email: 'user@cypher.ro',
    role: 'user',
    customerId: 101,
    realm: 'erp',
  },
  b2bCustomer1: {
    id: 4,
    email: 'customer1@company.ro',
    role: 'b2b_customer',
    b2bCustomerId: 201,
    customerId: 201,
    realm: 'b2b',
    company_name: 'Company One',
    tier: 'STANDARD',
  },
  b2bCustomer2: {
    id: 5,
    email: 'customer2@company.ro',
    role: 'b2b_customer',
    b2bCustomerId: 202,
    customerId: 202,
    realm: 'b2b',
    company_name: 'Company Two',
    tier: 'PREMIUM',
  },
};

/**
 * Default test customers
 */
export const TEST_CUSTOMERS: TestCustomer[] = [
  {
    id: 201,
    email: 'customer1@company.ro',
    name: 'Company One',
    role: 'b2b_customer',
    tier: 'STANDARD',
    company_name: 'Company One',
    credit_limit: 10000,
    credit_used: 0,
  },
  {
    id: 202,
    email: 'customer2@company.ro',
    name: 'Company Two',
    role: 'b2b_customer',
    tier: 'PREMIUM',
    company_name: 'Company Two',
    credit_limit: 50000,
    credit_used: 15000,
  },
  {
    id: 203,
    email: 'customer3@company.ro',
    name: 'Company Three',
    role: 'b2b_customer',
    tier: 'ENTERPRISE',
    company_name: 'Company Three',
    credit_limit: 100000,
    credit_used: 45000,
  },
];

/**
 * JWT Secrets for testing
 */
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens';
const JWT_SECRET_B2B = process.env.JWT_SECRET_B2B || 'test-b2b-secret-key-for-jwt-tokens';

/**
 * Generate JWT token for testing
 *
 * @param user - Test user data
 * @param secret - Optional custom secret
 * @param expiresIn - Token expiration (default: '1h')
 * @returns Auth token result
 */
export function generateAuthToken(
  user: TestUser,
  secret?: string,
  expiresIn: string = '1h'
): AuthTokenResult {
  const secretToUse = secret || (user.realm === 'b2b' ? JWT_SECRET_B2B : JWT_SECRET);

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    realm: user.realm || 'erp',
    b2b_customer_id: user.b2bCustomerId,
    customer_id: user.customerId,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    jti: `test_${user.id}_${Date.now()}`,
    version: 1,
  };

  const token = jwt.sign(payload, secretToUse, {
    expiresIn,
    issuer: 'cypher-erp',
    audience: 'cypher-erp-api',
    algorithm: 'HS256',
    jwtid: payload.jti,
  });

  return {
    token,
    authorization: `Bearer ${token}`,
    user,
    payload,
  };
}

/**
 * Generate expired JWT token
 *
 * @param user - Test user data
 * @returns Auth token result with expired token
 */
export function generateExpiredToken(user: TestUser): AuthTokenResult {
  const secretToUse = user.realm === 'b2b' ? JWT_SECRET_B2B : JWT_SECRET;

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    realm: user.realm || 'erp',
    b2b_customer_id: user.b2bCustomerId,
    customer_id: user.customerId,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  };

  const token = jwt.sign(payload, secretToUse, {
    expiresIn: '-1h', // Already expired
    issuer: 'cypher-erp',
    audience: 'cypher-erp-api',
  });

  return {
    token,
    authorization: `Bearer ${token}`,
    user,
    payload,
  };
}

/**
 * Generate invalid JWT token
 *
 * @returns Invalid token
 */
export function generateInvalidToken(): string {
  return 'Bearer invalid.token.here';
}

/**
 * Get authentication headers for user
 *
 * @param userKey - Key from TEST_USERS
 * @returns Headers object
 */
export function getAuthHeaders(userKey: string): Record<string, string> {
  const user = TEST_USERS[userKey];
  const auth = generateAuthToken(user);

  return {
    Authorization: auth.authorization,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a request context with authentication
 *
 * @param user - Test user
 * @returns Mock request object
 */
export function createAuthRequest(user: TestUser): {
  headers: Record<string, string>;
  user: TestUser;
  token: string;
} {
  const auth = generateAuthToken(user);

  return {
    headers: {
      Authorization: auth.authorization,
      'Content-Type': 'application/json',
    },
    user,
    token: auth.token,
  };
}

/**
 * Parse JWT from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Decoded payload
 */
export function parseAuthHeader(authHeader: string): JwtPayload | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const secret = authHeader.includes('B2B') ? JWT_SECRET_B2B : JWT_SECRET;

    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Generate multiple auth tokens for parallel testing
 *
 * @param userKeys - Array of user keys from TEST_USERS
 * @returns Map of user keys to auth headers
 */
export function generateMultipleAuthTokens(
  userKeys: string[]
): Map<string, Record<string, string>> {
  const tokens = new Map<string, Record<string, string>>();

  for (const key of userKeys) {
    tokens.set(key, getAuthHeaders(key));
  }

  return tokens;
}

/**
 * Create test cart data
 *
 * @param customerId - Customer ID
 * @returns Test cart data
 */
export function createTestCartData(customerId: number) {
  return {
    items: [
      {
        product_id: 1,
        quantity: 2,
      },
      {
        product_id: 2,
        quantity: 1,
      },
    ],
    customer_id: customerId,
  };
}

/**
 * Create test order data
 *
 * @param customerId - Customer ID
 * @returns Test order data
 */
export function createTestOrderData(customerId: number) {
  return {
    items: [
      {
        product_id: 1,
        quantity: 2,
      },
    ],
    shipping_address: {
      street: 'Test Street 123',
      city: 'Bucharest',
      postal_code: '010101',
      country: 'Romania',
    },
    billing_address: {
      street: 'Test Street 123',
      city: 'Bucharest',
      postal_code: '010101',
      country: 'Romania',
    },
    contact_name: 'Test Contact',
    contact_phone: '+40700123456',
    payment_method: 'CREDIT',
  };
}

/**
 * Create test checkout data with customer_id injection attempt
 *
 * @param attackerCustomerId - Customer ID of attacker
 * @param victimCustomerId - Customer ID to attempt access
 * @returns Test checkout data with injected customer_id
 */
export function createIdorCheckoutData(
  attackerCustomerId: number,
  victimCustomerId: number
) {
  return {
    items: [
      {
        product_id: 1,
        quantity: 1,
      },
    ],
    shipping_address: {
      street: 'Attacker Street 1',
      city: 'Attacker City',
      postal_code: '000000',
    },
    contact_name: 'Attacker Name',
    contact_phone: '+40000000000',
    payment_method: 'CREDIT',
    // IDOR attempt: try to checkout for different customer
    customer_id: victimCustomerId,
  };
}
