/**
 * @file Schema Validator Helper
 * @module tests/events/contract/helpers/SchemaValidator
 * @description Schema validation helper for contract testing. Provides utilities
 * to validate event payloads against JSON schemas, test schema evolution,
 * and ensure producer/consumer compatibility.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction, SchemaObject, ErrorObject } from 'ajv';
import { EventEnvelope, ValidationResult } from '../../../../events/types/EventEnvelope';

type SchemaProperty = {
  type?: string | string[];
  enum?: unknown[];
};

/**
 * Schema validation result with detailed information
 */
export interface DetailedValidationResult extends ValidationResult {
  /** Schema ID used for validation */
  schemaId?: string;
  /** Schema version */
  schemaVersion?: string;
  /** Raw AJV errors */
  rawErrors?: ErrorObject[];
  /** Whether the schema was found */
  schemaFound: boolean;
  /** Time taken for validation (ms) */
  validationTime: number;
}

/**
 * Schema compatibility check result
 */
export interface CompatibilityResult {
  /** Whether schemas are compatible */
  compatible: boolean;
  /** Type of incompatibility */
  incompatibilityType?: 'breaking' | 'non-breaking' | 'version-mismatch';
  /** Details of incompatibilities */
  issues: Array<{
    field: string;
    issue: string;
    severity: 'error' | 'warning';
  }>;
  /** Recommendation */
  recommendation?: string;
}

/**
 * Schema evolution direction
 */
export enum EvolutionDirection {
  /** New version is strictly compatible with old */
  BACKWARD_COMPATIBLE = 'backward-compatible',
  /** Old version can be upgraded to new */
  FORWARD_COMPATIBLE = 'forward-compatible',
  /** No compatibility - breaking change */
  BREAKING = 'breaking',
  /** No clear compatibility */
  UNKNOWN = 'unknown',
}

/**
 * Schema evolution check result
 */
export interface EvolutionResult {
  /** Direction of evolution */
  direction: EvolutionDirection;
  /** Whether the change is safe */
  isSafe: boolean;
  /** Description of changes */
  changes: Array<{
    type:
      | 'field_added'
      | 'field_removed'
      | 'field_type_changed'
      | 'enum_added'
      | 'enum_removed'
      | 'constraint_changed';
    path: string;
    description: string;
    impact: string;
  }>;
}

/**
 * Contract test result for producer/consumer
 */
export interface ContractTestResult {
  /** Test case name */
  testName: string;
  /** Passed or failed */
  passed: boolean;
  /** Producer event validated */
  producerEvent: EventEnvelope;
  /** Validation result */
  validation: DetailedValidationResult;
  /** Compatibility result (if testing against multiple versions) */
  compatibility?: CompatibilityResult;
  /** Error message if failed */
  error?: string;
  /** Test duration in ms */
  duration: number;
}

/**
 * Schema Validator Class
 *
 * Provides comprehensive schema validation capabilities for contract testing.
 */
