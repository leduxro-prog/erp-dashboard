/**
 * JwtAuth Middleware
 * Enterprise-level JWT authentication with session validation, token revocation,
 * role-based access control, and audit logging.
 */

import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '@shared/utils/logger';
import { UnauthorizedError, ForbiddenError } from '@shared/errors/BaseError';
import { JwtParser, getJwtParser, UnauthorizedError as JwtUnauthorizedError } from '../utils/JwtParser';
import {
  JwtPayload,
  SecurityContext,
  SecurityRequest,
  SecurityAuditLog,
  TokenRevocationCheck,
  SessionValidationResult,
} from '../types/AuthContext';

const logger = createModuleLogger('jwt-auth-middleware');

/**
 * Extended request type with security context
 */
export interface AuthenticatedRequest extends Request {
  securityContext?: SecurityContext;
  token?: string;
  user?: {
    id: string | number;
    email: string;
    role: string;
  };
}

/**
 * Authentication configuration options
 */
export interface JwtAuthOptions {
  /** Optional custom JWT secret */
  jwtSecret?: string;

  /** Optional custom B2B JWT secret */
  jwtSecretB2B?: string;

  /** Whether to check token revocation */
  checkRevocation?: boolean;

  /** Whether to validate session */
  validateSession?: boolean;

  /** Whether to enable audit logging */
  enableAuditLogging?: boolean;

  /** Required token realm (for multi-tenant) */
  requiredRealm?: 'erp' | 'b2b' | 'all';

  /** Whether token is required (if false, continues without auth) */
  optional?: boolean;
}

/**
 * Default authentication options
 */
const DEFAULT_AUTH_OPTIONS: JwtAuthOptions = {
  checkRevocation: true,
  validateSession: true,
  enableAuditLogging: true,
  requiredRealm: 'all',
  optional: false,
};

/**
 * JWT Authentication Middleware Factory
 *
 * Creates middleware for JWT authentication with enterprise-level features.
 *
 * @param options - Authentication options
 * @returns Express middleware function
 *
 * @example
 * // Basic authentication
 * app.use(jwtAuth());
 *
 * // B2B-specific authentication
 * app.use('/b2b', jwtAuth({ requiredRealm: 'b2b' }));
 *
 * // Optional authentication (allows anonymous access)
 * app.get('/public', jwtAuth({ optional: true }), handler);
 */
