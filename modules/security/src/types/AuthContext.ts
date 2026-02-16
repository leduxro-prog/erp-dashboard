import type { Request } from 'express';

/**
 * AuthContext Types
 * Enterprise-level authentication and authorization types for security module
 */

/**
 * JWT Payload structure for ERP users
 */
export interface JwtPayload {
  /** Subject - user identifier */
  sub: string | number;

  /** User email */
  email: string;

  /** User role */
  role: string;

  /** Token realm - 'erp', 'b2b', etc. */
  realm: 'erp' | 'b2b' | string;

  /** B2B customer ID (if applicable) */
  b2b_customer_id?: string | number;

  /** Regular customer ID (if applicable) */
  customer_id?: string | number;

  /** Permission flags */
  permissions?: string[];

  /** Issued at timestamp */
  iat?: number;

  /** Expiration timestamp */
  exp?: number;

  /** JWT ID for revocation tracking */
  jti?: string;

  /** Token version for forced logout */
  version?: number;
}

/**
 * Security context attached to authenticated requests
 */
export interface SecurityContext {
  /** User ID from JWT subject */
  userId: string | number;

  /** User email from JWT */
  email: string;

  /** User role for RBAC */
  role: string;

  /** Token realm */
  realm: string;

  /** B2B customer ID (if user is a B2B customer) */
  b2bCustomerId?: string | number;

  /** Regular customer ID (if user is a customer) */
  customerId?: string | number;

  /** User permissions */
  permissions?: string[];

  /** Token identifier for revocation tracking */
  tokenId?: string;

  /** Token version for forced logout */
  tokenVersion?: number;

  /** Whether user is admin (shortcut) */
  isAdmin: boolean;

  /** Whether request is from API key (vs JWT) */
  isApiKey?: boolean;
}

/**
 * Resource ownership check result
 */
export interface OwnershipResult {
  /** Whether the authenticated user owns the resource */
  owns: boolean;

  /** Reason for denial (if owns is false) */
  reason?: string;

  /** Resource type */
  resourceType: string;

  /** Resource identifier */
  resourceId: string | number;
}

/**
 * IDOR violation details for logging
 */
export interface IdorViolation {
  /** Violation type */
  type: 'direct_access' | 'body_injection' | 'param_manipulation' | 'header_manipulation';

  /** Target customer ID that was attempted to access */
  targetCustomerId: string | number;

  /** Authenticated customer ID */
  authenticatedCustomerId: string | number;

  /** Resource type */
  resourceType: string;

  /** Resource ID */
  resourceId?: string | number;

  /** Endpoint path */
  endpoint: string;

  /** HTTP method */
  method: string;

  /** IP address of requester */
  ip: string;

  /** User agent */
  userAgent?: string;

  /** Timestamp */
  timestamp: Date;

  /** Request ID for correlation */
  requestId?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Audit log entry for security events
 */
export interface SecurityAuditLog {
  /** Log entry ID */
  id?: string;

  /** Event type */
  eventType: 'auth' | 'idor_attempt' | 'authz_check' | 'token_revoked' | 'session_invalid';

  /** Event severity */
  severity: 'info' | 'warning' | 'error' | 'critical';

  /** User ID (if authenticated) */
  userId?: string | number;

  /** Customer ID (if applicable) */
  customerId?: string | number;

  /** Event description */
  description: string;

  /** Details object */
  details: Record<string, unknown>;

  /** IP address */
  ip: string;

  /** User agent */
  userAgent?: string;

  /** Request ID for correlation */
  requestId?: string;

  /** Timestamp */
  timestamp: Date;

  /** Success/failure */
  success: boolean;
}

/**
 * Token revocation check result
 */
export interface TokenRevocationCheck {
  /** Whether token is valid */
  isValid: boolean;

  /** Revocation reason (if invalid) */
  revocationReason?: string;

  /** Revocation timestamp (if invalid) */
  revokedAt?: Date;

  /** Token version mismatch (if applicable) */
  versionMismatch?: boolean;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  /** Whether session is valid */
  isValid: boolean;

  /** Invalid reason (if invalid) */
  invalidReason?: string;

  /** Session expiry time */
  expiresAt?: Date;

  /** Time remaining in session */
  timeRemaining?: number;

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** JWT secret for ERP tokens */
  jwtSecret: string;

  /** JWT secret for B2B tokens */
  jwtSecretB2B?: string;

  /** Token expiration in seconds */
  tokenExpiration: number;

  /** Refresh token expiration in seconds */
  refreshTokenExpiration: number;

  /** Whether to enable token revocation */
  enableRevocation: boolean;

  /** Whether to enable audit logging */
  enableAuditLogging: boolean;

  /** Whether to enable IDOR prevention */
  enableIdorPrevention: boolean;

  /** Strict mode - block all IDOR attempts */
  strictIdorMode: boolean;

  /** Whether to log IDOR violations */
  logIdorViolations: boolean;

  /** Allowed customer ID fields (for validation) */
  allowedCustomerIdFields: string[];

  /** Blocked customer ID patterns (regex) */
  blockedCustomerIdPatterns: string[];

  /** Admin roles that bypass IDOR checks */
  adminRoles: string[];

  /** Rate limiting for failed auth attempts */
  rateLimitAuthAttempts: number;

  /** Rate limiting window in seconds */
  rateLimitWindow: number;
}

/**
 * Request validation options
 */
export interface ValidationOptions {
  /** Whether to strip customer_id from body */
  stripCustomerIdFromBody: boolean;

  /** Whether to validate resource ownership */
  validateOwnership: boolean;

  /** Whether to allow admin bypass */
  allowAdminBypass: boolean;

  /** Custom ownership validator function */
  customOwnershipValidator?: (
    resourceType: string,
    resourceId: string | number,
    customerId: string | number
  ) => Promise<boolean>;

  /** Fields to block from request body */
  blockedFields: string[];

  /** Fields to sanitize (remove special chars) */
  sanitizeFields: string[];
}

/**
 * Express request extensions for security module
 */
export interface SecurityRequest extends Request {
  /** Security context with authenticated user info */
  securityContext?: SecurityContext;

  /** Original JWT token */
  token?: string;

  /** Whether IDOR check was performed */
  idorChecked?: boolean;

  /** Ownership check result */
  ownershipResult?: OwnershipResult;

  /** Request timestamp */
  requestTime?: Date;

  /** Risk score (0-100) */
  riskScore?: number;
}
