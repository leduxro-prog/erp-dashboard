/**
 * @file Schema Validator Middleware
 * @module event-sdk/middleware/SchemaValidator
 * @description JSON Schema validation middleware for event payloads using AJV
 */

import {
  MiddlewareFunction,
  MiddlewareContext,
  SchemaValidatorConfig,
  Logger,
  ErrorType,
  ErrorSeverity,
  ClassifiedError,
} from '../types';
import { EventEnvelope, SchemaRegistry } from '@cypher/events';
import Ajv, { ValidateFunction, ErrorObject, SchemaObject } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Validation result details
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Path to the invalid field */
  path: string;
  /** Error message */
  message: string;
  /** Expected value/type */
  expected?: unknown;
  /** Actual value received */
  actual?: unknown;
  /** Schema that failed */
  schema?: SchemaObject;
}

/**
 * Error thrown when schema validation fails
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: ValidationError[]
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Default schema validator configuration
 */
const DEFAULT_VALIDATOR_CONFIG: Required<SchemaValidatorConfig> = {
  enabled: true,
  throwOnError: true,
  schemasDir: undefined,
  validateEnvelope: true,
  validatePayload: true,
};

/**
 * Schema Validator Middleware
 *
 * Validates event envelopes and their payloads against JSON schemas.
 * Uses AJV for high-performance validation with custom formats.
 */
export class SchemaValidatorMiddleware {
  private config: Required<SchemaValidatorConfig>;
  private logger?: Logger;
  private ajv: Ajv;
  private schemaRegistry?: SchemaRegistry;
  private validators: Map<string, ValidateFunction> = new Map();
  private envelopeValidator?: ValidateFunction;

