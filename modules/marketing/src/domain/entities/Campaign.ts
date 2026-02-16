/**
 * Campaign Domain Entity
 * Represents a marketing campaign with targets, metrics, and lifecycle management.
 * Rich domain entity with business logic for campaign operations.
 *
 * @module Domain/Entities
 */

/**
 * Campaign type classification
 */
export type CampaignType =
  | 'EMAIL_BLAST'
  | 'DISCOUNT_CODE'
  | 'PRODUCT_LAUNCH'
  | 'SEASONAL'
  | 'FLASH_SALE'
  | 'NEWSLETTER';

/**
 * Campaign status representing lifecycle state
 */
export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Campaign audience filter criteria
 */
export interface AudienceFilter {
  /** Customer tier filter (e.g., BRONZE, SILVER, GOLD, PLATINUM) */
  tiers?: string[];
  /** Customer segment tags */
  tags?: string[];
  /** Filter by minimum purchase history (days) */
  minPurchaseHistoryDays?: number;
  /** Filter by minimum total spent */
  minTotalSpent?: number;
  /** Filter by product categories purchased */
  purchasedCategories?: string[];
}

/**
 * Campaign metrics tracking
 */
export interface CampaignMetrics {
  /** Number of emails/notifications sent */
  sent: number;
  /** Number of emails/notifications opened */
  opened: number;
  /** Number of clicks */
  clicked: number;
  /** Number of conversions */
  converted: number;
  /** Total revenue generated */
  revenue: number;
}

/**
 * Campaign Domain Entity
 *
 * Encapsulates campaign data with business logic for:
 * - Campaign lifecycle management (activate, pause, complete, cancel)
 * - Metrics tracking and analytics (ROI, conversion rate)
 * - Campaign validation (dates, budget, audience)
 *
 * @class Campaign
 */
export class Campaign {
  /**
   * Create a new Campaign entity
   *
   * @param id - Unique campaign identifier
   * @param name - Campaign name
   * @param type - Campaign type (EMAIL_BLAST, DISCOUNT_CODE, etc.)
   * @param status - Current campaign status
   * @param description - Campaign description
   * @param targetAudience - Audience filter criteria
   * @param startDate - Campaign start date
   * @param endDate - Campaign end date
   * @param budget - Campaign budget (optional)
   * @param spentBudget - Amount of budget spent
   * @param metrics - Campaign metrics
   * @param createdBy - User ID who created the campaign
   * @param createdAt - Creation timestamp
   * @param updatedAt - Last update timestamp
   */
  constructor(
    readonly id: string,
    readonly name: string,
    readonly type: CampaignType,
    private status: CampaignStatus,
    readonly description: string,
    readonly targetAudience: AudienceFilter,
    readonly startDate: Date,
    readonly endDate: Date,
    readonly budget: number | null,
    readonly spentBudget: number,
    readonly metrics: CampaignMetrics,
    readonly createdBy: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  /**
   * Get current campaign status
   * @returns Current campaign status
   */
  getStatus(): CampaignStatus {
    return this.status;
  }

  /**
   * Check if campaign is currently active
   * @returns True if campaign status is ACTIVE
   */
  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  /**
   * Check if campaign has expired (end date passed)
   * @returns True if current date is past end date
   */
  isExpired(): boolean {
    return new Date() > this.endDate;
  }

  /**
   * Activate the campaign
   * Can only activate from DRAFT or SCHEDULED status
   *
   * @throws Error if campaign cannot be activated
   */
  activate(): void {
    if (this.status !== 'DRAFT' && this.status !== 'SCHEDULED') {
      throw new Error(
        `Cannot activate campaign with status ${this.status}. Must be DRAFT or SCHEDULED.`,
      );
    }

    if (new Date() > this.startDate && this.status === 'DRAFT') {
      throw new Error('Cannot activate campaign after start date');
    }

    this.status = 'ACTIVE';
  }

  /**
   * Pause an active campaign
   * Stops sending emails, but can be resumed
   *
   * @throws Error if campaign is not active
   */
  pause(): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot pause campaign with status ${this.status}. Must be ACTIVE.`);
    }
    this.status = 'PAUSED';
  }

  /**
   * Resume a paused campaign
   * Returns campaign to ACTIVE status
   *
   * @throws Error if campaign is not paused
   */
  resume(): void {
    if (this.status !== 'PAUSED') {
      throw new Error(`Cannot resume campaign with status ${this.status}. Must be PAUSED.`);
    }
    this.status = 'ACTIVE';
  }

  /**
   * Complete a campaign
   * Campaign has finished running
   *
   * @throws Error if campaign cannot be completed
   */
  complete(): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
      throw new Error(`Cannot complete campaign with status ${this.status}`);
    }
    this.status = 'COMPLETED';
  }

  /**
   * Cancel a campaign
   * Campaign is cancelled and will not run
   *
   * @throws Error if campaign is already completed or cancelled
   */
  cancel(): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
      throw new Error(`Cannot cancel campaign with status ${this.status}`);
    }
    this.status = 'CANCELLED';
  }

  /**
   * Add metrics to the campaign
   * Accumulates sent, opened, clicked, converted counts and revenue
   *
   * @param metrics - Metrics to add
   */
  addMetrics(metrics: Partial<CampaignMetrics>): void {
    if (metrics.sent !== undefined) {
      this.metrics.sent += metrics.sent;
    }
    if (metrics.opened !== undefined) {
      this.metrics.opened += metrics.opened;
    }
    if (metrics.clicked !== undefined) {
      this.metrics.clicked += metrics.clicked;
    }
    if (metrics.converted !== undefined) {
      this.metrics.converted += metrics.converted;
    }
    if (metrics.revenue !== undefined) {
      this.metrics.revenue += metrics.revenue;
    }
  }

  /**
   * Calculate return on investment (ROI)
   * Returns percentage of revenue relative to budget
   *
   * @returns ROI percentage (0-100), or 0 if no budget
   */
  getROI(): number {
    if (!this.budget || this.budget === 0) {
      return 0;
    }
    return (this.metrics.revenue / this.budget) * 100;
  }

  /**
   * Calculate conversion rate
   * Returns percentage of conversions relative to sent
   *
   * @returns Conversion rate as percentage (0-100), or 0 if nothing sent
   */
  getConversionRate(): number {
    if (this.metrics.sent === 0) {
      return 0;
    }
    return (this.metrics.converted / this.metrics.sent) * 100;
  }

  /**
   * Get open rate
   * Returns percentage of opens relative to sent
   *
   * @returns Open rate as percentage (0-100)
   */
  getOpenRate(): number {
    if (this.metrics.sent === 0) {
      return 0;
    }
    return (this.metrics.opened / this.metrics.sent) * 100;
  }

  /**
   * Get click rate
   * Returns percentage of clicks relative to sent
   *
   * @returns Click rate as percentage (0-100)
   */
  getClickRate(): number {
    if (this.metrics.sent === 0) {
      return 0;
    }
    return (this.metrics.clicked / this.metrics.sent) * 100;
  }

  /**
   * Get remaining budget
   * Returns unspent budget amount
   *
   * @returns Remaining budget, or null if no budget set
   */
  getRemainingBudget(): number | null {
    if (!this.budget) {
      return null;
    }
    return this.budget - this.spentBudget;
  }

  /**
   * Check if budget is exhausted
   * @returns True if spent budget equals or exceeds budget
   */
  isBudgetExhausted(): boolean {
    if (!this.budget) {
      return false;
    }
    return this.spentBudget >= this.budget;
  }
}
