/**
 * IdorPrevention Middleware
 * Enterprise-level Insecure Direct Object Reference (IDOR) prevention middleware.
 *
 * This middleware prevents IDOR attacks by:
 * 1. Blocking customerId from request body/params
 * 2. Validating resource ownership
 * 3. Detecting IDOR attempt patterns
 * 4. Logging security incidents
 * 5. Sanitizing requests to remove unauthorized customer IDs
 */

import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '@shared/utils/logger';
import { ForbiddenError } from '@shared/errors/BaseError';
import {
  SecurityRequest,
  IdorViolation,
  SecurityAuditLog,
  OwnershipResult,
} from '../types/AuthContext';

const logger = createModuleLogger('idor-prevention-middleware');

/**
 * IDOR prevention configuration
 */
export interface IdorPreventionOptions {
  /** Whether to enable IDOR prevention (default: true) */
  enabled?: boolean;

  /** Strict mode - block all IDOR attempts (default: true) */
  strictMode?: boolean;

  /** Whether to log IDOR violations (default: true) */
  logViolations?: boolean;

  /** Admin roles that bypass IDOR checks (default: ['admin', 'superadmin']) */
  adminRoles?: string[];

  /** Fields that indicate customer ID (default: ['customer_id', 'customerId']) */
  customerIdFields?: string[];

  /** Fields to block from request body (e.g., 'user_id', 'userId') */
  blockedFields?: string[];

  /** Paths/endpoints that skip IDOR checks (regex patterns) */
  skipPaths?: RegExp[];

  /** Custom ownership validator function */
  customOwnershipValidator?: (
    resourceType: string,
    resourceId: string | number,
    customerId: string | number,
    req: SecurityRequest
  ) => Promise<boolean>;

  /** Custom violation handler */
  onViolation?: (violation: IdorViolation, req: SecurityRequest) => void | Promise<void>;
}

/**
 * Default IDOR prevention options
 */
const DEFAULT_IDOR_OPTIONS: IdorPreventionOptions = {
  enabled: true,
  strictMode: true,
  logViolations: true,
  adminRoles: ['admin', 'superadmin'],
  customerIdFields: ['customer_id', 'customerId', 'b2b_customer_id', 'b2bCustomerId'],
  blockedFields: ['user_id', 'userId', 'created_by', 'updated_by', 'owner_id', 'ownerId'],
  skipPaths: [
    /^\/api\/v1\/admin/,
    /^\/api\/v1\/internal/,
    /^\/health$/,
    /^\/metrics$/,
  ],
};

/**
 * Resource type detection from path patterns
 */
const RESOURCE_TYPE_PATTERNS: Record<string, RegExp> = {
  cart: /\/cart/i,
  'cart-item': /\/cart\/.*\/item/i,
  order: /\/order/i,
  'order-item': /\/order\/.*\/item/i,
  credit: /\/credit/i,
  'credit-transaction': /\/credit\/transaction/i,
  'saved-cart': /\/saved.?cart/i,
  checkout: /\/checkout/i,
  address: /\/address/i,
  payment: /\/payment/i,
  invoice: /\/invoice/i,
};

/**
 * Detect resource type from request path
 *
 * @param path - Request path
 * @returns Resource type or 'unknown'
 */
function detectResourceType(path: string): string {
  for (const [type, pattern] of Object.entries(RESOURCE_TYPE_PATTERNS)) {
    if (pattern.test(path)) {
      return type;
    }
  }
  return 'unknown';
}

/**
 * Extract resource ID from request path
 *
 * @param path - Request path
 * @returns Resource ID or undefined
 */
function extractResourceId(path: string): string | number | undefined {
  const match = path.match(/\/(\d+)(?:\/|$)/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Deep scan object for customer ID fields
 *
 * @param obj - Object to scan
 * @param fields - Fields to look for
 * @returns Object with customer ID paths and values
 */
function deepScanForCustomerIds(
  obj: unknown,
  fields: string[]
): Array<{ path: string; value: unknown }> {
  const results: Array<{ path: string; value: unknown }> = [];

  function scan(current: unknown, path: string = ''): void {
    if (current === null || current === undefined) {
      return;
    }

    if (typeof current !== 'object') {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        scan(item, `${path}[${index}]`);
      });
      return;
    }

    for (const key of Object.keys(current as Record<string, unknown>)) {
      const value = (current as Record<string, unknown>)[key];
      const fullPath = path ? `${path}.${key}` : key;

      // Check if this key is a customer ID field
      if (fields.includes(key)) {
        results.push({ path: fullPath, value });
      }

      // Recursively scan nested objects
      scan(value, fullPath);
    }
  }

  scan(obj);
  return results;
}

