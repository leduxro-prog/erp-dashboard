/**
 * Campaign Repository Interface
 * Port for campaign data persistence
 *
 * @module Domain/Repositories
 */

import { Campaign } from '../entities/Campaign';
import { CampaignMetrics } from '../entities/Campaign';

/**
 * Filter options for campaign queries
 */
export interface CampaignFilter {
  /** Campaign type */
  type?: string;
  /** Campaign status */
  status?: string;
  /** Search by name */
  search?: string;
  /** Created by user ID */
  createdBy?: string;
  /** Campaigns active after this date */
  activeAfter?: Date;
  /** Campaigns active before this date */
  activeBefore?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Items in this page */
  items: T[];
  /** Total items matching filter */
  total: number;
  /** Current page */
  page: number;
  /** Total pages */
  pages: number;
}

/**
 * ICampaignRepository
 * Port interface for campaign persistence operations
 */
export interface ICampaignRepository {
  /**
   * Save a campaign (create or update)
   * @param campaign - Campaign entity to save
   * @returns Saved campaign
   */
  save(campaign: Campaign): Promise<Campaign>;

  /**
   * Find campaign by ID
   * @param id - Campaign ID
   * @returns Campaign or null if not found
   */
  findById(id: string): Promise<Campaign | null>;

  /**
   * Find all campaigns with filtering and pagination
   * @param filter - Filter criteria
   * @param pagination - Pagination options
   * @returns Paginated campaigns
   */
  findAll(filter: CampaignFilter, pagination: PaginationOptions): Promise<PaginatedResult<Campaign>>;

  /**
   * Find all active campaigns
   * @returns Active campaigns
   */
  findActive(): Promise<Campaign[]>;

  /**
   * Find campaigns by type
   * @param type - Campaign type
   * @returns Campaigns of specified type
   */
  findByType(type: string): Promise<Campaign[]>;

  /**
   * Update campaign metrics
   * @param campaignId - Campaign ID
   * @param metrics - Metrics to add
   * @returns Updated campaign
   */
  updateMetrics(campaignId: string, metrics: Partial<CampaignMetrics>): Promise<Campaign>;

  /**
   * Delete a campaign
   * @param id - Campaign ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count campaigns matching filter
   * @param filter - Filter criteria
   * @returns Count of matching campaigns
   */
  count(filter: CampaignFilter): Promise<number>;

  /**
   * Find campaigns expiring soon
   * @param daysUntilExpiry - Days until expiry threshold
   * @returns Campaigns expiring within threshold
   */
  findExpiringCampaigns(daysUntilExpiry: number): Promise<Campaign[]>;
}