export function jwtAuth(options: Partial<JwtAuthOptions> = {}) {
  const opts: JwtAuthOptions = { ...DEFAULT_AUTH_OPTIONS, ...options };

  return async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const requestId = (req as any).id || 'unknown';

    // Handle optional auth
    if (opts.optional && (!authHeader || !authHeader.startsWith('Bearer '))) {
      next();
      return;
    }

    try {
      // Get or create JwtParser instance
      const jwtParser = getJwtParser({
        jwtSecret: opts.jwtSecret || process.env.JWT_SECRET || '',
        jwtSecretB2B: opts.jwtSecretB2B || process.env.JWT_SECRET_B2B,
      });

      if (!authHeader) {
        throw new JwtUnauthorizedError('Missing authorization header');
      }

      // Parse token
      let payload: JwtPayload;

      if (opts.requiredRealm === 'b2b') {
        payload = jwtParser.parseB2BToken(authHeader);
      } else {
        payload = jwtParser.parseFromAuthHeader(authHeader);
      }

      // Check realm if specified
      if (opts.requiredRealm !== 'all' && payload.realm !== opts.requiredRealm) {
        logger.warn('Invalid token realm', {
          requestId,
          requiredRealm: opts.requiredRealm,
          actualRealm: payload.realm,
          userId: payload.sub,
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_REALM',
            message: `Token realm must be '${opts.requiredRealm}'`,
          },
        });
        return;
      }

      // Build security context
      const securityContext: SecurityContext = jwtParser.buildSecurityContext(payload);

      // Check token revocation
      if (opts.checkRevocation) {
        const revocationCheck: TokenRevocationCheck = await jwtParser.checkTokenRevocation(payload);

        if (!revocationCheck.isValid) {
          logger.warn('Token revoked', {
            requestId,
            userId: payload.sub,
            reason: revocationCheck.revocationReason,
            revokedAt: revocationCheck.revokedAt,
          });

          if (opts.enableAuditLogging) {
            await logSecurityEvent({
              eventType: 'token_revoked',
              severity: 'warning',
              userId: payload.sub,
              customerId: payload.customer_id || payload.b2b_customer_id,
              description: 'Attempt to use revoked token',
              details: {
                reason: revocationCheck.revocationReason,
                revokedAt: revocationCheck.revokedAt,
                versionMismatch: revocationCheck.versionMismatch,
              },
              ip: getClientIp(req),
              userAgent: req.get('user-agent'),
              requestId,
              timestamp: new Date(),
              success: false,
            });
          }

          res.status(401).json({
            success: false,
            error: {
              code: 'TOKEN_REVOKED',
              message: 'Token has been revoked',
            },
          });
          return;
        }
      }

      // Validate session
      if (opts.validateSession) {
        const sessionValidation: SessionValidationResult = await jwtParser.validateSession(payload);

        if (!sessionValidation.isValid) {
          logger.warn('Session invalid', {
            requestId,
            userId: payload.sub,
            reason: sessionValidation.invalidReason,
          });

          if (opts.enableAuditLogging) {
            await logSecurityEvent({
              eventType: 'session_invalid',
              severity: 'warning',
              userId: payload.sub,
              customerId: payload.customer_id || payload.b2b_customer_id,
              description: 'Session validation failed',
              details: {
                reason: sessionValidation.invalidReason,
              },
              ip: getClientIp(req),
              userAgent: req.get('user-agent'),
              requestId,
              timestamp: new Date(),
              success: false,
            });
          }

          res.status(401).json({
            success: false,
            error: {
              code: 'SESSION_INVALID',
              message: sessionValidation.invalidReason || 'Session is invalid',
            },
          });
          return;
        }
      }

      // Attach security context to request
      req.securityContext = securityContext;
      req.token = authHeader.substring(7); // Store token without 'Bearer ' prefix

      // Maintain backward compatibility with existing user property
      (req as AuthenticatedRequest).user = {
        id: securityContext.userId,
        email: securityContext.email,
        role: securityContext.role,
      };

      // Log successful auth
      if (opts.enableAuditLogging) {
        await logSecurityEvent({
          eventType: 'auth',
          severity: 'info',
          userId: payload.sub,
          customerId: payload.customer_id || payload.b2b_customer_id,
          description: 'Successfully authenticated',
          details: {
            realm: payload.realm,
            role: payload.role,
            tokenVersion: payload.version,
          },
          ip: getClientIp(req),
          userAgent: req.get('user-agent'),
          requestId,
          timestamp: new Date(),
          success: true,
        });
      }

      logger.debug('Authentication successful', {
        requestId,
        userId: securityContext.userId,
        role: securityContext.role,
        realm: securityContext.realm,
      });

      next();
    } catch (error) {
      if (error instanceof JwtUnauthorizedError) {
        logger.warn('Authentication failed', {
          requestId,
          message: error.message,
          expiredAt: error.expiredAt,
        });

        res.status(401).json({
          success: false,
          error: {
            code: error.expiredAt ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
            message: error.expiredAt ? 'Token has expired' : error.message,
            expiredAt: error.expiredAt?.toISOString(),
          },
        });
        return;
      }

      logger.error('Authentication error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Authentication failed',
        },
      });
    }
  };
}

/**
 * Role-based Access Control Middleware Factory
 * Checks if authenticated user has one of the required roles.
 *
 * @param allowedRoles - Array of allowed roles
 * @param options - Additional options
 * @returns Express middleware function
 *
 * @example
 * // Only admin access
 * app.delete('/users', requireRole(['admin']), deleteUserHandler);
 *
 * // Admin or manager access
 * app.post('/orders', requireRole(['admin', 'manager']), createOrderHandler);
 *
 * // Allow any authenticated user
 * app.get('/profile', requireRole([]), profileHandler);
 */
