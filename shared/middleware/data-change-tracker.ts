/**
 * Data Change Tracker - Entity modification tracking
 * Captures before/after values for audited entities
 * Can be used as TypeORM subscriber or manual call from use-cases
 *
 * @module shared/middleware/data-change-tracker
 */

import { createModuleLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createModuleLogger('data-change-tracker');

/**
 * Field change record
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
}

/**
 * Entity change record for audit trail
 */
export interface EntityChangeRecord {
  id: string;
  entityType: string;
  entityId: string | number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes: FieldChange[];
  changedBy: number | string; // User ID
  changedAt: Date;
  changesSummary: Record<string, { oldValue: unknown; newValue: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Options for tracking changes
 */
export interface TrackingOptions {
  excludeFields?: string[]; // Fields to ignore in tracking
  includeFields?: string[]; // If set, only track these fields
  ignoreNullChanges?: boolean; // Ignore changes from/to null
  hashSensitiveFields?: boolean; // Hash sensitive field values
  sensitiveFieldPatterns?: RegExp[]; // Patterns to identify sensitive fields
  metadata?: Record<string, unknown>;
}

/**
 * Default sensitive field patterns
 */
const DEFAULT_SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
  /creditcard/i,
  /credit_card/i,
  /ssn/i,
  /social.?security/i,
  /pin/i,
];

/**
 * Data Change Tracker
 * Tracks modifications to entities for audit trail
 */
export class DataChangeTracker {
  private options: TrackingOptions;

  constructor(options: TrackingOptions = {}) {
    this.options = {
      excludeFields: options.excludeFields || ['password', 'token', 'secret'],
      ignoreNullChanges: options.ignoreNullChanges ?? false,
      hashSensitiveFields: options.hashSensitiveFields ?? true,
      sensitiveFieldPatterns: [
        ...(options.sensitiveFieldPatterns || []),
        ...DEFAULT_SENSITIVE_PATTERNS,
      ],
      ...options,
    };
  }

  /**
   * Track entity creation
   */
  trackCreate(
    entityType: string,
    entityId: string | number,
    newData: Record<string, unknown>,
    changedBy: number | string,
    metadata?: Record<string, unknown>
  ): EntityChangeRecord {
    const changes = this.captureChanges(newData, {}, 'CREATE');

    const record: EntityChangeRecord = {
      id: uuidv4(),
      entityType,
      entityId,
      action: 'CREATE',
      changes,
      changedBy,
      changedAt: new Date(),
      changesSummary: this.buildChangesSummary(changes),
      metadata,
    };

    logger.debug('Entity change tracked (CREATE)', {
      entityType,
      entityId,
      fieldCount: changes.length,
    });

    return record;
  }

  /**
   * Track entity update
   */
  trackUpdate(
    entityType: string,
    entityId: string | number,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    changedBy: number | string,
    metadata?: Record<string, unknown>
  ): EntityChangeRecord {
    const changes = this.captureChanges(newData, oldData, 'UPDATE');

    // Filter to only actual changes
    const actualChanges = changes.filter(c => c.changed);

    const record: EntityChangeRecord = {
      id: uuidv4(),
      entityType,
      entityId,
      action: 'UPDATE',
      changes: actualChanges,
      changedBy,
      changedAt: new Date(),
      changesSummary: this.buildChangesSummary(actualChanges),
      metadata,
    };

    logger.debug('Entity change tracked (UPDATE)', {
      entityType,
      entityId,
      changedFields: actualChanges.length,
    });

    return record;
  }

  /**
   * Track entity deletion
   */
  trackDelete(
    entityType: string,
    entityId: string | number,
    oldData: Record<string, unknown>,
    changedBy: number | string,
    metadata?: Record<string, unknown>
  ): EntityChangeRecord {
    const changes = this.captureChanges({}, oldData, 'DELETE');

    const record: EntityChangeRecord = {
      id: uuidv4(),
      entityType,
      entityId,
      action: 'DELETE',
      changes,
      changedBy,
      changedAt: new Date(),
      changesSummary: this.buildChangesSummary(changes),
      metadata,
    };

    logger.debug('Entity change tracked (DELETE)', {
      entityType,
      entityId,
      fieldCount: changes.length,
    });

    return record;
  }

  /**
   * Capture field changes between old and new data
   */
  private captureChanges(
    newData: Record<string, unknown>,
    oldData: Record<string, unknown>,
    action: 'CREATE' | 'UPDATE' | 'DELETE'
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const allFields = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    for (const field of allFields) {
      // Skip excluded fields
      if (this.shouldExcludeField(field)) {
        continue;
      }

      const oldValue = oldData?.[field];
      const newValue = newData?.[field];

      // Check if field should be ignored
      if (this.options.ignoreNullChanges && oldValue === null && newValue === null) {
        continue;
      }

      const changed = oldValue !== newValue;

      changes.push({
        field,
        oldValue: this.sanitizeValue(oldValue, field),
        newValue: this.sanitizeValue(newValue, field),
        changed,
      });
    }

    return changes;
  }

  /**
   * Check if field should be excluded from tracking
   */
  private shouldExcludeField(field: string): boolean {
    if (this.options.includeFields && !this.options.includeFields.includes(field)) {
      return true;
    }

    if (this.options.excludeFields?.includes(field)) {
      return true;
    }

    // Exclude common system fields
    if (
      field.startsWith('_') ||
      field.startsWith('$') ||
      ['createdAt', 'updatedAt', 'deletedAt', 'version'].includes(field)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize value for audit trail (hash sensitive data)
   */
  private sanitizeValue(value: unknown, field: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Hash sensitive fields if enabled
    if (this.options.hashSensitiveFields && this.isSensitiveField(field)) {
      return `[REDACTED: ${typeof value}]`;
    }

    // Avoid storing large objects
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      if (str.length > 500) {
        return `[TRUNCATED: ${typeof value} - ${str.length} chars]`;
      }
    }

    return value;
  }

  /**
   * Check if field is sensitive
   */
  private isSensitiveField(field: string): boolean {
    return this.options.sensitiveFieldPatterns!.some(pattern => pattern.test(field));
  }

  /**
   * Build summary of changes
   */
  private buildChangesSummary(changes: FieldChange[]): Record<string, { oldValue: unknown; newValue: unknown }> {
    const summary: Record<string, { oldValue: unknown; newValue: unknown }> = {};

    for (const change of changes) {
      summary[change.field] = {
        oldValue: change.oldValue,
        newValue: change.newValue,
      };
    }

    return summary;
  }

  /**
   * Compare two objects and return detailed diff
   */
  static diff(oldData: Record<string, unknown>, newData: Record<string, unknown>): FieldChange[] {
    const tracker = new DataChangeTracker();
    return tracker.captureChanges(newData, oldData, 'UPDATE');
  }

  /**
   * Get change description for human-readable audit logs
   */
  static describeChanges(changes: FieldChange[]): string[] {
    const descriptions: string[] = [];

    for (const change of changes) {
      if (change.changed) {
        descriptions.push(`${change.field}: "${change.oldValue}" → "${change.newValue}"`);
      }
    }

    return descriptions;
  }
}

/**
 * TypeORM Subscriber for automatic change tracking
 * Use this with TypeORM's @EventSubscriber decorator
 */
export class EntityChangeSubscriber {
  private tracker = new DataChangeTracker();

  /**
   * Track create events
   */
  afterInsert?(event: any): void {
    const entity = event.entity;
    if (!entity) return;

    const record = this.tracker.trackCreate(
      entity.constructor.name,
      entity.id,
      entity,
      (global as any).currentUserId || 'system'
    );

    // Store to audit log (implementation depends on your DB)
    this.persistChangeRecord(record);
  }

  /**
   * Track update events
   */
  afterUpdate?(event: any): void {
    const entity = event.entity;
    const databaseEntity = event.databaseEntity;

    if (!entity || !databaseEntity) return;

    const record = this.tracker.trackUpdate(
      entity.constructor.name,
      entity.id,
      databaseEntity,
      entity,
      (global as any).currentUserId || 'system'
    );

    // Only persist if there are actual changes
    if (record.changes.length > 0) {
      this.persistChangeRecord(record);
    }
  }

  /**
   * Track delete events
   */
  afterRemove?(event: any): void {
    const entity = event.entity;
    if (!entity) return;

    const record = this.tracker.trackDelete(
      entity.constructor.name,
      entity.id,
      entity,
      (global as any).currentUserId || 'system'
    );

    this.persistChangeRecord(record);
  }

  /**
   * Persist change record (override in subclass)
   */
  protected persistChangeRecord(record: EntityChangeRecord): void {
    logger.info('Change recorded', {
      entityType: record.entityType,
      action: record.action,
      changedFields: record.changes.length,
    });
  }
}

/**
 * Singleton instance helper
 */
let trackerInstance: DataChangeTracker | null = null;

/**
 * Get or create global data change tracker
 */
export function getDataChangeTracker(options?: TrackingOptions): DataChangeTracker {
  if (!trackerInstance) {
    trackerInstance = new DataChangeTracker(options);
  }
  return trackerInstance;
}

export default DataChangeTracker;
