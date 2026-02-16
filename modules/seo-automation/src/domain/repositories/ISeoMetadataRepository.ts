/**
 * ISeoMetadataRepository Interface
 *
 * Repository port for SEO metadata persistence.
 * Abstracts database access for SeoMetadata entities.
 *
 * All methods are async to support various storage backends
 * (SQL, NoSQL, file-based, etc.)
 *
 * @interface ISeoMetadataRepository
 */

import { SeoMetadata, SeoLocale, MetadataEntityType } from '../entities/SeoMetadata';

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * ISeoMetadataRepository - Repository Port
 *
 * Handles persistence and retrieval of SEO metadata.
 */
export interface ISeoMetadataRepository {
  /**
   * Save metadata to database
   *
   * Creates new or updates existing metadata based on id presence.
   *
   * @param metadata - SeoMetadata entity to save
   * @returns Saved metadata with updated timestamps
   * @throws {Error} If save fails
   */
  save(metadata: SeoMetadata): Promise<SeoMetadata>;

  /**
   * Find metadata by entity
   *
   * @param entityType - Type of entity (PRODUCT, CATEGORY, PAGE)
   * @param entityId - ID of the entity
   * @param locale - Locale code (default: 'ro')
   * @returns SeoMetadata or null if not found
   * @throws {Error} If query fails
   */
  findByEntity(
    entityType: MetadataEntityType,
    entityId: string,
    locale?: SeoLocale
  ): Promise<SeoMetadata | null>;

  /**
   * Find all metadata for a specific locale
   *
   * @param locale - Locale code
   * @param pagination - Pagination parameters
   * @returns Paginated metadata results
   * @throws {Error} If query fails
   */
  findByLocale(locale: SeoLocale, pagination: PaginationParams): Promise<PaginatedResult<SeoMetadata>>;

  /**
   * Find metadata missing required fields
   *
   * Returns metadata with empty metaTitle, metaDescription, or slug.
   *
   * @param pagination - Pagination parameters
   * @returns Paginated results of incomplete metadata
   * @throws {Error} If query fails
   */
  findMissingMeta(pagination: PaginationParams): Promise<PaginatedResult<SeoMetadata>>;

  /**
   * Find metadata with low SEO scores
   *
   * Returns metadata with score below threshold.
   *
   * @param threshold - Score threshold (0-100)
   * @param pagination - Pagination parameters
   * @returns Paginated results of low-score metadata
   * @throws {Error} If query fails
   */
  findLowScore(threshold: number, pagination: PaginationParams): Promise<PaginatedResult<SeoMetadata>>;

  /**
   * Search metadata by keyword
   *
   * Searches in title, description, and slug fields.
   *
   * @param keyword - Search term
   * @param entityType - Filter by entity type (optional)
   * @param locale - Filter by locale (optional)
   * @returns Array of matching metadata
   * @throws {Error} If search fails
   */
  search(
    keyword: string,
    entityType?: MetadataEntityType,
    locale?: SeoLocale
  ): Promise<SeoMetadata[]>;

  /**
   * Save multiple metadata records
   *
   * Batch operation for efficiency.
   *
   * @param metadataList - Array of SeoMetadata entities
   * @returns Array of saved metadata
   * @throws {Error} If batch save fails (may be partial)
   */
  bulkSave(metadataList: SeoMetadata[]): Promise<SeoMetadata[]>;

  /**
   * Find all metadata for an entity type
   *
   * @param entityType - Type of entity
   * @param pagination - Pagination parameters
   * @returns Paginated results
   * @throws {Error} If query fails
   */
  findByEntityType(
    entityType: MetadataEntityType,
    pagination: PaginationParams
  ): Promise<PaginatedResult<SeoMetadata>>;

  /**
   * Delete metadata
   *
   * @param id - ID of metadata to delete
   * @returns True if deleted, false if not found
   * @throws {Error} If delete fails
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if metadata exists for entity
   *
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   * @param locale - Locale code
   * @returns True if metadata exists
   * @throws {Error} If query fails
   */
  exists(
    entityType: MetadataEntityType,
    entityId: string,
    locale: SeoLocale
  ): Promise<boolean>;

  /**
   * Get count of metadata records
   *
   * @param entityType - Filter by entity type (optional)
   * @returns Total count
   * @throws {Error} If query fails
   */
  count(entityType?: MetadataEntityType): Promise<number>;
}
