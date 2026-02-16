/**
 * @file Schema Registry
 * @module events/registry
 * @description Schema registry for managing event schemas, validation,
 * and schema versioning in the Cypher ERP event-driven architecture.
 *
 * The registry provides:
 * - Schema registration and lookup
 * - Event validation against schemas
 * - Schema version management
 * - Runtime schema loading and caching
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import {
  EventEnvelope,
  EventPriority,
  EventEnvelopeFactory,
  ValidationResult,
} from '../types/EventEnvelope';

export type SchemaObject = Record<string, any> & {
  $id?: string;
  title?: string;
  description?: string;
};

/**
 * Schema registration information
 */
export interface SchemaInfo {
  /** Unique schema ID */
  $id: string;
  /** Event type this schema applies to */
  event_type: string;
  /** Schema version */
  version: string;
  /** Schema title */
  title: string;
  /** Schema description */
  description?: string;
  /** File path to schema */
  path: string;
  /** Whether this schema is currently active */
  active: boolean;
  /** ISO date when schema was registered */
  registered_at: string;
}

/**
 * Event type and version key
 */
export type EventTypeKey = `${string}.${string}`;

/**
 * Schema registry configuration options
 */
export interface SchemaRegistryOptions {
  /** Directory containing schema files */
  schemasDir?: string;
  /** Path to registry JSON file */
  registryPath?: string;
  /** Whether to enable schema caching */
  enableCache?: boolean;
  /** Custom schema directories to include */
  schemaPaths?: string[];
}

/**
 * Registry JSON structure for persistence
 */
export interface RegistryJson {
  version: string;
  schemas: Record<string, SchemaInfo>;
  last_updated: string;
}

/**
 * Schema Registry Class
 *
 * Centralized registry for managing event schemas in the system.
 * Provides methods for registration, validation, and lookup.
 */
export class SchemaRegistry {
  private static instance: SchemaRegistry;
  private ajv: any;
  private schemas: Map<string, SchemaInfo> = new Map();
  private validators: Map<string, ValidateFunction> = new Map();
  private schemasDir: string;
  private registryPath: string;
  private enableCache: boolean;
  private initialized: boolean = false;

