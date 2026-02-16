/**
 * Audit Trail Middleware
 *
 * Enhanced audit middleware that:
 * - Auto-logs POST/PUT/PATCH/DELETE operations to the database via AuditLogService
 * - Captures request body for write operations (before/after for updates)
 * - Skips health check, metrics, and static asset endpoints
 * - Extracts user info from JWT token on the request
 * - Falls back to Winston file-based audit logging when no DB service is configured
 */

import { Request, Response, NextFunction } from 'express';
import { IAuditLogger, AuditEvent } from '../interfaces/audit-logger.interface';
import { AuditLogService, AuditLogEntry } from '../services/AuditLogService';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Paths that should be excluded from audit logging
 */
const SKIP_PATHS = [
  '/health',
  '/metrics',
  '/favicon.ico',
  '/api/v1/health',
  '/api/v1/system/metrics',
  '/api/v1/system/metrics/detailed',
];

/**
 * Path prefixes that should be excluded from audit logging
 */
const SKIP_PREFIXES = ['/static/', '/assets/', '/_next/'];

/**
 * HTTP methods that trigger database audit log entries (write operations)
 */
const AUDITABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Request tracking metadata
 * Captured at middleware entry point
 */
interface RequestMetadata {
  startTime: number;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  userId?: string;
  userEmail?: string;
  requestBody?: Record<string, unknown>;
}

/**
 * Create audit trail middleware factory
 *
 * @param auditLogger - IAuditLogger implementation for file-based audit events
 * @param auditLogService - Optional AuditLogService for database persistence
 * @returns Express middleware function
 */
export function createAuditMiddleware(
  auditLogger: IAuditLogger,
  auditLogService?: AuditLogService,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip excluded paths
    if (shouldSkip(req.path)) {
      next();
      return;
    }

    // Extract user info from JWT (set by auth middleware)
    const user = (req as any).user;

    // Capture request metadata at entry point
    const metadata: RequestMetadata = {
      startTime: Date.now(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      userId: user?.id ? String(user.id) : undefined,
      userEmail: user?.email,
    };

    // Capture request body for write operations
    if (AUDITABLE_METHODS.has(req.method) && req.body) {
      metadata.requestBody = sanitizeBody(req.body);
    }

    // Store metadata on request for downstream use
    (req as any)._auditMetadata = metadata;

    // Wrap response.end to capture final status and log
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - metadata.startTime;

      // Re-read user from request in case auth middleware ran after audit middleware
      const currentUser = (req as any).user;
      if (currentUser?.id && !metadata.userId) {
        metadata.userId = String(currentUser.id);
        metadata.userEmail = currentUser.email;
      }

      // Determine log level based on HTTP method
      const logLevel = AUDITABLE_METHODS.has(metadata.method) ? 'WARN' : 'INFO';

      // Log to standard logger
      const auditLog = logger.child({ requestId: (req as any).id });
      const logMessage =
        logLevel === 'WARN' ? auditLog.warn.bind(auditLog) : auditLog.info.bind(auditLog);

      logMessage('API Request', {
        requestId: (req as any).id,
        userId: metadata.userId,
        method: metadata.method,
        path: metadata.path,
        statusCode: res.statusCode,
        duration,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

      // Create audit event for file-based logger
      const auditEvent: AuditEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        requestId: (req as any).id,
        userId: metadata.userId ? Number(metadata.userId) : undefined,
        action: mapHttpMethodToAction(metadata.method),
        resource: extractResourceFromPath(metadata.path),
        resourceId: extractResourceIdFromPath(metadata.path),
        changes: {
          before: undefined,
          after: metadata.requestBody,
        },
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      };

      // Log audit event to file asynchronously
      auditLogger.logEvent(auditEvent).catch((error) => {
        auditLog.error('Failed to log audit event to file', { error });
      });

      // For write operations, also persist to database via AuditLogService
      if (auditLogService && AUDITABLE_METHODS.has(metadata.method)) {
        const dbEntry: AuditLogEntry = {
          userId: metadata.userId,
          userEmail: metadata.userEmail,
          action: mapHttpMethodToAction(metadata.method),
          resourceType: extractResourceFromPath(metadata.path),
          resourceId: String(extractResourceIdFromPath(metadata.path)),
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          changes: metadata.requestBody ? { after: metadata.requestBody } : undefined,
          metadata: {
            requestId: (req as any).id,
            statusCode: res.statusCode,
            duration,
            path: metadata.path,
          },
        };

        auditLogService.log(dbEntry).catch((error) => {
          auditLog.error('Failed to persist audit log to database', { error });
        });
      }

      return originalEnd.apply(res, args as any);
    };

    next();
  };
}

/**
 * Determine if a path should be skipped from audit logging
 */
function shouldSkip(path: string): boolean {
  if (SKIP_PATHS.includes(path)) {
    return true;
  }
  return SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Sanitize request body by removing sensitive fields
 */
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = new Set([
    'password',
    'token',
    'secret',
    'authorization',
    'credit_card',
    'creditCard',
    'cvv',
    'ssn',
    'twofa_secret',
    'twofaSecret',
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Map HTTP method to audit action type
 */
function mapHttpMethodToAction(method: string): 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
    default:
      return 'READ';
  }
}

/**
 * Extract resource type from request path
 * Parses the path to identify the primary resource being accessed
 */
function extractResourceFromPath(path: string): string {
  // Remove leading /api/v1 or similar prefixes
  const normalizedPath = path.replace(/^\/api\/v\d+/, '');

  // Extract first path segment after leading slash
  const segments = normalizedPath.split('/').filter((s) => s);
  if (segments.length === 0) {
    return 'Unknown';
  }

  // Capitalize first segment and singularize
  const resource = segments[0];
  return singularize(capitalize(resource));
}

/**
 * Extract resource ID from request path
 * Attempts to find numeric or UUID resource identifier in path
 */
function extractResourceIdFromPath(path: string): string | number {
  // Remove leading /api/v1 or similar prefixes
  const normalizedPath = path.replace(/^\/api\/v\d+/, '');

  // Try to extract numeric ID from path
  const segments = normalizedPath.split('/').filter((s) => s);
  if (segments.length >= 2) {
    const possibleId = segments[1];
    // Check if it's a numeric ID
    const numericId = parseInt(possibleId, 10);
    if (!isNaN(numericId)) {
      return numericId;
    }
    // Return as string if not numeric (could be UUID)
    return possibleId;
  }

  return path;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Singularize plural resource name
 * Simple heuristic for common English pluralization
 */
function singularize(word: string): string {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('es')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

export default createAuditMiddleware;