export function requireRole(
  allowedRoles: string[],
  options: {
    /** Whether to allow superadmin regardless of roles list */
    allowSuperadmin?: boolean;
    /** Custom error message */
    errorMessage?: string;
  } = {}
) {
  return (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const { allowSuperadmin = true, errorMessage } = options;
    const securityContext = req.securityContext;

    if (!securityContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Allow superadmin regardless of roles
    if (allowSuperadmin && securityContext.role === 'superadmin') {
      next();
      return;
    }

    // If no roles specified, allow any authenticated user
    if (allowedRoles.length === 0) {
      next();
      return;
    }

    // Check if user has required role
    if (!allowedRoles.includes(securityContext.role)) {
      logger.warn('Authorization failed - insufficient permissions', {
        requestId: (req as any).id,
        userId: securityContext.userId,
        role: securityContext.role,
        requiredRoles: allowedRoles,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: errorMessage || 'You do not have permission to perform this action',
          requiredRoles: allowedRoles,
          userRole: securityContext.role,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Permission-based Access Control Middleware Factory
 * Checks if authenticated user has all of the required permissions.
 *
 * @param requiredPermissions - Array of required permissions
 * @param options - Additional options
 * @returns Express middleware function
 *
 * @example
 * // Require specific permissions
 * app.post('/orders', requirePermissions(['orders.create']), createOrderHandler);
 *
 * // Require multiple permissions
 * app.post('/payments', requirePermissions(['orders.pay', 'payments.create']), createPaymentHandler);
 */
export function requirePermissions(
  requiredPermissions: string[],
  options: {
    /** Require all permissions (true) or any permission (false) */
    requireAll?: boolean;
    /** Custom error message */
    errorMessage?: string;
  } = {}
) {
  const { requireAll = true, errorMessage } = options;

  return (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const securityContext = req.securityContext;

    if (!securityContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Admin bypass
    if (securityContext.isAdmin) {
      next();
      return;
    }

    const userPermissions = securityContext.permissions || [];

    // Check permissions
    const hasPermission = requireAll
      ? requiredPermissions.every(p => userPermissions.includes(p))
      : requiredPermissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      logger.warn('Authorization failed - insufficient permissions', {
        requestId: (req as any).id,
        userId: securityContext.userId,
        role: securityContext.role,
        requiredPermissions,
        userPermissions,
        requireAll,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: errorMessage || 'You do not have permission to perform this action',
          requiredPermissions,
          requireAll,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Get customer ID from security context
 * Returns either customerId or b2bCustomerId depending on realm
 *
 * @param req - Express request
 * @returns Customer ID or undefined
 */
export function getCustomerIdFromContext(req: SecurityRequest): string | number | undefined {
  const context = req.securityContext;

  if (!context) {
    return undefined;
  }

  // For B2B realm, use b2bCustomerId
  if (context.realm === 'b2b') {
    return context.b2bCustomerId;
  }

  // For ERP realm, use customerId
  return context.customerId;
}

/**
 * Verify user owns resource
 *
 * @param req - Express request
 * @param resourceOwnerId - Resource owner ID
 * @returns True if user owns resource or is admin
 */
export function verifyOwnership(req: SecurityRequest, resourceOwnerId: string | number): boolean {
  const context = req.securityContext;

  if (!context) {
    return false;
  }

  // Admins can access any resource
  if (context.isAdmin) {
    return true;
  }

  const customerId = getCustomerIdFromContext(req);

  if (!customerId) {
    return false;
  }

  // Convert to strings for comparison
  return String(customerId) === String(resourceOwnerId);
}

/**
 * Get client IP address from request
 * Handles proxy headers (X-Forwarded-For, X-Real-IP)
 *
 * @param req - Express request
 * @returns Client IP address
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  const realIp = req.headers['x-real-ip'] as string | undefined;
  const socket = req.socket;

  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return socket.remoteAddress || 'unknown';
}

/**
 * Log security event
 * In production, this would send to a dedicated security logging system
 *
 * @param logEntry - Security audit log entry
 */
async function logSecurityEvent(logEntry: SecurityAuditLog): Promise<void> {
  try {
    // TODO: Implement actual security logging to database/external service
    // For now, log to Winston
    logger.log(logEntry.severity, logEntry.description, {
      eventType: logEntry.eventType,
      userId: logEntry.userId,
      customerId: logEntry.customerId,
      ip: logEntry.ip,
      requestId: logEntry.requestId,
      details: logEntry.details,
      success: logEntry.success,
    });

    // Example database logging:
    // await db.query(
    //   'INSERT INTO security_audit_logs (id, event_type, severity, user_id, customer_id, description, details, ip, user_agent, request_id, timestamp, success) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    //   [
    //     logEntry.id,
    //     logEntry.eventType,
    //     logEntry.severity,
    //     logEntry.userId,
    //     logEntry.customerId,
    //     logEntry.description,
    //     JSON.stringify(logEntry.details),
    //     logEntry.ip,
    //     logEntry.userAgent,
    //     logEntry.requestId,
    //     logEntry.timestamp,
    //     logEntry.success,
    //   ]
    // );
  } catch (error) {
    // Don't throw errors from security logging to avoid breaking the main flow
    logger.error('Failed to log security event', { error });
  }
}