  /**
   * Get the singleton instance of the SchemaRegistry
   *
   * @param options - Configuration options
   * @returns SchemaRegistry instance
   */
  public static getInstance(options?: SchemaRegistryOptions): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry(options);
    }
    return SchemaRegistry.instance;
  }

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(options: SchemaRegistryOptions = {}) {
    this.schemasDir = options.schemasDir || path.join(__dirname, 'schemas');
    this.registryPath = options.registryPath || path.join(this.schemasDir, 'registry.json');
    this.enableCache = options.enableCache ?? true;

    // Initialize AJV with additional formats
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      loadSchema: this.loadSchemaAsync.bind(this),
    });

    // Register custom UUID format
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
   * Initialize the registry by loading schemas from disk
   *
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load registry from JSON if it exists
      await this.loadRegistry();

      // Scan for new schema files
      await this.scanSchemas();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize SchemaRegistry:', error);
      throw error;
    }
  }

  /**
   * Register a schema
   *
   * @param schema - JSON Schema object
   * @param filePath - Optional file path for the schema
   * @returns Registered schema information
   *
   * @example
   * ```typescript
   * const schemaInfo = await registry.register({
   *   $id: 'https://example.com/schema/v1',
   *   $schema: 'http://json-schema.org/draft-07/schema#',
   *   type: 'object',
   *   properties: { ... }
   * });
   * ```
   */
  public async register(
    schema: SchemaObject,
    filePath?: string
  ): Promise<SchemaInfo> {
    if (!schema.$id) {
      throw new Error('Schema must have an $id property');
    }

    const event_type = this.extractEventType(schema.$id);
    const version = this.extractVersion(schema.$id);

    const schemaInfo: SchemaInfo = {
      $id: schema.$id,
      event_type,
      version,
      title: schema.title || schema.$id,
      description: schema.description,
      path: filePath || schema.$id,
      active: true,
      registered_at: new Date().toISOString(),
    };

    // Store schema info
    this.schemas.set(schema.$id, schemaInfo);

    // Compile validator
    if (this.enableCache) {
      const validator = this.ajv.compile(schema);
      this.validators.set(schema.$id, validator);
    }

    return schemaInfo;
  }

  /**
   * Register a schema from a file path
   *
   * @param filePath - Path to the schema JSON file
   * @returns Registered schema information
   */
  public async registerFromFile(filePath: string): Promise<SchemaInfo> {
    const content = await fs.readFile(filePath, 'utf-8');
    const schema: SchemaObject = JSON.parse(content);
    return this.register(schema, filePath);
  }

  /**
   * Unregister a schema
   *
   * @param schemaId - Schema ID to unregister
   * @returns True if schema was unregistered
   */
  public unregister(schemaId: string): boolean {
    const removed = this.schemas.delete(schemaId);
    this.validators.delete(schemaId);
    return removed;
  }

  /**
   * Get schema info by schema ID
   *
   * @param schemaId - Schema ID to look up
   * @returns Schema info or undefined if not found
   */
  public getSchema(schemaId: string): SchemaInfo | undefined {
    return this.schemas.get(schemaId);
  }

  /**
   * Get schema by event type and version
   *
   * @param eventType - Event type (e.g., 'order.created')
   * @param version - Schema version (e.g., 'v1', defaults to latest)
   * @returns Schema info or undefined if not found
   *
   * @example
   * ```typescript
   * const schema = registry.getSchemaByType('order.created', 'v1');
   * ```
   */
  public getSchemaByType(eventType: string, version?: string): SchemaInfo | undefined {
    const schemaId = version
      ? this.buildSchemaId(eventType, version)
      : this.findLatestSchema(eventType);

    return schemaId ? this.schemas.get(schemaId) : undefined;
  }

  /**
   * Validate an event envelope against its registered schema
   *
   * @param envelope - Event envelope to validate
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = await registry.validateEvent(envelope);
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   * }
   * ```
   */
  public async validateEvent<TPayload = any>(
    envelope: EventEnvelope<TPayload>
  ): Promise<ValidationResult> {
    // First validate the envelope structure
    const envelopeValidation = EventEnvelopeFactory.validate(envelope);
    if (!envelopeValidation.valid) {
      return envelopeValidation;
    }

    // Get the schema for this event
    const schemaId = this.buildSchemaId(envelope.event_type, envelope.event_version);
    let validator = this.validators.get(schemaId);

    // If validator is not cached, try to load the schema
    if (!validator) {
      const schemaInfo = this.schemas.get(schemaId);
      if (!schemaInfo) {
        return {
          valid: false,
          errors: [
            {
              path: 'schema',
              message: `No schema found for event type: ${envelope.event_type}, version: ${envelope.event_version}`,
            },
          ],
        };
      }

      // Load and compile the schema
      try {
        const content = await fs.readFile(schemaInfo.path, 'utf-8');
        const schema: SchemaObject = JSON.parse(content);
        validator = this.ajv.compile(schema);
        if (this.enableCache && validator) {
          this.validators.set(schemaId, validator);
        }
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              path: 'schema',
              message: `Failed to load schema: ${error}`,
            },
          ],
        };
      }
    }

    // Validate payload against schema
    if (!validator) {
      return {
        valid: false,
        errors: [
          {
            path: 'schema',
            message: `Validator missing for schema: ${schemaId}`,
          },
        ],
      };
    }

    const valid = validator(envelope.payload);
    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validator.errors || []).map((err) => ({
      path: (err as any).instancePath || (err as any).dataPath || 'payload',
      message: err.message || 'Validation error',
      expected: err.schema,
      actual: err.data,
    }));

    return { valid: false, errors };
  }

  /**
   * Validate raw JSON against a schema
   *
   * @param data - Data to validate
   * @param schemaId - Schema ID to validate against
   * @returns Validation result
   */
  public validateAgainstSchema(data: any, schemaId: string): ValidationResult {
    const schemaInfo = this.schemas.get(schemaId);
    if (!schemaInfo) {
      return {
        valid: false,
        errors: [
          {
            path: 'schema',
            message: `Schema not found: ${schemaId}`,
          },
        ],
      };
    }

    let validator = this.validators.get(schemaId);
    if (!validator) {
      return {
        valid: false,
        errors: [
          {
            path: 'schema',
            message: 'Schema validator not compiled. Call register() first.',
          },
        ],
      };
    }

    const valid = validator(data);
    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validator.errors || []).map((err) => ({
      path: (err as any).instancePath || (err as any).dataPath || 'root',
      message: err.message || 'Validation error',
      expected: err.schema,
      actual: err.data,
    }));

    return { valid: false, errors };
  }

  /**
   * List all registered schemas
   *
   * @param options - Filter options
   * @returns Array of schema info
   *
   * @example
   * ```typescript
   * // List all active schemas
   * const activeSchemas = registry.listSchemas({ active: true });
   *
   * // List schemas for a specific event type
   * const orderSchemas = registry.listSchemas({ eventType: 'order.created' });
   * ```
   */
  public listSchemas(options?: {
    active?: boolean;
    eventType?: string;
    version?: string;
  }): SchemaInfo[] {
    let schemas = Array.from(this.schemas.values());

    if (options?.active !== undefined) {
      schemas = schemas.filter((s) => s.active === options.active);
    }

    if (options?.eventType) {
      schemas = schemas.filter((s) => s.event_type === options.eventType);
    }

    if (options?.version) {
      schemas = schemas.filter((s) => s.version === options.version);
    }

    return schemas.sort((a, b) => a.event_type.localeCompare(b.event_type));
  }

  /**
   * Get all event types that have registered schemas
   *
   * @returns Array of unique event types
   */
  public getEventTypes(): string[] {
    const eventTypes = new Set<string>();
    this.schemas.forEach((schema) => {
      eventTypes.add(schema.event_type);
    });
    return Array.from(eventTypes).sort();
  }

  /**
   * Get all versions for a specific event type
   *
   * @param eventType - Event type to get versions for
   * @returns Array of version strings
   */
  public getVersions(eventType: string): string[] {
    const versions: string[] = [];
    this.schemas.forEach((schema) => {
      if (schema.event_type === eventType) {
        versions.push(schema.version);
      }
    });
    return versions.sort().reverse(); // Newest first
  }

  /**
   * Get the latest version for an event type
   *
   * @param eventType - Event type to get latest version for
   * @returns Latest version string or undefined
   */
  public getLatestVersion(eventType: string): string | undefined {
    const versions = this.getVersions(eventType);
    return versions[0];
  }

  /**
   * Load schema asynchronously (for $ref resolution)
   *
   * @param uri - Schema URI to load
   * @returns Promise resolving to schema object
   */
  private async loadSchemaAsync(uri: string): Promise<SchemaObject> {
    // Check if it's a local file reference
    if (uri.startsWith('file://')) {
      const filePath = uri.replace('file://', '');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }

    // Check if we have this schema registered
    const schemaInfo = this.schemas.get(uri);
    if (schemaInfo && schemaInfo.path.startsWith('/')) {
      const content = await fs.readFile(schemaInfo.path, 'utf-8');
      return JSON.parse(content);
    }

    throw new Error(`Cannot load schema from URI: ${uri}`);
  }

  /**
   * Scan schemas directory for new schema files
   */
  private async scanSchemas(): Promise<void> {
    try {
      await this.scanDirectory(this.schemasDir);
    } catch (error) {
      console.error('Error scanning schemas directory:', error);
    }
  }

  /**
   * Recursively scan a directory for schema files
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            // Skip registry.json
            if (entry.name === 'registry.json') {
              continue;
            }

            await this.registerFromFile(fullPath);
          } catch (error) {
            console.error(`Failed to register schema from ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        console.error(`Error scanning directory ${dirPath}:`, error);
      }
    }
  }

  /**
   * Load registry from JSON file
   */
  private async loadRegistry(): Promise<void> {
    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      const registry: RegistryJson = JSON.parse(content);

      for (const [id, schemaInfo] of Object.entries(registry.schemas)) {
        this.schemas.set(id, schemaInfo);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        console.error('Error loading registry file:', error);
      }
    }
  }

  /**
   * Save registry to JSON file
   */
  public async saveRegistry(): Promise<void> {
    const registry: RegistryJson = {
      version: '1.0.0',
      schemas: Object.fromEntries(this.schemas),
      last_updated: new Date().toISOString(),
    };

    await fs.writeFile(this.registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  }

  /**
   * Extract event type from schema ID
   */
  private extractEventType(schemaId: string): string {
    // Format: https://schemas.cypher.ro/events/{domain}/{event}-v1.json
    const match = schemaId.match(/events\/([^\/]+)\/[^-]+-v(\d+)\.json$/);
    if (match) {
      const domain = match[1];
      const version = `v${match[2]}`;
      // Infer event type from filename
      const eventMatch = schemaId.match(/\/([a-z]+)-v\d+\.json$/);
      if (eventMatch) {
        return `${domain}.${eventMatch[1]}`;
      }
    }
    return schemaId;
  }

  /**
   * Extract version from schema ID
   */
  private extractVersion(schemaId: string): string {
    const match = schemaId.match(/-v(\d+)\.json$/);
    return match ? `v${match[1]}` : 'v1';
  }

  /**
   * Build schema ID from event type and version
   */
  private buildSchemaId(eventType: string, version: string): string {
    const [domain, action] = eventType.split('.');
    const versionNum = version.replace('v', '');
    return `https://schemas.cypher.ro/events/${domain}/${action}-v${versionNum}.json`;
  }

  /**
   * Find the latest schema for an event type
   */
  private findLatestSchema(eventType: string): string | undefined {
    let latestId: string | undefined;
    let latestVersion = -1;

    this.schemas.forEach((schema, id) => {
      if (schema.event_type === eventType) {
        const versionNum = parseInt(schema.version.replace('v', ''), 10);
        if (versionNum > latestVersion) {
          latestVersion = versionNum;
          latestId = id;
        }
      }
    });

    return latestId;
  }

  /**
   * Clear all registered schemas
   */
  public clear(): void {
    this.schemas.clear();
    this.validators.clear();
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    totalSchemas: number;
    totalEventTypes: number;
    eventTypes: string[];
    schemaCounts: Record<string, number>;
  } {
    const eventTypes = this.getEventTypes();
    const schemaCounts: Record<string, number> = {};

    this.schemas.forEach((schema) => {
      const key = `${schema.event_type}:${schema.version}`;
      schemaCounts[key] = (schemaCounts[key] || 0) + 1;
    });

    return {
      totalSchemas: this.schemas.size,
      totalEventTypes: eventTypes.length,
      eventTypes,
      schemaCounts,
    };
  }

  /**
   * Export all schemas as JSON
   */
  public exportSchemas(): Record<string, SchemaObject> {
    const schemas: Record<string, SchemaObject> = {};
    this.schemas.forEach((schemaInfo, id) => {
      schemas[id] = {
        $id: schemaInfo.$id,
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: schemaInfo.title,
        description: schemaInfo.description,
        // Note: Full schema content would need to be loaded from files
      } as SchemaObject;
    });
    return schemas;
  }
}

/**
 * Create a new SchemaRegistry instance (non-singleton)
 *
 * @param options - Configuration options
 * @returns New SchemaRegistry instance
 */
export function createSchemaRegistry(options?: SchemaRegistryOptions): SchemaRegistry {
  return SchemaRegistry.getInstance(options);
}

/**
 * Get the default SchemaRegistry singleton instance
 *
 * @param options - Configuration options (only used on first call)
 * @returns SchemaRegistry instance
 */
export function getSchemaRegistry(options?: SchemaRegistryOptions): SchemaRegistry {
  return SchemaRegistry.getInstance(options);
}

// Export types
export type { ErrorObject } from 'ajv';
