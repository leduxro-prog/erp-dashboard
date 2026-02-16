/**
 * IStructuredDataRepository Interface
 *
 * Repository port for StructuredData persistence.
 * Abstracts database access for structured data (JSON-LD) entities.
 *
 * @interface IStructuredDataRepository
 */

import { StructuredData, SchemaType } from '../entities/StructuredData';
import { SeoEntityType } from '../entities/SeoIssue';
import { PaginatedResult, PaginationParams } from './ISeoMetadataRepository';

/**
 * IStructuredDataRepository - Repository Port
 *
 * Handles persistence and retrieval of structured data.
 */
export interface IStructuredDataRepository {
  /**
   * Save structured data to database
   *
   * Creates new or updates existing record.
   *
   * @param structuredData - StructuredData entity to save
   * @returns Saved structured data
   * @throws {Error} If save fails
   */
  save(structuredData: StructuredData): Promise<StructuredData>;

  /**
   * Find structured data by entity
   *
   * Each entity (product, category, page) can have multiple structured data records
   * for different schema types.
   *
   * @param entityType - Type of entity (PRODUCT, CATEGORY, PAGE)
   * @param entityId - ID of the entity
   * @returns Array of structured data records
   * @throws {Error} If query fails
   */
  findByEntity(entityType: SeoEntityType, entityId: string): Promise<StructuredData[]>;

  /**
   * Find invalid structured data
   *
   * Returns records that failed validation (isValid = false).
   *
   * @param pagination - Pagination parameters
   * @returns Paginated results of invalid records
   * @throws {Error} If query fails
   */
  findInvalid(pagination: PaginationParams): Promise<PaginatedResult<StructuredData>>;

  /**
   * Find structured data by schema type
   *
   * @param schemaType - Schema type to search for
   * @param pagination - Pagination parameters
   * @returns Paginated results
   * @throws {Error} If query fails
   */
  findBySchemaType(schemaType: SchemaType, pagination: PaginationParams): Promise<PaginatedResult<StructuredData>>;

  /**
   * Save multiple structured data records
   *
   * Batch operation for efficiency.
   *
   * @param recordList - Array of StructuredData entities
   * @returns Array of saved records
   * @throws {Error} If batch save fails (may be partial)
   */
  bulkSave(recordList: StructuredData[]): Promise<StructuredData[]>;

  /**
   * Delete structured data by entity
   *
   * Removes all structured data for a specific entity.
   *
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   * @returns Number of records deleted
   * @throws {Error} If delete fails
   */
  deleteByEntity(entityType: SeoEntityType, entityId: string): Promise<number>;

  /**
   * Delete structured data by ID
   *
   * @param id - ID of record to delete
   * @returns True if deleted, false if not found
   * @throws {Error} If delete fails
   */
  deleteById(id: string): Promise<boolean>;

  /**
   * Find by ID
   *
   * @param id - ID to search for
   * @returns StructuredData or null
   * @throws {Error} If query fails
   */
  findById(id: string): Promise<StructuredData | null>;

  /**
   * Get count of structured data records
   *
   * @param entityType - Filter by entity type (optional)
   * @param schemaType - Filter by schema type (optional)
   * @returns Total count
   * @throws {Error} If query fails
   */
  count(entityType?: SeoEntityType, schemaType?: SchemaType): Promise<number>;
}