/**
 * Remove customer ID fields from request body
 *
 * @param obj - Object to sanitize
 * @param fields - Fields to remove
 * @returns Sanitized object
 */
function removeCustomerIds(obj: unknown, fields: string[]): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeCustomerIds(item, fields));
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];

    // Skip customer ID fields
    if (fields.includes(key)) {
      continue;
    }

    result[key] = removeCustomerIds(value, fields);
  }

  return result;
}

/**
 * IDOR Prevention Middleware Factory
 *
 * Creates middleware to prevent IDOR attacks by:
 * - Blocking customer_id from request body/params
 * - Validating resource ownership
 * - Detecting suspicious patterns
 * - Logging security incidents
 *
 * @param options - IDOR prevention options
 * @returns Express middleware function
 *
 * @example
 * // Basic IDOR prevention
 * app.use(preventIdor());
 *
 * // Custom configuration
 * app.use('/api/v1', preventIdor({
 *   adminRoles: ['admin'],
 *   logViolations: true,
 * }));
 *
 * // Custom ownership validator
 * app.use('/orders', preventIdor({
 *   customOwnershipValidator: async (type, id, customerId, req) => {
 *     const order = await db.findOrder(id);
 *     return order.customerId === customerId;
 *   },
 * }));
 */
export function preventIdor(options: Partial<IdorPreventionOptions> = {}) {
  const opts: IdorPreventionOptions = { ...DEFAULT_IDOR_OPTIONS, ...options };
  const allBlockedFields = [...opts.customerIdFields!, ...opts.blockedFields!];

  return async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    // Skip if disabled
    if (!opts.enabled) {
      next();
      return;
    }

    const requestId = (req as any).id || 'unknown';
    const securityContext = req.securityContext;

    // Skip if no security context (not authenticated)
    if (!securityContext) {
      next();
      return;
    }

    // Skip for admin roles if configured
    if (opts.adminRoles!.includes(securityContext.role)) {
      next();
      return;
    }

    // Skip paths that match skip patterns
    if (opts.skipPaths!.some(pattern => pattern.test(req.path))) {
      next();
      return;
    }

    // Get authenticated customer ID
    const authenticatedCustomerId = securityContext.realm === 'b2b'
      ? securityContext.b2bCustomerId
      : securityContext.customerId;

    if (!authenticatedCustomerId) {
      next();
      return;
    }

    // Detect resource type from path
    const resourceType = detectResourceType(req.path);
    const resourceId = extractResourceId(req.path);

    // Scan request body for customer ID fields
    let bodyViolations: Array<{ path: string; value: unknown }> = [];

    if (req.body && typeof req.body === 'object') {
      bodyViolations = deepScanForCustomerIds(req.body, opts.customerIdFields!);
    }

    // Check query parameters for customer ID
    const queryViolations: Array<{ path: string; value: unknown }> = [];

    for (const key of Object.keys(req.query)) {
      if (opts.customerIdFields!.includes(key)) {
        queryViolations.push({ path: `query.${key}`, value: req.query[key] });
      }
    }

    // Check path parameters for customer ID
    const paramViolations: Array<{ path: string; value: unknown }> = [];

    for (const key of Object.keys(req.params)) {
      if (opts.customerIdFields!.includes(key)) {
        paramViolations.push({ path: `params.${key}`, value: req.params[key] });
      }
    }

    // Check for IDOR violation: attempting to access/manipulate different customer's resources
    let idorViolation: IdorViolation | null = null;

    // Check body violations
    for (const violation of bodyViolations) {
      if (violation.value && String(violation.value) !== String(authenticatedCustomerId)) {
        idorViolation = createIdorViolation(
          'body_injection',
          authenticatedCustomerId,
          String(violation.value),
          resourceType,
          resourceId,
          req,
          requestId,
          { fieldPath: violation.path }
        );
        break;
      }
    }

    // Check query violations if no body violation found
    if (!idorViolation) {
      for (const violation of queryViolations) {
        if (violation.value && String(violation.value) !== String(authenticatedCustomerId)) {
          idorViolation = createIdorViolation(
            'param_manipulation',
            authenticatedCustomerId,
            String(violation.value),
            resourceType,
            resourceId,
            req,
            requestId,
            { fieldPath: violation.path }
          );
          break;
        }
      }
    }

    // Check path violations if no other violation found
    if (!idorViolation) {
      for (const violation of paramViolations) {
        if (violation.value && String(violation.value) !== String(authenticatedCustomerId)) {
          idorViolation = createIdorViolation(
            'param_manipulation',
            authenticatedCustomerId,
            String(violation.value),
            resourceType,
            resourceId,
            req,
            requestId,
            { fieldPath: violation.path }
          );
          break;
        }
      }
    }

    // Check for direct access pattern (e.g., GET /orders/123 where order 123 belongs to customer 456)
    if (!idorViolation && resourceId && resourceType !== 'unknown') {
      const ownershipResult = await checkResourceOwnership(
        req,
        resourceType,
        resourceId,
        authenticatedCustomerId,
        opts
      );

      if (!ownershipResult.owns) {
        idorViolation = createIdorViolation(
          'direct_access',
          authenticatedCustomerId,
          String(resourceId),
          resourceType,
          resourceId,
          req,
          requestId,
          { ownershipReason: ownershipResult.reason }
        );
      }

      req.ownershipResult = ownershipResult;
    }

    req.idorChecked = true;

    // Handle IDOR violation
    if (idorViolation) {
      logger.error('IDOR violation detected', {
        requestId,
        violation: idorViolation,
      });

      if (opts.logViolations) {
        await logIdorViolation(idorViolation);
      }

      if (opts.onViolation) {
        await opts.onViolation(idorViolation, req);
      }

      if (opts.strictMode) {
        res.status(403).json({
          success: false,
          error: {
            code: 'IDOR_VIOLATION',
            message: 'Access to this resource is not authorized',
            details: {
              resourceType: idorViolation.resourceType,
              resourceId: idorViolation.resourceId,
            },
          },
        });
        return;
      }
    }

    // Sanitize request body - remove customer ID fields
    if (req.body && typeof req.body === 'object') {
      req.body = removeCustomerIds(req.body, allBlockedFields);
    }

    // Sanitize query parameters - remove customer ID fields
    for (const field of opts.customerIdFields!) {
      if (field in req.query) {
        delete req.query[field];
      }
    }

    next();
  };
}

