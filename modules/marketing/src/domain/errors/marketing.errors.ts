/**
 * Marketing Module Errors
 * Custom error types for marketing domain operations
 *
 * @module Domain/Errors
 */

import {
  BaseError,
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessRuleError,
} from '@shared/errors/BaseError';

// Re-export shared errors for easier imports
export { ValidationError };

/**
 * Thrown when a campaign is not found
 */
export class CampaignNotFoundError extends NotFoundError {
  /**
   * @param campaignId - Campaign ID that was not found
   */
  constructor(campaignId: string) {
    super('Campaign', campaignId);
  }
}

/**
 * Thrown when a discount code is not found
 */
export class DiscountCodeNotFoundError extends NotFoundError {
  /**
   * @param codeId - Discount code ID that was not found
   */
  constructor(codeId: string) {
    super('Discount code', codeId);
  }
}

/**
 * Thrown when an email sequence is not found
 */
export class SequenceNotFoundError extends NotFoundError {
  /**
   * @param sequenceId - Sequence ID that was not found
   */
  constructor(sequenceId: string) {
    super('Email sequence', sequenceId);
  }
}

/**
 * Thrown when a discount code is invalid
 */
export class InvalidDiscountCodeError extends ValidationError {
  /**
   * @param code - The invalid discount code
   * @param reason - Reason why code is invalid
   */
  constructor(code: string, reason: string) {
    super(`Invalid discount code '${code}'`, reason);
  }
}

/**
 * Thrown when a discount code has expired
 */
export class DiscountCodeExpiredError extends BusinessRuleError {
  /**
   * @param code - The expired discount code
   */
  constructor(code: string) {
    super(`Discount code '${code}' has expired`, 'DISCOUNT_CODE_EXPIRED');
  }
}

/**
 * Thrown when a discount code has been used up
 */
export class DiscountCodeUsedUpError extends BusinessRuleError {
  /**
   * @param code - The fully used discount code
   */
  constructor(code: string) {
    super(`Discount code '${code}' has reached its usage limit`, 'DISCOUNT_CODE_USED_UP');
  }
}

/**
 * Thrown when trying to create a duplicate discount code
 */
export class DuplicateCodeError extends ConflictError {
  /**
   * @param code - The duplicate code
   */
  constructor(code: string) {
    super(`Discount code '${code}' already exists`);
  }
}

/**
 * Thrown when audience filter criteria are invalid
 */
export class InvalidAudienceFilterError extends ValidationError {
  /**
   * @param reason - Reason why audience filter is invalid
   */
  constructor(reason: string) {
    super('Invalid audience filter', reason);
  }
}

/**
 * Thrown when trying to activate a campaign that is already active
 */
export class CampaignAlreadyActiveError extends BusinessRuleError {
  /**
   * @param campaignId - Campaign ID
   */
  constructor(campaignId: string) {
    super(`Campaign '${campaignId}' is already active`, 'CAMPAIGN_ALREADY_ACTIVE');
  }
}

/**
 * Thrown when discount code minimum order amount is not met
 */
export class MinimumOrderNotMetError extends BusinessRuleError {
  /**
   * @param minimumAmount - Required minimum order amount
   * @param orderAmount - Actual order amount
   */
  constructor(minimumAmount: number, orderAmount: number) {
    super(
      `Order amount $${orderAmount} is below minimum required $${minimumAmount}`,
      'MINIMUM_ORDER_NOT_MET'
    );
  }
}

/**
 * Thrown when customer has exceeded per-customer code usage limit
 */
export class CodeUsagePerCustomerExceededError extends BusinessRuleError {
  /**
   * @param code - Discount code
   * @param maxUses - Maximum uses per customer
   */
  constructor(code: string, maxUses: number) {
    super(
      `Discount code '${code}' can only be used ${maxUses} time(s) per customer`,
      'CODE_USAGE_PER_CUSTOMER_EXCEEDED'
    );
  }
}

/**
 * Thrown when campaign cannot be started due to invalid date range
 */
export class InvalidCampaignDateRangeError extends ValidationError {
  /**
   * @param message - Description of date issue
   */
  constructor(message: string) {
    super('Invalid campaign date range', message);
  }
}

/**
 * Thrown when audience filter results in no customers
 */
export class EmptyAudienceError extends BusinessRuleError {
  /**
   * @param reason - Reason no customers matched filter
   */
  constructor(reason: string) {
    super(`Campaign audience filter returned no customers: ${reason}`, 'EMPTY_AUDIENCE');
  }
}

/**
 * Thrown when email sequence has no steps
 */
export class EmptySequenceError extends ValidationError {
  /**
   * @param sequenceId - Sequence ID
   */
  constructor(sequenceId: string) {
    super(`Email sequence '${sequenceId}' has no steps`, 'Must add at least one step');
  }
}

/**
 * Thrown when campaign budget is exceeded
 */
export class BudgetExceededError extends BusinessRuleError {
  /**
   * @param spent - Amount spent
   * @param budget - Total budget
   */
  constructor(spent: number, budget: number) {
    super(
      `Campaign budget exceeded: $${spent} spent out of $${budget} allocated`,
      'BUDGET_EXCEEDED'
    );
  }
}

/**
 * Thrown when discount code is not applicable to order items
 */
export class CodeNotApplicableError extends BusinessRuleError {
  /**
   * @param code - Discount code
   * @param reason - Why code is not applicable
   */
  constructor(code: string, reason: string) {
    super(`Discount code '${code}' is not applicable: ${reason}`, 'CODE_NOT_APPLICABLE');
  }
}
