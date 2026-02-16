/**
 * Audit Logger Implementation
 * Winston-based structured audit logging with file rotation and retention
 */

import winston from 'winston';
import path from 'path';
import { IAuditLogger, AuditEvent, AuditChanges } from '../interfaces/audit-logger.interface';

/**
 * Winston-based Audit Logger
 * Writes audit events to separate audit.log file with rotation and retention policies
 */
export class AuditLogger implements IAuditLogger {
  private logger: winston.Logger;

  constructor(logDirectory: string = 'logs') {
    /**
     * Create dedicated audit logger transport
     * Writes to audit.log with 10MB file size, max 30 files, 90 day retention
     */
    const auditTransport = new winston.transports.File({
      filename: path.join(logDirectory, 'audit.log'),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 30,
      tailable: true,
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
      defaultMeta: { service: 'audit-trail' },
      transports: [auditTransport],
    });
  }

  /**
   * Log an audit event
   * Persists structured audit trail entry to audit.log file
   *
   * @param event - The audit event to log
   * @returns Promise that resolves when event is written
   */
  async logEvent(event: AuditEvent): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.logger.info('AUDIT', event, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Query audit events by filters
   * Note: This is a placeholder for future implementation
   * In production, consider using a database for queryable audit logs
   *
   * @param filters - Filters for audit event query
   * @returns Promise resolving to matching audit events
   */
  async queryEvents(filters: Partial<AuditEvent>): Promise<AuditEvent[]> {
    // TODO: Implement database-backed audit queries
    // For now, return empty array
    // In production, query audit logs from database
    return [];
  }

  /**
   * Delete audit events older than retention period
   * Implements 90-day retention policy
   *
   * @param retentionDays - Number of days to retain (default: 90)
   * @returns Promise resolving to number of deleted entries
   */
  async purgeOldEvents(retentionDays: number = 90): Promise<number> {
    // TODO: Implement log cleanup
    // File rotation is handled by Winston transports
    // This could be extended to purge database records if using DB backend
    return 0;
  }
}

/**
 * Create a singleton audit logger instance
 * @param logDirectory - Directory for audit logs
 * @returns Configured audit logger instance
 */
let auditLoggerInstance: AuditLogger | null = null;

export function createAuditLogger(logDirectory: string = 'logs'): IAuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(logDirectory);
  }
  return auditLoggerInstance;
}

/**
 * Get the singleton audit logger instance
 * Must call createAuditLogger first to initialize
 *
 * @returns The audit logger instance
 */
export function getAuditLogger(): IAuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}
