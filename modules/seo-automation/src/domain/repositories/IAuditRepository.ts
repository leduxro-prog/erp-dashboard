/**
 * IAuditRepository Interface
 *
 * Repository port for SEO audit result persistence.
 * Abstracts database access for SeoAuditResult entities.
 *
 * @interface IAuditRepository
 */

import { SeoAuditResult, AuditType } from '../entities/SeoAuditResult';
import { SeoEntityType } from '../entities/SeoIssue';
import { PaginatedResult, PaginationParams } from './ISeoMetadataRepository';

/**
 * IAuditRepository - Repository Port
 *
 * Handles persistence and retrieval of audit results.
 */
export interface IAuditRepository {
  /**
   * Save audit result to database
   *
   * @param auditResult - SeoAuditResult entity to save
   * @returns Saved audit result
   * @throws {Error} If save fails
   */
  save(auditResult: SeoAuditResult): Promise<SeoAuditResult>;

  /**
   * Find audit result by ID
   *
   * @param id - ID of audit result
   * @returns SeoAuditResult or null if not found
   * @throws {Error} If query fails
   */
  findById(id: string): Promise<SeoAuditResult | null>;

  /**
   * Find latest audit results
   *
   * Optionally filtered by entity type and/or entity ID.
   *
   * @param entityType - Filter by entity type (optional)
   * @param entityId - Filter by entity ID (optional, requires entityType)
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of most recent audit results
   * @throws {Error} If query fails
   */
  findLatest(
    entityType?: SeoEntityType,
    entityId?: string,
    limit?: number
  ): Promise<SeoAuditResult[]>;

  /**
   * Find all audit results
   *
   * Supports filtering by audit type.
   *
   * @param pagination - Pagination parameters
   * @param auditType - Filter by audit type (optional)
   * @returns Paginated audit results
   * @throws {Error} If query fails
   */
  findAll(pagination: PaginationParams, auditType?: AuditType): Promise<PaginatedResult<SeoAuditResult>>;

  /**
   * Get average SEO score across all audits
   *
   * @param entityType - Filter by entity type (optional)
   * @returns Average score (0-100)
   * @throws {Error} If query fails
   */
  getAverageScore(entityType?: SeoEntityType): Promise<number>;

  /**
   * Find audit results by entity
   *
   * Returns all audits for a specific entity, newest first.
   *
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of audit results
   * @throws {Error} If query fails
   */
  findByEntity(
    entityType: SeoEntityType,
    entityId: string,
    limit?: number
  ): Promise<SeoAuditResult[]>;

  /**
   * Get count of audit results
   *
   * @param entityType - Filter by entity type (optional)
   * @param auditType - Filter by audit type (optional)
   * @returns Total count
   * @throws {Error} If query fails
   */
  count(entityType?: SeoEntityType, auditType?: AuditType): Promise<number>;

  /**
   * Delete audit result by ID
   *
   * @param id - ID of audit result to delete
   * @returns True if deleted, false if not found
   * @throws {Error} If delete fails
   */
  delete(id: string): Promise<boolean>;
}