  constructor(
    config: Partial<SchemaValidatorConfig> = {},
    logger?: Logger,
    schemaRegistry?: SchemaRegistry
  ) {
    this.config = {
      ...DEFAULT_VALIDATOR_CONFIG,
      ...config,
      throwOnError: config.throwOnError ?? DEFAULT_VALIDATOR_CONFIG.throwOnError,
      validateEnvelope: config.validateEnvelope ?? DEFAULT_VALIDATOR_CONFIG.validateEnvelope,
      validatePayload: config.validatePayload ?? DEFAULT_VALIDATOR_CONFIG.validatePayload,
    };
    this.logger = logger;
    this.schemaRegistry = schemaRegistry;

    // Initialize AJV
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      loadSchema: this.loadSchema.bind(this),
    });

    // Add formats
    addFormats(this.ajv);

    // Register custom formats
    this.registerCustomFormats();

    // Compile envelope validator
    this.compileEnvelopeValidator();
  }

  /**
   * Create a middleware function for use in the pipeline
   *
   * @returns Middleware function
   */
  public middleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>) => {
      // Skip if disabled
      if (!this.config.enabled) {
        this.debug('Schema validation disabled, skipping');
        await next();
        return;
      }

      try {
        // Validate envelope structure if enabled
        if (this.config.validateEnvelope) {
          this.validateEnvelope(context.envelope);
        }

        // Validate payload against schema if enabled
        if (this.config.validatePayload) {
          await this.validatePayload(context.envelope);
        }

        this.debug('Schema validation passed', {
          eventId: context.envelope.event_id,
          eventType: context.envelope.event_type,
          version: context.envelope.event_version,
        });

        await next();
      } catch (error) {
        // Create classified error
        const classifiedError = this.createClassifiedError(
          error,
          context.envelope
        );
        context.error = classifiedError;
        context.shouldReject = true;

        // Re-throw if configured
        if (this.config.throwOnError) {
          throw classifiedError;
        }

        this.error('Schema validation failed', classifiedError);
      }
    };
  }

  /**
   * Validate envelope structure
   *
   * @param envelope - Event envelope to validate
   * @throws SchemaValidationError if validation fails
   */
  private validateEnvelope(envelope: EventEnvelope): void {
    if (!this.envelopeValidator) {
      this.warn('Envelope validator not compiled, skipping envelope validation');
      return;
    }

    const valid = this.envelopeValidator(envelope);

    if (!valid) {
      const errors = this.convertAjvErrors(this.envelopeValidator.errors || []);
      throw new SchemaValidationError(
        'Event envelope structure validation failed',
        errors
      );
    }
  }

  /**
   * Validate payload against schema
   *
   * @param envelope - Event envelope with payload to validate
   * @throws SchemaValidationError if validation fails
   */
  private async validatePayload(envelope: EventEnvelope): Promise<void> {
    const schemaId = this.buildSchemaId(
      envelope.event_type,
      envelope.event_version
    );

    let validator = this.validators.get(schemaId);

    // Load and compile validator if not cached
    if (!validator) {
      validator = await this.loadValidator(schemaId);
      if (validator) {
        this.validators.set(schemaId, validator);
      }
    }

    // If no validator available, log warning and continue
    if (!validator) {
      this.warn(`No schema found for event type: ${envelope.event_type} v${envelope.event_version}`);
      return;
    }

    const valid = validator(envelope.payload);

    if (!valid) {
      const errors = this.convertAjvErrors(validator.errors || []);
      throw new SchemaValidationError(
        `Payload validation failed for event type: ${envelope.event_type}`,
        errors
      );
    }
  }

  /**
   * Load and compile a validator for a schema
   *
   * @param schemaId - Schema ID to load
   * @returns Compiled validator or undefined
   */
  private async loadValidator(schemaId: string): Promise<ValidateFunction | undefined> {
    try {
      if (this.schemaRegistry) {
        const schemaInfo = this.schemaRegistry.getSchema(schemaId);
        if (schemaInfo) {
          // Load schema from file
          const content = await import('fs/promises');
          const schemaJson = await content.readFile(schemaInfo.path, 'utf-8');
          const schema: SchemaObject = JSON.parse(schemaJson);
          return this.ajv.compile(schema);
        }
      }
      return undefined;
    } catch (error) {
      this.error(`Failed to load validator for schema ${schemaId}:`, error);
      return undefined;
    }
  }

  /**
   * Load schema asynchronously (for $ref resolution)
   *
   * @param uri - Schema URI to load
   * @returns Promise resolving to schema object
   */
  private async loadSchema(uri: string): Promise<SchemaObject> {
    // Check if this is a local file reference
    if (uri.startsWith('file://')) {
      const content = await import('fs/promises');
      const filePath = uri.replace('file://', '');
      const schemaJson = await content.readFile(filePath, 'utf-8');
      return JSON.parse(schemaJson);
    }

    // Try to load from schema registry
    if (this.schemaRegistry) {
      const schemaInfo = this.schemaRegistry.getSchema(uri);
      if (schemaInfo) {
        const content = await import('fs/promises');
        const schemaJson = await content.readFile(schemaInfo.path, 'utf-8');
        return JSON.parse(schemaJson);
      }
    }

    throw new Error(`Cannot load schema from URI: ${uri}`);
  }

  /**
   * Compile the envelope validator
   */
  private compileEnvelopeValidator(): void {
    const envelopeSchema: SchemaObject = {
      type: 'object',
      required: ['event_id', 'event_type', 'event_version', 'occurred_at', 'producer', 'correlation_id', 'priority', 'payload'],
      properties: {
        event_id: { type: 'string', format: 'uuid' },
        event_type: { type: 'string', pattern: '^[a-z][a-z0-9-]*\\.[a-z][a-z0-9-]*$' },
        event_version: { type: 'string', pattern: '^v\\d+$' },
        occurred_at: { type: 'string', format: 'date-time' },
        producer: { type: 'string' },
        producer_version: { type: 'string' },
        producer_instance: { type: 'string' },
        correlation_id: { type: 'string', format: 'uuid' },
        causation_id: { type: 'string', format: 'uuid' },
        parent_event_id: { type: 'string', format: 'uuid' },
        trace_id: { type: 'string' },
        routing_key: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        payload: { type: 'object' },
        metadata: { type: 'object' },
      },
      additionalProperties: false,
    };

    this.envelopeValidator = this.ajv.compile(envelopeSchema);
  }

  /**
   * Register custom AJV formats
   */
  private registerCustomFormats(): void {
    // UUID format
    this.ajv.addFormat('uuid', {
      type: 'string',
      validate: (data: string) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return typeof data === 'string' && uuidRegex.test(data);
      },
    });
  }

  /**
   * Convert AJV errors to ValidationError format
   *
   * @param errors - AJV error objects
   * @returns Validation errors
   */
  private convertAjvErrors(errors: ErrorObject[]): ValidationError[] {
    return errors.map((err) => ({
      path: err.instancePath || 'root',
      message: err.message || 'Validation error',
      expected: err.schema,
      actual: err.data,
      schema: err.parentSchema,
    }));
  }

  /**
   * Create a classified error from a validation error
   *
   * @param error - Original error
   * @param envelope - Event envelope
   * @returns Classified error
   */
  private createClassifiedError(
    error: unknown,
    envelope: EventEnvelope
  ): ClassifiedError {
    const baseError = error instanceof Error ? error : new Error(String(error));

    const validationErrors: ValidationError[] =
      error instanceof SchemaValidationError
        ? error.validationErrors
        : [{ path: 'unknown', message: String(error) }];

    return Object.assign(baseError, {
      type: ErrorType.SCHEMA_VALIDATION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      originalError: error,
      context: {
        eventId: envelope.event_id,
        eventType: envelope.event_type,
        eventVersion: envelope.event_version,
        validationErrors,
      },
    });
  }

  /**
   * Build schema ID from event type and version
   *
   * @param eventType - Event type
   * @param eventVersion - Event version
   * @returns Schema ID
   */
  private buildSchemaId(eventType: string, eventVersion: string): string {
    const [domain, action] = eventType.split('.');
    const versionNum = eventVersion.replace('v', '');
    return `https://schemas.cypher.ro/events/${domain}/${action}-v${versionNum}.json`;
  }

  /**
   * Register a schema manually
   *
   * @param schemaId - Schema ID
   * @param schema - JSON Schema object
   */
  public registerSchema(schemaId: string, schema: SchemaObject): void {
    const validator = this.ajv.compile(schema);
    this.validators.set(schemaId, validator);
  }

  /**
   * Get the current configuration
   *
   * @returns Current validator configuration
   */
  public getConfig(): Readonly<Required<SchemaValidatorConfig>> {
    return { ...this.config };
  }

  /**
   * Update the configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<SchemaValidatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      throwOnError: config.throwOnError ?? this.config.throwOnError,
      validateEnvelope: config.validateEnvelope ?? this.config.validateEnvelope,
      validatePayload: config.validatePayload ?? this.config.validatePayload,
    };
  }

  /**
   * Set the logger
   *
   * @param logger - Logger instance
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Clear cached validators
   */
  public clearCache(): void {
    this.validators.clear();
  }

  /**
   * Get statistics about cached validators
   *
   * @returns Validator cache statistics
   */
  public getCacheStats(): { count: number; schemas: string[] } {
    return {
      count: this.validators.size,
      schemas: Array.from(this.validators.keys()),
    };
  }

  private debug(message: string, ...args: unknown[]): void {
    this.logger?.debug(`[SchemaValidator] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger?.warn(`[SchemaValidator] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]): void {
    this.logger?.error(`[SchemaValidator] ${message}`, ...args);
  }

}

