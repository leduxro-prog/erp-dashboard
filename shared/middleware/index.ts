/**
 * Shared Middleware Exports
 * All middleware for the CYPHER ERP application
 */

// Authentication middleware
export { authenticate, requireRole, AuthenticatedRequest } from './auth.middleware';

// Request ID correlation middleware
export { createRequestIdMiddleware, getRequestId } from './request-id.middleware';

// Audit trail middleware
export { createAuditMiddleware } from './audit-trail.middleware';

// CSRF protection middleware
export { createCSRFMiddleware } from './csrf.middleware';

// Distributed tracing middleware
export { tracingMiddleware, RequestWithTracer } from './tracing.middleware';

// Input sanitization middleware
export { sanitizeMiddleware } from './sanitize.middleware';

// Rate limiting middleware
export {
  globalApiLimiter,
  loginLimiter,
  authLimiter,
  writeOperationLimiter,
} from './rate-limit.middleware';

// Input validation middleware
export {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  CommonSchemas,
  type ValidationErrorResponse,
  type ValidationOptions,
} from './validation.middleware';
