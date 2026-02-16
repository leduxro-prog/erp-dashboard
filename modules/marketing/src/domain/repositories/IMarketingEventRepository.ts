/**
 * MarketingEvent Repository Interface
 * Port for marketing event data persistence and analytics
 *
 * @module Domain/Repositories
 */

import { MarketingEvent } from '../entities/MarketingEvent';

/**
 * Marketing event aggregation by type
 */
export interface EventTypeAggregate {
  /** Event type */
  type: string;
  /** Count of events */
  count: number;
}

/**
 * Time-series aggregation data point
 */
export interface TimeSeriesDataPoint {
  /** Date of data point */
  date: Date;
  /** Count of events */
  count: number;
  /** Revenue from conversions (if applicable) */
  revenue?: number;
}

/**
 * IMarketingEventRepository
 * Port interface for marketing event persistence and analytics operations
 */
export interface IMarketingEventRepository {
  /**
   * Save a marketing event
   * @param event - Marketing event to save
   * @returns Saved event
   */
  save(event: MarketingEvent): Promise<MarketingEvent>;

  /**
   * Find events for a campaign with pagination
   * @param campaignId - Campaign ID
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated events
   */
  findByCampaign(
    campaignId: string,
    page: number,
    limit: number
  ): Promise<{ items: MarketingEvent[]; total: number; page: number; pages: number }>;

  /**
   * Find events for a customer
   * @param customerId - Customer ID
   * @returns Events for customer
   */
  findByCustomer(customerId: string): Promise<MarketingEvent[]>;

  /**
   * Find events for an email sequence
   * @param sequenceId - Email sequence ID
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated events
   */
  findBySequence(
    sequenceId: string,
    page: number,
    limit: number
  ): Promise<{ items: MarketingEvent[]; total: number; page: number; pages: number }>;

  /**
   * Count events by type for a campaign
   * @param campaignId - Campaign ID
   * @returns Array of event type counts
   */
  countByType(campaignId: string): Promise<EventTypeAggregate[]>;

  /**
   * Get time-series data for a campaign
   * Aggregates events by date for analytics
   *
   * @param campaignId - Campaign ID
   * @param startDate - Start date
   * @param endDate - End date
   * @param groupBy - Group by: 'day' | 'hour' | 'week'
   * @returns Time-series data points
   */
  getTimeSeriesData(
    campaignId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'hour' | 'week'
  ): Promise<TimeSeriesDataPoint[]>;

  /**
   * Get conversion events for campaign
   * @param campaignId - Campaign ID
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated conversion events
   */
  findConversions(
    campaignId: string,
    page: number,
    limit: number
  ): Promise<{ items: MarketingEvent[]; total: number; page: number; pages: number }>;

  /**
   * Get total revenue from conversions for campaign
   * @param campaignId - Campaign ID
   * @returns Total revenue
   */
  getTotalRevenue(campaignId: string): Promise<number>;

  /**
   * Find events by type
   * @param type - Event type (SENT, OPENED, CLICKED, etc.)
   * @returns Events of specified type
   */
  findByType(type: string): Promise<MarketingEvent[]>;

  /**
   * Delete old events (for cleanup)
   * @param olderThanDays - Delete events older than this many days
   * @returns Count of deleted events
   */
  deleteOlderThan(olderThanDays: number): Promise<number>;

  /**
   * Count total events for campaign
   * @param campaignId - Campaign ID
   * @returns Total event count
   */
  count(campaignId: string): Promise<number>;
}
