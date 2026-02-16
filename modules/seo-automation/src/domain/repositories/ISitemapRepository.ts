/**
 * ISitemapRepository Interface
 *
 * Repository port for Sitemap persistence.
 * Abstracts database access for Sitemap entities.
 *
 * @interface ISitemapRepository
 */

import { Sitemap, SitemapType } from '../entities/Sitemap';
import { PaginatedResult, PaginationParams } from './ISeoMetadataRepository';

/**
 * ISitemapRepository - Repository Port
 *
 * Handles persistence and retrieval of sitemaps.
 */
export interface ISitemapRepository {
  /**
   * Save sitemap to database
   *
   * Creates new or updates existing sitemap.
   *
   * @param sitemap - Sitemap entity to save
   * @returns Saved sitemap
   * @throws {Error} If save fails
   */
  save(sitemap: Sitemap): Promise<Sitemap>;

  /**
   * Find sitemap by type
   *
   * Each sitemap type (PRODUCTS, CATEGORIES, etc.) should have one current version.
   *
   * @param type - Sitemap type
   * @returns Sitemap or null if not found
   * @throws {Error} If query fails
   */
  findByType(type: SitemapType): Promise<Sitemap | null>;

  /**
   * Find all sitemaps
   *
   * @param pagination - Pagination parameters
   * @returns Paginated sitemap results
   * @throws {Error} If query fails
   */
  findAll(pagination: PaginationParams): Promise<PaginatedResult<Sitemap>>;

  /**
   * Get the most recently generated sitemap of each type
   *
   * Useful for checking if sitemaps need regeneration.
   *
   * @returns Map of sitemap type to most recent sitemap
   * @throws {Error} If query fails
   */
  getLastGenerated(): Promise<Map<SitemapType, Sitemap>>;

  /**
   * Delete a sitemap by ID
   *
   * @param id - ID of sitemap to delete
   * @returns True if deleted, false if not found
   * @throws {Error} If delete fails
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find sitemap by ID
   *
   * @param id - ID to search for
   * @returns Sitemap or null
   * @throws {Error} If query fails
   */
  findById(id: string): Promise<Sitemap | null>;

  /**
   * Get count of sitemaps
   *
   * @param type - Filter by type (optional)
   * @returns Total count
   * @throws {Error} If query fails
   */
  count(type?: SitemapType): Promise<number>;
}
