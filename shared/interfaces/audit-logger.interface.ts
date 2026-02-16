/**
 * Audit Logger Interface
 * Defines the contract for audit trail logging implementations
 */

/**
 * Changes tracked in audit events
 * Represents before/after state of a modified resource
 */
export interface AuditChanges {
  /** Previous state of the resource */
  before?: Record<string, unknown>;
  /** New state of the resource */
  after?: Record<string, unknown>;
}

/**
 * Audit Event
 * Represents a single audit trail entry
 */
export interface AuditEvent {
  /** Unique identifier for the audit entry */
  id: string;
  /** Timestamp of when the event occurred */
  timestamp: Date;
  /** Correlation ID for tracking related requests */
  requestId: string;
  /** ID of the user performing the action */
  userId?: number;
  /** High-level action performed (CREATE, READ, UPDATE, DELETE) */
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  /** Type of resource being acted upon (e.g., 'Order', 'Product') */
  resource: string;
  /** Unique identifier of the resource being acted upon */
  resourceId: string | number;
  /** Before/after state changes */
  changes: AuditChanges;
  /** Client IP address */
  ip: string;
  /** Client user agent */
  userAgent: string;
}

/**
 * Audit Logger Interface
 * Defines operations for recording audit events
 */
export interface IAuditLogger {
  /**
   * Log an audit event
   *
   * @param event - The audit event to log
   * @returns Promise that resolves when audit event is persisted
   */
  logEvent(event: AuditEvent): Promise<void>;

  /**
   * Query audit events with optional filtering
   *
   * @param filters - Optional filters for querying audit trail
   * @returns Promise resolving to array of matching audit events
   */
  queryEvents?(filters: Partial<AuditEvent>): Promise<AuditEvent[]>;

  /**
   * Delete old audit events beyond retention period
   *
   * @param retentionDays - Number of days to retain
   * @returns Promise resolving to number of deleted entries
   */
  purgeOldEvents?(retentionDays: number): Promise<number>;
}