/**
 * Check if user owns the resource
 *
 * @param req - Express request
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @param customerId - Customer ID
 * @param options - IDOR prevention options
 * @returns Ownership check result
 */
async function checkResourceOwnership(
  req: SecurityRequest,
  resourceType: string,
  resourceId: string | number,
  customerId: string | number,
  options: IdorPreventionOptions
): Promise<OwnershipResult> {
  // Use custom validator if provided
  if (options.customOwnershipValidator) {
    try {
      const owns = await options.customOwnershipValidator(
        resourceType,
        resourceId,
        customerId,
        req
      );
      return {
        owns,
        resourceType,
        resourceId,
        reason: owns ? undefined : 'Custom validator returned false',
      };
    } catch (error) {
      logger.error('Error in custom ownership validator', { error, resourceType, resourceId });
      return {
        owns: false,
        resourceType,
        resourceId,
        reason: 'Error validating ownership',
      };
    }
  }

  // Default ownership validation based on resource type
  // In production, this would query the database
  try {
    // Import DataSource dynamically to avoid circular dependencies
    const { default: DataSourceModule } = await import('typeorm');
    const dataSource = (req as any).dataSource;

    if (!dataSource) {
      // No database available - cannot verify ownership
      // Log and allow (or block based on configuration)
      logger.warn('No DataSource available for ownership check', {
        resourceType,
        resourceId,
      });
      return {
        owns: false,
        resourceType,
        resourceId,
        reason: 'Unable to verify ownership',
      };
    }

    // Query based on resource type
    switch (resourceType) {
      case 'cart':
        const cart = await dataSource.query(
          'SELECT customer_id FROM b2b_cart WHERE id = $1',
          [resourceId]
        );
        if (cart.length === 0) {
          return { owns: false, resourceType, resourceId, reason: 'Cart not found' };
        }
        return {
          owns: String(cart[0].customer_id) === String(customerId),
          resourceType,
          resourceId,
        };

      case 'order':
        const order = await dataSource.query(
          'SELECT customer_id FROM b2b_orders WHERE id = $1',
          [resourceId]
        );
        if (order.length === 0) {
          return { owns: false, resourceType, resourceId, reason: 'Order not found' };
        }
        return {
          owns: String(order[0].customer_id) === String(customerId),
          resourceType,
          resourceId,
        };

      case 'credit':
        const credit = await dataSource.query(
          'SELECT id FROM b2b_customers WHERE id = $1',
          [resourceId]
        );
        return {
          owns: credit.length > 0 && String(resourceId) === String(customerId),
          resourceType,
          resourceId,
          reason: credit.length === 0 ? 'Credit account not found' : undefined,
        };

      case 'saved-cart':
        const savedCart = await dataSource.query(
          'SELECT customer_id FROM saved_carts WHERE id = $1',
          [resourceId]
        );
        if (savedCart.length === 0) {
          return { owns: false, resourceType, resourceId, reason: 'Saved cart not found' };
        }
        return {
          owns: String(savedCart[0].customer_id) === String(customerId),
          resourceType,
          resourceId,
        };

      default:
        // Unknown resource type - log and allow
        logger.warn('Unknown resource type for ownership check', { resourceType });
        return { owns: true, resourceType, resourceId };
    }
  } catch (error) {
    logger.error('Error checking resource ownership', {
      error,
      resourceType,
      resourceId,
    });
    return {
      owns: false,
      resourceType,
      resourceId,
      reason: 'Error validating ownership',
    };
  }
}

