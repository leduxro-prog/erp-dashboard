import { BaseError } from '@shared/errors/BaseError';

/**
 * B2B Portal Domain Errors
 * Custom error types for B2B registration, customer, and credit operations.
 *
 * @module B2B Portal - Error Domain
 */

/**
 * Thrown when attempting to register a company with CUI that already exists.
 * Status: 409 Conflict
 */
export class RegistrationExistsError extends BaseError {
  /**
   * Create a RegistrationExistsError.
   * @param cui - The CUI (tax identification number) that already exists
   */
  constructor(cui: string) {
    super(
      `B2B registration with CUI ${cui} already exists`,
      'B2B_REGISTRATION_EXISTS',
      409
    );
  }
}

/**
 * Thrown when CUI (Romanian fiscal code) format is invalid.
 * Romanian CUI must be 2-10 digits with a valid check digit.
 * Status: 400 Bad Request
 */
export class InvalidCuiError extends BaseError {
  constructor(cui: string, message?: string) {
    super(
      message || `CUI ${cui} is invalid. Must be 2-10 digits with valid check digit.`,
      'INVALID_CUI',
      400
    );
  }
}

export class AnafValidationError extends BaseError {
  constructor(cui: string, reason: string) {
    super(
      `ANAF validation failed for CUI ${cui}: ${reason}`,
      'ANAF_VALIDATION_ERROR',
      503
    );
  }
}

/**
 * Thrown when IBAN format is invalid.
 * Status: 400 Bad Request
 */
export class InvalidIbanError extends BaseError {
  /**
   * Create an InvalidIbanError.
   * @param iban - The IBAN that failed validation
   */
  constructor(iban: string) {
    super(
      `IBAN ${iban} is invalid. Must be valid ISO 13616 format.`,
      'INVALID_IBAN',
      400
    );
  }
}

/**
 * Thrown when a customer attempts to place an order exceeding available credit.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class InsufficientCreditError extends BaseError {
  /**
   * Create an InsufficientCreditError.
   * @param available - Available credit amount
   * @param requested - Requested order amount
   */
  constructor(available: number, requested: number) {
    super(
      `Insufficient credit. Available: ${available}, Requested: ${requested}`,
      'INSUFFICIENT_CREDIT',
      422
    );
  }
}

/**
 * Thrown when attempting to use a saved cart that doesn't exist or is inaccessible.
 * Status: 404 Not Found
 */
export class CartNotFoundError extends BaseError {
  /**
   * Create a CartNotFoundError.
   * @param cartId - The cart ID that was not found
   */
  constructor(cartId: string | number) {
    super(
      `Saved cart ${cartId} not found`,
      'CART_NOT_FOUND',
      404
    );
  }
}

/**
 * Thrown when bulk order validation fails.
 * Contains detailed validation error information.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class BulkValidationError extends BaseError {
  /**
   * Detailed validation errors
   */
  readonly details: Array<{
    rowIndex?: number;
    sku?: string;
    message: string;
    code: string;
  }>;

  /**
   * Create a BulkValidationError.
   * @param message - Summary message
   * @param details - Detailed validation errors
   */
  constructor(
    message: string,
    details: Array<{
      rowIndex?: number;
      sku?: string;
      message: string;
      code: string;
    }>
  ) {
    super(message, 'BULK_VALIDATION_ERROR', 422);
    this.details = details;
  }
}

/**
 * Thrown when attempting to perform operations on a suspended customer.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class CustomerSuspendedError extends BaseError {
  /**
   * Create a CustomerSuspendedError.
   * @param customerId - The suspended customer ID
   * @param reason - Reason for suspension
   */
  constructor(customerId: string | number, reason?: string) {
    super(
      `Customer ${customerId} is suspended. ${reason || 'Contact support for details.'}`,
      'CUSTOMER_SUSPENDED',
      422
    );
  }
}

/**
 * Thrown when credit limit adjustment would exceed maximum allowed.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class CreditLimitExceededError extends BaseError {
  /**
   * Create a CreditLimitExceededError.
   * @param requested - Requested credit limit
   * @param maximum - Maximum allowed credit limit
   */
  constructor(requested: number, maximum: number) {
    super(
      `Credit limit ${requested} exceeds maximum allowed ${maximum}`,
      'CREDIT_LIMIT_EXCEEDED',
      422
    );
  }
}

/**
 * Thrown when registration is in invalid state for the requested operation.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class InvalidRegistrationStateError extends BaseError {
  /**
   * Create an InvalidRegistrationStateError.
   * @param currentStatus - Current registration status
   * @param attemptedAction - What was attempted
   */
  constructor(currentStatus: string, attemptedAction: string) {
    super(
      `Cannot ${attemptedAction} registration with status ${currentStatus}`,
      'INVALID_REGISTRATION_STATE',
      422
    );
  }
}

/**
 * Thrown when attempting to convert an empty cart to an order.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class EmptyCartError extends BaseError {
  /**
   * Create an EmptyCartError.
   * @param cartId - The empty cart ID
   */
  constructor(cartId: string | number) {
    super(
      `Cannot convert empty cart ${cartId} to order`,
      'EMPTY_CART',
      422
    );
  }
}

/**
 * Thrown when SKU is not found in inventory during bulk order processing.
 * Status: 400 Bad Request
 */
export class ProductNotFoundError extends BaseError {
  /**
   * Create a ProductNotFoundError.
   * @param sku - The SKU that was not found
   */
  constructor(sku: string) {
    super(
      `Product with SKU ${sku} not found`,
      'PRODUCT_NOT_FOUND',
      400
    );
  }
}

/**
 * Thrown when insufficient stock for requested quantity.
 * Status: 422 Unprocessable Entity (business rule)
 */
export class InsufficientStockError extends BaseError {
  /**
   * Create an InsufficientStockError.
   * @param sku - Product SKU
   * @param requested - Requested quantity
   * @param available - Available quantity
   */
  constructor(sku: string, requested: number, available: number) {
    super(
      `Insufficient stock for SKU ${sku}. Requested: ${requested}, Available: ${available}`,
      'INSUFFICIENT_STOCK',
      422
    );
  }
}
