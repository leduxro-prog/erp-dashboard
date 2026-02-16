import { BaseError } from '@shared/errors/BaseError';

/**
 * SessionExpiredError - HTTP 410 (Gone)
 *
 * Thrown when attempting to access or modify an expired configurator session.
 * Sessions expire after 24 hours of inactivity.
 *
 * @class SessionExpiredError
 */
export class SessionExpiredError extends BaseError {
  /**
   * Create a SessionExpiredError
   *
   * @param sessionId - ID of the expired session
   */
  constructor(sessionId: string) {
    super(
      `Configuration session ${sessionId} has expired. Please start a new session.`,
      'SESSION_EXPIRED',
      410
    );
  }
}

/**
 * IncompatibleComponentError - HTTP 422 (Unprocessable Entity)
 *
 * Thrown when attempting to add a component that violates compatibility rules.
 * Example: Adding two incompatible connectors, or exceeding component limits.
 *
 * @class IncompatibleComponentError
 */
export class IncompatibleComponentError extends BaseError {
  /**
   * Create an IncompatibleComponentError
   *
   * @param componentType - Component type that caused conflict
   * @param reason - Human-readable reason
   * @param conflictingComponentType - Component it conflicts with (optional)
   */
  constructor(
    componentType: string,
    reason: string,
    conflictingComponentType?: string
  ) {
    const message = conflictingComponentType
      ? `${componentType} is incompatible with ${conflictingComponentType}: ${reason}`
      : `${componentType} cannot be added: ${reason}`;

    super(message, 'INCOMPATIBLE_COMPONENT', 422);
  }
}

/**
 * MaxQuantityExceededError - HTTP 422 (Unprocessable Entity)
 *
 * Thrown when attempting to add more items than allowed by configuration rules.
 *
 * @class MaxQuantityExceededError
 */
export class MaxQuantityExceededError extends BaseError {
  /**
   * Create a MaxQuantityExceededError
   *
   * @param componentType - Component type that exceeded limit
   * @param currentQuantity - Current quantity
   * @param maxQuantity - Maximum allowed quantity
   */
  constructor(componentType: string, currentQuantity: number, maxQuantity: number) {
    super(
      `${componentType} exceeds maximum quantity. Current: ${currentQuantity}, Max: ${maxQuantity}`,
      'MAX_QUANTITY_EXCEEDED',
      422
    );
  }
}

/**
 * InvalidConfigurationError - HTTP 422 (Unprocessable Entity)
 *
 * Thrown when attempting to complete an invalid configuration.
 * Configuration must pass all compatibility checks before completion.
 *
 * @class InvalidConfigurationError
 */
export class InvalidConfigurationError extends BaseError {
  /**
   * Create an InvalidConfigurationError
   *
   * @param reason - Reason why configuration is invalid
   * @param violations - List of specific violations (optional)
   */
  constructor(reason: string, violations?: string[]) {
    const message = violations && violations.length > 0
      ? `Configuration is invalid: ${reason}. Violations: ${violations.join('; ')}`
      : `Configuration is invalid: ${reason}`;

    super(message, 'INVALID_CONFIGURATION', 422);
  }
}

/**
 * ComponentNotFoundError - HTTP 404 (Not Found)
 *
 * Thrown when a requested component does not exist in the catalog.
 *
 * @class ComponentNotFoundError
 */
export class ComponentNotFoundError extends BaseError {
  /**
   * Create a ComponentNotFoundError
   *
   * @param componentType - Component type that was not found
   * @param productId - Product ID that was not found (optional)
   */
  constructor(componentType: string, productId?: number) {
    const message = productId
      ? `Component ${componentType} with product ID ${productId} not found`
      : `Component ${componentType} not found`;

    super(message, 'COMPONENT_NOT_FOUND', 404);
  }
}

/**
 * RuleViolationError - HTTP 422 (Unprocessable Entity)
 *
 * Thrown when a configuration violates one or more compatibility rules.
 * More specific than InvalidConfigurationError when rules are involved.
 *
 * @class RuleViolationError
 */
export class RuleViolationError extends BaseError {
  /**
   * Create a RuleViolationError
   *
   * @param ruleId - ID of the violated rule
   * @param ruleName - Name of the rule
   * @param message - Violation message
   */
  constructor(ruleId: string, ruleName: string, message: string) {
    super(
      `Rule '${ruleName}' violated: ${message}`,
      'RULE_VIOLATION',
      422
    );
  }
}

/**
 * SessionNotFoundError - HTTP 404 (Not Found)
 *
 * Thrown when attempting to access a non-existent session.
 *
 * @class SessionNotFoundError
 */
export class SessionNotFoundError extends BaseError {
  /**
   * Create a SessionNotFoundError
   *
   * @param sessionToken - Session token that was not found
   */
  constructor(sessionToken: string) {
    super(
      `Configuration session with token ${sessionToken} not found`,
      'SESSION_NOT_FOUND',
      404
    );
  }
}

/**
 * InvalidSessionStatusError - HTTP 422 (Unprocessable Entity)
 *
 * Thrown when attempting an operation on a session in the wrong status.
 * Example: Trying to add items to a completed or expired session.
 *
 * @class InvalidSessionStatusError
 */
export class InvalidSessionStatusError extends BaseError {
  /**
   * Create an InvalidSessionStatusError
   *
   * @param currentStatus - Current session status
   * @param operation - Operation attempted
   */
  constructor(currentStatus: string, operation: string) {
    super(
      `Cannot ${operation} on session with status '${currentStatus}'`,
      'INVALID_SESSION_STATUS',
      422
    );
  }
}

/**
 * EmptyConfigurationError - HTTP 422 (Unprocessable Entity)
 *
 * Thrown when attempting to complete or validate an empty configuration.
 * Configuration must contain at least one item.
 *
 * @class EmptyConfigurationError
 */
export class EmptyConfigurationError extends BaseError {
  /**
   * Create an EmptyConfigurationError
   */
  constructor() {
    super(
      'Configuration must contain at least one item before completion',
      'EMPTY_CONFIGURATION',
      422
    );
  }
}
