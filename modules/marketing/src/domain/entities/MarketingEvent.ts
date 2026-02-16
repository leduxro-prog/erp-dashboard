/**
 * MarketingEvent Domain Entity
 * Represents a marketing activity event (sent, opened, clicked, converted, etc.)
 * Used for analytics and metrics aggregation.
 *
 * @module Domain/Entities
 */

/**
 * Marketing event type
 */
export type MarketingEventType =
  | 'SENT'
  | 'OPENED'
  | 'CLICKED'
  | 'CONVERTED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED';

/**
 * MarketingEvent Domain Entity (Value Object)
 *
 * Represents atomic marketing events for:
 * - Email sent/opened/clicked tracking
 * - Conversion tracking
 * - Analytics and metrics aggregation
 *
 * Designed as a value object for immutability and aggregation.
 *
 * @class MarketingEvent
 */
export class MarketingEvent {
  /**
   * Create a new MarketingEvent
   *
   * @param id - Unique event identifier
   * @param type - Event type (SENT, OPENED, CLICKED, etc.)
   * @param campaignId - Associated campaign ID
   * @param customerId - Customer who performed the action
   * @param discountCodeId - Associated discount code (if applicable)
   * @param emailSequenceId - Associated email sequence (if applicable)
   * @param metadata - Additional event metadata
   * @param timestamp - When event occurred
   */
  constructor(
    readonly id: string,
    readonly type: MarketingEventType,
    readonly campaignId: string,
    readonly customerId: string,
    readonly discountCodeId: string | null,
    readonly emailSequenceId: string | null,
    readonly metadata: Record<string, unknown>,
    readonly timestamp: Date
  ) {}

  /**
   * Create a "SENT" event
   * @param campaignId - Campaign ID
   * @param customerId - Customer ID
   * @param emailSequenceId - Email sequence ID (if applicable)
   * @returns New MarketingEvent
   */
  static createSent(
    campaignId: string,
    customerId: string,
    emailSequenceId: string | null = null
  ): MarketingEvent {
    return new MarketingEvent(
      `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'SENT',
      campaignId,
      customerId,
      null,
      emailSequenceId,
      {},
      new Date()
    );
  }

  /**
   * Create an "OPENED" event
   * @param campaignId - Campaign ID
   * @param customerId - Customer ID
   * @param emailSequenceId - Email sequence ID (if applicable)
   * @param metadata - Additional metadata (e.g., device info)
   * @returns New MarketingEvent
   */
  static createOpened(
    campaignId: string,
    customerId: string,
    emailSequenceId: string | null = null,
    metadata: Record<string, unknown> = {}
  ): MarketingEvent {
    return new MarketingEvent(
      `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'OPENED',
      campaignId,
      customerId,
      null,
      emailSequenceId,
      metadata,
      new Date()
    );
  }

  /**
   * Create a "CLICKED" event
   * @param campaignId - Campaign ID
   * @param customerId - Customer ID
   * @param emailSequenceId - Email sequence ID (if applicable)
   * @param metadata - Link URL and other click metadata
   * @returns New MarketingEvent
   */
  static createClicked(
    campaignId: string,
    customerId: string,
    emailSequenceId: string | null = null,
    metadata: Record<string, unknown> = {}
  ): MarketingEvent {
    return new MarketingEvent(
      `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'CLICKED',
      campaignId,
      customerId,
      null,
      emailSequenceId,
      metadata,
      new Date()
    );
  }

  /**
   * Create a "CONVERTED" event
   * @param campaignId - Campaign ID
   * @param customerId - Customer ID
   * @param discountCodeId - Discount code used (if applicable)
   * @param metadata - Conversion metadata (revenue, order ID, etc.)
   * @returns New MarketingEvent
   */
  static createConverted(
    campaignId: string,
    customerId: string,
    discountCodeId: string | null = null,
    metadata: Record<string, unknown> = {}
  ): MarketingEvent {
    return new MarketingEvent(
      `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'CONVERTED',
      campaignId,
      customerId,
      discountCodeId,
      null,
      metadata,
      new Date()
    );
  }

  /**
   * Create an "UNSUBSCRIBED" event
   * @param campaignId - Campaign ID
   * @param customerId - Customer ID
   * @returns New MarketingEvent
   */
  static createUnsubscribed(campaignId: string, customerId: string): MarketingEvent {
    return new MarketingEvent(
      `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'UNSUBSCRIBED',
      campaignId,
      customerId,
      null,
      null,
      {},
      new Date()
    );
  }

  /**
   * Create a "BOUNCED" event
   * @param campaignId - Campaign ID
   * @param customerId - Customer ID
   * @param metadata - Bounce reason
   * @returns New MarketingEvent
   */
  static createBounced(
    campaignId: string,
    customerId: string,
    metadata: Record<string, unknown> = {}
  ): MarketingEvent {
    return new MarketingEvent(
      `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'BOUNCED',
      campaignId,
      customerId,
      null,
      null,
      metadata,
      new Date()
    );
  }

  /**
   * Get event date
   * @returns Event timestamp date only
   */
  getDate(): Date {
    return new Date(this.timestamp.getFullYear(), this.timestamp.getMonth(), this.timestamp.getDate());
  }

  /**
   * Check if event is a conversion event
   * @returns True if type is CONVERTED
   */
  isConversion(): boolean {
    return this.type === 'CONVERTED';
  }

  /**
   * Check if event is an engagement event
   * @returns True if event is OPENED or CLICKED
   */
  isEngagement(): boolean {
    return this.type === 'OPENED' || this.type === 'CLICKED';
  }

  /**
   * Get revenue from event metadata (if conversion)
   * @returns Revenue amount or 0
   */
  getRevenue(): number {
    if (!this.isConversion()) {
      return 0;
    }
    return (this.metadata.revenue as number) || 0;
  }
}