/**
 * Create a schema validator middleware factory function
 *
 * @param config - Optional configuration
 * @param logger - Optional logger
 * @param schemaRegistry - Optional schema registry
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const validator = createSchemaValidator({ throwOnError: false });
 * processor.use(validator);
 * ```
 */
export function createSchemaValidator(
  config: Partial<SchemaValidatorConfig> = {},
  logger?: Logger,
  schemaRegistry?: SchemaRegistry
): MiddlewareFunction {
  const middleware = new SchemaValidatorMiddleware(config, logger, schemaRegistry);
  return middleware.middleware();
}

/**
 * Standalone function to validate an event envelope
 *
 * @param envelope - Event envelope to validate
 * @param config - Optional configuration
 * @param schemaRegistry - Optional schema registry
 * @returns Validation result
 */
export async function validateEvent(
  envelope: EventEnvelope,
  config: Partial<SchemaValidatorConfig> = {},
  schemaRegistry?: SchemaRegistry
): Promise<ValidationResult> {
  const middleware = new SchemaValidatorMiddleware(config, undefined, schemaRegistry);

  // Validate envelope
  if (config.validateEnvelope !== false) {
    try {
      middleware.validateEnvelope(envelope);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        return {
          valid: false,
          errors: error.validationErrors,
        };
      }
    }
  }

  // Validate payload
  if (config.validatePayload !== false) {
    try {
      await middleware.validatePayload(envelope);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        return {
          valid: false,
          errors: error.validationErrors,
        };
      }
    }
  }

  return { valid: true, errors: [] };
}
