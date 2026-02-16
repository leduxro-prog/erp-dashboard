/**
 * Base Error Class
 * Foundation for all application-specific errors with consistent structure.
 * Provides standardized error handling with HTTP status codes and error codes.
 *
 * All application errors should extend this class to maintain consistency
 * in error handling, logging, and HTTP response generation.
 *
 * @abstract
 * @extends Error
 *
 * @example
 * class CustomError extends BaseError {
 *   constructor(message: string) {
 *     super(message, 'CUSTOM_ERROR', 400);
 *   }
 * }
 */
export abstract class BaseError extends Error {
  /** Machine-readable error code for programmatic handling */
  public readonly code: string;

  /** HTTP status code to return in response */
  public readonly statusCode: number;

  /** Flag indicating if error is expected (operational) vs programming error */
  public readonly isOperational: boolean;

  /**
   * Create a new BaseError instance.
   *
   * @param message - Human-readable error message
   * @param code - Machine-readable error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
   * @param statusCode - HTTP status code (default: 500)
   * @param isOperational - Whether this is an expected/operational error (default: true)
   */
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * NotFoundError - HTTP 404
 * Thrown when a requested resource does not exist.
 * Suitable for GET requests on non-existent resources.
 *
 * @description Indicates a resource was not found in the database
 *
 * @example
 * if (!product) {
 *   throw new NotFoundError('Product', '123');
 *   // Error message: "Product with id 123 not found"
 * }
 */
export class NotFoundError extends BaseError {
  /**
   * Create a NotFoundError.
   *
   * @param entity - Name of the entity that was not found (e.g., 'Product', 'Order')
   * @param id - The ID that was searched for
   */
  constructor(entity: string, id: string | number) {
    super(
      `${entity} with id ${id} not found`,
      'NOT_FOUND',
      404
    );
  }
}

/**
 * ValidationError - HTTP 400
 * Thrown when input validation fails.
 * Used for invalid request body, query parameters, or path parameters.
 *
 * @description Indicates client sent invalid or malformed request data
 *
 * @example
 * if (order.quantity < 1) {
 *   throw new ValidationError('Invalid quantity', 'Quantity must be positive');
 *   // Error message: "Invalid quantity: Quantity must be positive"
 * }
 */
export class ValidationError extends BaseError {
  /**
   * Create a ValidationError.
   *
   * @param message - Primary validation message
   * @param details - Optional detailed explanation of what went wrong
   */
  constructor(message: string, details?: string) {
    super(
      details ? `${message}: ${details}` : message,
      'VALIDATION_ERROR',
      400
    );
  }
}

/**
 * UnauthorizedError - HTTP 401
 * Thrown when authentication is required but not provided or invalid.
 * Triggers client to present login challenge.
 *
 * @description Indicates user must authenticate to access the resource
 *
 * @example
 * if (!req.user) {
 *   throw new UnauthorizedError('Valid authentication token required');
 * }
 */
export class UnauthorizedError extends BaseError {
  /**
   * Create an UnauthorizedError.
   *
   * @param message - Explanation of what authentication is needed (default: 'Unauthorized')
   */
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * ForbiddenError - HTTP 403
 * Thrown when user lacks permission to access a resource.
 * Different from 401 - user IS authenticated but lacks authorization.
 *
 * @description Indicates user does not have permission for this action
 *
 * @example
 * if (user.role !== 'admin') {
 *   throw new ForbiddenError('Only administrators can delete products');
 * }
 */
export class ForbiddenError extends BaseError {
  /**
   * Create a ForbiddenError.
   *
   * @param message - Explanation of why access is forbidden (default: 'Forbidden')
   */
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * ConflictError - HTTP 409
 * Thrown when there is a conflict with existing data.
 * Commonly used for duplicate resource creation or state conflicts.
 *
 * @description Indicates request conflicts with existing resource state
 *
 * @example
 * if (existingCustomer) {
 *   throw new ConflictError('Customer with email already exists');
 * }
 */
export class ConflictError extends BaseError {
  /**
   * Create a ConflictError.
   *
   * @param message - Description of the conflicting condition
   */
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * BusinessRuleError - HTTP 422 (Unprocessable Entity)
 * Thrown when business rule validation fails.
 * Distinct from ValidationError - data is syntactically valid but violates business logic.
 *
 * @description Indicates request violates business rules or constraints
 *
 * @example
 * if (order.total < 100 && order.region === 'RURAL') {
 *   throw new BusinessRuleError(
 *     'Minimum order total for rural regions is 100',
 *     'MIN_ORDER_RURAL'
 *   );
 * }
 */
export class BusinessRuleError extends BaseError {
  /**
   * Create a BusinessRuleError.
   *
   * @param message - Human-readable description of the business rule violation
   * @param code - Machine-readable error code for the specific rule
   */
  constructor(message: string, code: string) {
    super(message, code, 422);
  }
}

/**
 * InternalServerError - HTTP 500
 * Thrown for unexpected internal errors.
 * Should only be used for true programming errors or unhandled exceptions.
 *
 * @description Indicates an unexpected server-side error occurred
 *
 * @example
 * try {
 *   // database operation
 * } catch (error) {
 *   logger.error('Database error', error);
 *   throw new InternalServerError('Failed to process request');
 * }
 */
export class InternalServerError extends BaseError {
  /**
   * Create an InternalServerError.
   *
   * @param message - Description of the internal error (default: 'Internal Server Error')
   */
  constructor(message: string = 'Internal Server Error') {
    super(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}

/**
 * ServiceUnavailableError - HTTP 503
 * Thrown when a required external service is temporarily unavailable.
 * Indicates a transient error that may succeed if retried.
 *
 * @description Indicates external service is down or unreachable
 *
 * @example
 * if (!smartbill.isAvailable()) {
 *   throw new ServiceUnavailableError('SmartBill');
 *   // Error message: "SmartBill service is currently unavailable"
 * }
 */
export class ServiceUnavailableError extends BaseError {
  /**
   * Create a ServiceUnavailableError.
   *
   * @param serviceName - Name of the unavailable service (e.g., 'SmartBill', 'WooCommerce')
   */
  constructor(serviceName: string) {
    super(`${serviceName} service is currently unavailable`, 'SERVICE_UNAVAILABLE', 503);
  }
}

/**
 * NotImplementedError - 501
 * Thrown when a feature or use-case is not yet implemented
 */
export class NotImplementedError extends BaseError {
  constructor(message: string = 'This feature is not yet implemented') {
    super(message, 'NOT_IMPLEMENTED', 501);
  }
}