/**
 * Create IDOR violation object
 *
 * @param type - Violation type
 * @param authenticatedCustomerId - Authenticated customer ID
 * @param targetCustomerId - Target customer ID
 * @param resourceType - Resource type
 * @param resourceId - Resource ID
 * @param req - Express request
 * @param requestId - Request ID
 * @param context - Additional context
 * @returns IDOR violation object
 */
function createIdorViolation(
  type: IdorViolation['type'],
  authenticatedCustomerId: string | number,
  targetCustomerId: string,
  resourceType: string,
  resourceId: string | number | undefined,
  req: SecurityRequest,
  requestId: string,
  context?: Record<string, unknown>
): IdorViolation {
  return {
    type,
    targetCustomerId,
    authenticatedCustomerId,
    resourceType,
    resourceId,
    endpoint: req.path,
    method: req.method,
    ip: getClientIp(req),
    userAgent: req.get('user-agent'),
    timestamp: new Date(),
    requestId,
    context,
  };
}

/**
 * Log IDOR violation to security audit log
 *
 * @param violation - IDOR violation object
 */
async function logIdorViolation(violation: IdorViolation): Promise<void> {
  try {
    logger.error('Security Incident: IDOR Violation', {
      violationType: violation.type,
      authenticatedCustomerId: violation.authenticatedCustomerId,
      targetCustomerId: violation.targetCustomerId,
      resourceType: violation.resourceType,
      resourceId: violation.resourceId,
      endpoint: violation.endpoint,
      method: violation.method,
      ip: violation.ip,
      userAgent: violation.userAgent,
      requestId: violation.requestId,
      context: violation.context,
    });

    // TODO: Send to dedicated security monitoring system
    // Example integration options:
    // - SIEM system (Splunk, ELK)
    // - Security alerting service
    // - Database audit log table

    // Example database logging:
    // await db.query(
    //   'INSERT INTO security_incidents (type, severity, details, created_at) VALUES ($1, $2, $3, NOW())',
    //   ['IDOR_VIOLATION', 'high', JSON.stringify(violation)]
    // );
  } catch (error) {
    logger.error('Failed to log IDOR violation', { error });
  }
}

/**
 * Get client IP address from request
 *
 * @param req - Express request
 * @returns Client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  const realIp = req.headers['x-real-ip'] as string | undefined;
  const socket = req.socket;

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return socket.remoteAddress || 'unknown';
}

/**
 * Verify resource ownership helper
 * Can be used in controllers for additional ownership checks
 *
 * @param req - Express request
 * @param resourceOwnerId - Resource owner ID
 * @returns True if user owns resource or is admin
 */
export function verifyResourceOwnership(
  req: SecurityRequest,
  resourceOwnerId: string | number
): boolean {
  const context = req.securityContext;

  if (!context) {
    return false;
  }

  // Admin bypass
  if (context.isAdmin) {
    return true;
  }

  const customerId = context.realm === 'b2b' ? context.b2bCustomerId : context.customerId;

  if (!customerId) {
    return false;
  }

  return String(customerId) === String(resourceOwnerId);
}

/**
 * Get customer ID from security context
 *
 * @param req - Express request
 * @returns Customer ID or undefined
 */
export function getAuthenticatedCustomerId(req: SecurityRequest): string | number | undefined {
  const context = req.securityContext;

  if (!context) {
    return undefined;
  }

  return context.realm === 'b2b' ? context.b2bCustomerId : context.customerId;
}
