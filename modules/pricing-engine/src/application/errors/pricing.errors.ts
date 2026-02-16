/**
 * Custom Error Classes for Pricing Module
 */

/**
 * Base error class for pricing errors
 */
export class PricingError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'PRICING_ERROR',
    statusCode: number = 400,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, PricingError.prototype);
  }
}

/**
 * Error thrown when a product is not found
 */
export class ProductNotFoundError extends PricingError {
  constructor(productId: number, details?: Record<string, any>) {
    super(
      `Product with ID ${productId} not found`,
      'PRODUCT_NOT_FOUND',
      404,
      { productId, ...details }
    );
    this.name = 'ProductNotFoundError';
    Object.setPrototypeOf(this, ProductNotFoundError.prototype);
  }
}

/**
 * Error thrown when promotion data is invalid
 */
export class InvalidPromotionError extends PricingError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      'INVALID_PROMOTION',
      400,
      details
    );
    this.name = 'InvalidPromotionError';
    Object.setPrototypeOf(this, InvalidPromotionError.prototype);
  }
}

/**
 * Error thrown when margin falls below minimum acceptable level
 */
export class MarginBelowMinimumError extends PricingError {
  constructor(
    productId: number,
    currentMargin: number,
    minimumMargin: number,
    details?: Record<string, any>
  ) {
    super(
      `Margin for product ${productId} (${(currentMargin * 100).toFixed(2)}%) ` +
      `falls below minimum (${(minimumMargin * 100).toFixed(2)}%)`,
      'MARGIN_BELOW_MINIMUM',
      400,
      { productId, currentMargin, minimumMargin, ...details }
    );
    this.name = 'MarginBelowMinimumError';
    Object.setPrototypeOf(this, MarginBelowMinimumError.prototype);
  }
}

/**
 * Error thrown when customer tier is not found
 */
export class CustomerTierNotFoundError extends PricingError {
  constructor(customerId: number, details?: Record<string, any>) {
    super(
      `Tier for customer ${customerId} not found`,
      'CUSTOMER_TIER_NOT_FOUND',
      404,
      { customerId, ...details }
    );
    this.name = 'CustomerTierNotFoundError';
    Object.setPrototypeOf(this, CustomerTierNotFoundError.prototype);
  }
}

/**
 * Error thrown when promotion dates are invalid or overlap
 */
export class PromotionDateError extends PricingError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      'PROMOTION_DATE_ERROR',
      400,
      details
    );
    this.name = 'PromotionDateError';
    Object.setPrototypeOf(this, PromotionDateError.prototype);
  }
}