export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();
  private schemas: Map<string, SchemaObject> = new Map();
  private schemasDir: string;

  constructor(schemasDir?: string) {
    this.schemasDir = schemasDir || path.join(process.cwd(), 'events', 'schemas');

    // Initialize AJV with strict settings for contract testing
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      strictTypes: false,
      allowUnionTypes: true,
      strictTuples: true,
      strictRequired: true,
    });

    // Add standard formats when optional dependency is available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const addFormatsModule = require('ajv-formats');
      const addFormats = addFormatsModule.default || addFormatsModule;
      if (typeof addFormats === 'function') {
        addFormats(this.ajv);
      }
    } catch {
      // ajv-formats not installed in this environment
    }

    // Register custom UUID format
    this.ajv.addFormat('uuid', {
      type: 'string',
      validate: (data: string) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return typeof data === 'string' && uuidRegex.test(data);
      },
    });

    // Register custom currency format (3-letter ISO code)
    this.ajv.addFormat('currency', {
      type: 'string',
      validate: (data: string) => {
        return typeof data === 'string' && /^[A-Z]{3}$/.test(data);
      },
    });
  }

  /**
   * Load a schema from a file
   */
  public async loadSchema(filePath: string): Promise<SchemaObject> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.schemasDir, filePath);

    const content = await fs.readFile(absolutePath, 'utf-8');
    const schema: SchemaObject = JSON.parse(content);

    if (!(schema as { version?: string }).version) {
      const versionMatch = absolutePath.match(/-v(\d+)\.json$/);
      if (versionMatch) {
        (schema as { version?: string }).version = `v${versionMatch[1]}`;
      }
    }

    // Cache the schema
    if (schema.$id) {
      this.schemas.set(schema.$id, schema);
    }

    return schema;
  }

  /**
   * Load all schemas from directory
   */
  public async loadAllSchemas(): Promise<Map<string, SchemaObject>> {
    await this.scanDirectory(this.schemasDir);
    return this.schemas;
  }

  /**
   * Recursively scan directory for schema files
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          if (entry.name !== 'registry.json') {
            try {
              await this.loadSchema(fullPath);
            } catch (error) {
              console.warn(`Failed to load schema from ${fullPath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  /**
   * Get schema by event type and version
   */
  public getSchema(eventType: string, version: string = 'v1'): SchemaObject | undefined {
    const schemaId = this.buildSchemaId(eventType, version);
    return this.schemas.get(schemaId);
  }

  /**
   * Validate an event envelope against its schema
   */
  public async validateEvent(envelope: EventEnvelope): Promise<DetailedValidationResult> {
    const startTime = Date.now();

    // First validate envelope structure
    const envelopeErrors: ValidationResult['errors'] = [];
    this.validateEnvelopeStructure(envelope, envelopeErrors);

    if (envelopeErrors.length > 0) {
      return {
        valid: false,
        errors: envelopeErrors,
        schemaFound: false,
        validationTime: Date.now() - startTime,
      };
    }

    // Get schema for this event
    const schema = this.getSchema(envelope.event_type, envelope.event_version);

    if (!schema) {
      return {
        valid: false,
        errors: [
          {
            path: 'schema',
            message: `No schema found for event type: ${envelope.event_type}, version: ${envelope.event_version}`,
            expected: 'existing schema',
            actual: 'none',
          },
        ],
        schemaFound: false,
        validationTime: Date.now() - startTime,
      };
    }

    // Get or compile validator
    const schemaId = schema.$id || `${envelope.event_type}.${envelope.event_version}`;
    let validator = this.validators.get(schemaId);

    if (!validator) {
      validator = this.ajv.compile(schema);
      this.validators.set(schemaId, validator);
    }

    // Validate payload against schema
    const valid = validator(envelope.payload);

    if (valid) {
      return {
        valid: true,
        errors: [],
        schemaId,
        schemaVersion: envelope.event_version,
        schemaFound: true,
        validationTime: Date.now() - startTime,
      };
    }

    const errors = (validator.errors || []).map((err) => {
      const missingProperty =
        err.keyword === 'required' &&
        err.params &&
        typeof (err.params as { missingProperty?: unknown }).missingProperty === 'string'
          ? (err.params as { missingProperty: string }).missingProperty
          : undefined;

      const payloadPath = missingProperty
        ? `${err.instancePath || ''}/${missingProperty}`
        : err.instancePath || '';

      return {
        path: `/payload${payloadPath}`,
        message: err.message || 'Validation error',
        expected: err.schema,
        actual: err.data,
      };
    });

    return {
      valid: false,
      errors,
      schemaId,
      schemaVersion: envelope.event_version,
      rawErrors: validator.errors ?? undefined,
      schemaFound: true,
      validationTime: Date.now() - startTime,
    };
  }

  /**
   * Validate raw data against a schema
   */
  public validateData(
    data: any,
    eventType: string,
    version: string = 'v1',
  ): DetailedValidationResult {
    const startTime = Date.now();

    const schema = this.getSchema(eventType, version);

    if (!schema) {
      return {
        valid: false,
        errors: [
          {
            path: 'schema',
            message: `No schema found for event type: ${eventType}, version: ${version}`,
          },
        ],
        schemaFound: false,
        validationTime: Date.now() - startTime,
      };
    }

    const schemaId = schema.$id || `${eventType}.${version}`;
    let validator = this.validators.get(schemaId);

    if (!validator) {
      validator = this.ajv.compile(schema);
      this.validators.set(schemaId, validator);
    }

    const valid = validator(data);

    if (valid) {
      return {
        valid: true,
        errors: [],
        schemaId,
        schemaVersion: version,
        schemaFound: true,
        validationTime: Date.now() - startTime,
      };
    }

    const errors = (validator.errors || []).map((err) => ({
      path: err.instancePath || 'root',
      message: err.message || 'Validation error',
      expected: err.schema,
      actual: err.data,
    }));

    return {
      valid: false,
      errors,
      schemaId,
      schemaVersion: version,
      rawErrors: validator.errors ?? undefined,
      schemaFound: true,
      validationTime: Date.now() - startTime,
    };
  }

  /**
   * Check compatibility between two schema versions
   */
  public checkCompatibility(oldSchema: SchemaObject, newSchema: SchemaObject): CompatibilityResult {
    const issues: CompatibilityResult['issues'] = [];

    // Check required fields
    const oldRequired = new Set<string>((oldSchema.required || []) as string[]);
    const newRequired = new Set<string>((newSchema.required || []) as string[]);

    // Breaking: New required fields that didn't exist before
    for (const field of newRequired) {
      if (!oldRequired.has(field)) {
        issues.push({
          field,
          issue: 'Field added as required (non-existent in old schema)',
          severity: 'error',
        });
      }
    }

    // Breaking: Removed required fields
    for (const field of oldRequired) {
      if (!newRequired.has(field)) {
        issues.push({
          field,
          issue: 'Required field removed',
          severity: 'error',
        });
      }
    }

    // Check property type changes
    const oldProps = (oldSchema.properties || {}) as Record<string, SchemaProperty>;
    const newProps = (newSchema.properties || {}) as Record<string, SchemaProperty>;

    for (const [propName, newProp] of Object.entries(newProps) as [string, SchemaProperty][]) {
      const oldProp = oldProps[propName];

      if (oldProp) {
        // Check for type changes
        const oldType = Array.isArray(oldProp.type) ? oldProp.type : [oldProp.type];
        const newType = Array.isArray(newProp.type) ? newProp.type : [newProp.type];

        // Check if types are incompatible
        const commonTypes = oldType.filter((t) => newType.includes(t));

        if (commonTypes.length === 0) {
          issues.push({
            field: propName,
            issue: `Type changed from ${oldType.join('|')} to ${newType.join('|')}`,
            severity: 'error',
          });
        }

        // Check enum value changes
        if (Array.isArray(oldProp.enum) && Array.isArray(newProp.enum)) {
          const oldEnum = oldProp.enum as unknown[];
          const newEnum = newProp.enum as unknown[];
          const removedEnums = oldEnum.filter((e: unknown) => !newEnum.includes(e));
          if (removedEnums.length > 0) {
            issues.push({
              field: propName,
              issue: `enum values removed: ${removedEnums.join(', ')}`,
              severity: 'error',
            });
          }
        }
      } else {
        issues.push({
          field: propName,
          issue: 'Field added to schema',
          severity: newRequired.has(propName) ? 'error' : 'warning',
        });
      }
    }

    // Check if all fields removed
    for (const propName of Object.keys(oldProps)) {
      if (!newProps[propName]) {
        issues.push({
          field: propName,
          issue: 'Field removed from schema',
          severity: 'warning',
        });
      }
    }

    const isCompatible = issues.filter((i) => i.severity === 'error').length === 0;

    return {
      compatible: isCompatible,
      incompatibilityType: isCompatible
        ? 'non-breaking'
        : issues.some((i) => i.severity === 'error')
          ? 'breaking'
          : 'version-mismatch',
      issues,
      recommendation: isCompatible
        ? 'Schema is backward compatible'
        : 'Schema has breaking changes - version bump required',
    };
  }

  /**
   * Check schema evolution direction
   */
  public checkEvolution(oldSchema: SchemaObject, newSchema: SchemaObject): EvolutionResult {
    const compatibility = this.checkCompatibility(oldSchema, newSchema);
    const reverseCompatibility = this.checkCompatibility(newSchema, oldSchema);

    const changes: EvolutionResult['changes'] = [];
    const oldProps = (oldSchema.properties || {}) as Record<string, SchemaProperty>;
    const newProps = (newSchema.properties || {}) as Record<string, SchemaProperty>;
    const oldRequired = new Set<string>((oldSchema.required || []) as string[]);
    const newRequired = new Set<string>((newSchema.required || []) as string[]);

    // Detect changes
    for (const [propName, newProp] of Object.entries(newProps) as [string, SchemaProperty][]) {
      if (!oldProps[propName]) {
        const isNewRequired = newRequired.has(propName);
        changes.push({
          type: 'field_added',
          path: propName,
          description: isNewRequired ? 'New required field added' : 'New optional field added',
          impact: isNewRequired ? 'Breaking change for old consumers' : 'Non-breaking change',
        });
      } else {
        const oldProp = oldProps[propName];
        const oldType = Array.isArray(oldProp.type) ? oldProp.type : [oldProp.type];
        const newType = Array.isArray(newProp.type) ? newProp.type : [newProp.type];

        if (JSON.stringify(oldType) !== JSON.stringify(newType)) {
          changes.push({
            type: 'field_type_changed',
            path: propName,
            description: `Field type changed from ${oldType.join('|')} to ${newType.join('|')}`,
            impact: 'Breaking change',
          });
        }

        if (
          Array.isArray(oldProp.enum) &&
          Array.isArray(newProp.enum) &&
          JSON.stringify(oldProp.enum) !== JSON.stringify(newProp.enum)
        ) {
          const oldEnum = oldProp.enum as unknown[];
          const newEnum = newProp.enum as unknown[];
          const added = newEnum.filter((e: unknown) => !oldEnum.includes(e));
          const removed = oldEnum.filter((e: unknown) => !newEnum.includes(e));

          if (added.length > 0) {
            changes.push({
              type: 'enum_added',
              path: propName,
              description: `Enum values added: ${added.join(', ')}`,
              impact: 'Non-breaking change',
            });
          }

          if (removed.length > 0) {
            changes.push({
              type: 'enum_removed',
              path: propName,
              description: `Enum values removed: ${removed.join(', ')}`,
              impact: 'Breaking change',
            });
          }
        }
      }
    }

    for (const propName of Object.keys(oldProps)) {
      if (!newProps[propName]) {
        const wasRequired = oldRequired.has(propName);
        changes.push({
          type: 'field_removed',
          path: propName,
          description: wasRequired ? 'Required field removed' : 'Optional field removed',
          impact: wasRequired ? 'Breaking change' : 'Potential breaking change',
        });
      }
    }

    // Determine evolution direction
    let direction: EvolutionDirection;
    if (compatibility.compatible && reverseCompatibility.compatible) {
      direction = EvolutionDirection.BACKWARD_COMPATIBLE;
    } else if (compatibility.compatible) {
      direction = EvolutionDirection.BACKWARD_COMPATIBLE;
    } else if (reverseCompatibility.compatible) {
      direction = EvolutionDirection.FORWARD_COMPATIBLE;
    } else {
      direction = EvolutionDirection.BREAKING;
    }

    const isSafe = direction === EvolutionDirection.BACKWARD_COMPATIBLE;

    return {
      direction,
      isSafe,
      changes,
    };
  }

  /**
   * Run a contract test for a producer event
   */
  public async runContractTest(
    testName: string,
    producerEvent: EventEnvelope,
  ): Promise<ContractTestResult> {
    const startTime = Date.now();

    try {
      const validation = await this.validateEvent(producerEvent);

      return {
        testName,
        passed: validation.valid,
        producerEvent,
        validation,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        producerEvent,
        validation: {
          valid: false,
          errors: [
            {
              path: 'validation',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          schemaFound: false,
          validationTime: Date.now() - startTime,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate envelope structure
   */
  private validateEnvelopeStructure(
    envelope: EventEnvelope,
    errors: ValidationResult['errors'],
  ): void {
    // Validate event_id (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!envelope.event_id || !uuidRegex.test(envelope.event_id)) {
      errors.push({
        path: 'event_id',
        message: 'event_id must be a valid UUID v4',
        expected: 'UUID v4',
        actual: envelope.event_id,
      });
    }

    // Validate event_type
    if (!envelope.event_type || typeof envelope.event_type !== 'string') {
      errors.push({
        path: 'event_type',
        message: 'event_type must be a non-empty string',
        expected: 'non-empty string',
        actual: envelope.event_type,
      });
    } else if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(envelope.event_type)) {
      errors.push({
        path: 'event_type',
        message: 'event_type must follow pattern: domain.action (e.g., order.created)',
        expected: 'domain.action format',
        actual: envelope.event_type,
      });
    }

    // Validate event_version
    if (!envelope.event_version || typeof envelope.event_version !== 'string') {
      errors.push({
        path: 'event_version',
        message: 'event_version must be a non-empty string',
        expected: 'non-empty string (e.g., v1, v2)',
        actual: envelope.event_version,
      });
    } else if (!/^v\d+$/.test(envelope.event_version)) {
      errors.push({
        path: 'event_version',
        message: 'event_version must follow pattern: v{number} (e.g., v1, v2)',
        expected: 'v{number}',
        actual: envelope.event_version,
      });
    }

    // Validate occurred_at
    if (!envelope.occurred_at || typeof envelope.occurred_at !== 'string') {
      errors.push({
        path: 'occurred_at',
        message: 'occurred_at must be a non-empty ISO 8601 timestamp',
        expected: 'ISO 8601 timestamp',
        actual: envelope.occurred_at,
      });
    } else if (isNaN(Date.parse(envelope.occurred_at))) {
      errors.push({
        path: 'occurred_at',
        message: 'occurred_at must be a valid date',
        expected: 'valid ISO 8601 date',
        actual: envelope.occurred_at,
      });
    }

    // Validate producer
    if (!envelope.producer || typeof envelope.producer !== 'string') {
      errors.push({
        path: 'producer',
        message: 'producer must be a non-empty string',
        expected: 'non-empty string',
        actual: envelope.producer,
      });
    }

    // Validate correlation_id (UUID)
    if (!envelope.correlation_id || !uuidRegex.test(envelope.correlation_id)) {
      errors.push({
        path: 'correlation_id',
        message: 'correlation_id must be a valid UUID v4',
        expected: 'UUID v4',
        actual: envelope.correlation_id,
      });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'critical'];
    if (!envelope.priority || !validPriorities.includes(envelope.priority)) {
      errors.push({
        path: 'priority',
        message: `priority must be one of: ${validPriorities.join(', ')}`,
        expected: validPriorities,
        actual: envelope.priority,
      });
    }

    // Validate payload
    if (envelope.payload === undefined || envelope.payload === null) {
      errors.push({
        path: 'payload',
        message: 'payload is required',
        expected: 'any object or primitive',
        actual: null,
      });
    }
  }

  /**
   * Build schema ID from event type and version
   */
  private buildSchemaId(eventType: string, version: string): string {
    const [domain, ...actionParts] = eventType.split('.');
    const action = actionParts.join('-');
    const versionNum = version.replace('v', '');
    return `https://schemas.cypher.ro/events/${domain}/${domain}-${action}-v${versionNum}.json`;
  }

  /**
   * Get all loaded schemas
   */
  public getAllSchemas(): Map<string, SchemaObject> {
    return new Map(this.schemas);
  }

  /**
   * Get schema statistics
   */
  public getStats(): {
    totalSchemas: number;
    eventTypes: string[];
    versionCounts: Record<string, number>;
  } {
    const eventTypes = new Set<string>();
    const versionCounts: Record<string, number> = {};

    this.schemas.forEach((schema, id) => {
      if (schema.$id) {
        const match = schema.$id.match(/events\/([^\/]+)\/.+-v(\d+)\.json$/);
        if (match) {
          eventTypes.add(match[1]);
          const key = `${match[1]}:v${match[2]}`;
          versionCounts[key] = (versionCounts[key] || 0) + 1;
        }
      }
    });

    return {
      totalSchemas: this.schemas.size,
      eventTypes: Array.from(eventTypes).sort(),
      versionCounts,
    };
  }
}

/**
 * Create a singleton instance of SchemaValidator
 */
let validatorInstance: SchemaValidator | null = null;

export function getSchemaValidator(schemasDir?: string): SchemaValidator {
  if (!validatorInstance) {
    validatorInstance = new SchemaValidator(schemasDir);
  }
  return validatorInstance;
}
