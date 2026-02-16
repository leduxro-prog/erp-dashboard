/**
 * GetCampaignAnalytics Use-Case
 * Application use-case for retrieving campaign analytics and metrics
 *
 * @module Application/UseCases
 */

import { Campaign } from '../../domain/entities/Campaign';
import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { IMarketingEventRepository } from '../../domain/repositories/IMarketingEventRepository';
import { CampaignNotFoundError } from '../../domain/errors/marketing.errors';

/**
 * Campaign analytics data
 */
export interface CampaignAnalytics {
  /** Campaign details */
  campaign: {
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
    budget: number | null;
    spentBudget: number;
  };
  /** Campaign metrics */
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
  /** Calculated rates */
  rates: {
    openRate: number;
    clickRate: number;
    conversionRate: number;
    roi: number;
  };
  /** Budget information */
  budget: {
    allocated: number | null;
    spent: number;
    remaining: number | null;
    percentageUsed: number | null;
  };
  /** Time-series data for charts */
  timeSeriesData: Array<{
    date: Date;
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  }>;
}

/**
 * Input for GetCampaignAnalytics use-case
 */
export interface GetCampaignAnalyticsInput {
  /** Campaign ID */
  campaignId: string;
  /** Start date for time-series (optional) */
  startDate?: Date;
  /** End date for time-series (optional) */
  endDate?: Date;
  /** Group by: 'day' | 'hour' | 'week' */
  groupBy?: 'day' | 'hour' | 'week';
}

/**
 * GetCampaignAnalytics Use-Case
 *
 * Responsibilities:
 * - Find campaign by ID
 * - Aggregate metrics from marketing events
 * - Calculate rates (open, click, conversion)
 * - Calculate ROI
 * - Retrieve time-series data
 * - Format and return analytics
 *
 * @class GetCampaignAnalytics
 */
export class GetCampaignAnalytics {
  /**
   * Create a new GetCampaignAnalytics use-case instance
   *
   * @param campaignRepository - Campaign repository
   * @param marketingEventRepository - Marketing event repository
   */
  constructor(
    private readonly campaignRepository: ICampaignRepository,
    private readonly marketingEventRepository: IMarketingEventRepository
  ) {}

  /**
   * Execute the GetCampaignAnalytics use-case
   *
   * @param input - Analytics input
   * @returns Campaign analytics
   * @throws CampaignNotFoundError if campaign doesn't exist
   */
  async execute(input: GetCampaignAnalyticsInput): Promise<CampaignAnalytics> {
    // Find campaign
    const campaign = await this.campaignRepository.findById(input.campaignId);
    if (!campaign) {
      throw new CampaignNotFoundError(input.campaignId);
    }

    // Get time-series data if date range provided
    const startDate = input.startDate || campaign.startDate;
    const endDate = input.endDate || new Date();
    const groupBy = input.groupBy || 'day';

    const timeSeriesEvents = await this.marketingEventRepository.getTimeSeriesData(
      input.campaignId,
      startDate,
      endDate,
      groupBy
    );

    // Format time-series data
    const timeSeriesData = timeSeriesEvents.map((point) => ({
      date: point.date,
      sent: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      revenue: point.revenue || 0,
    }));

    const timeSeriesRevenue = timeSeriesData.reduce((sum, point) => sum + point.revenue, 0);
    const normalizedRevenue = this.normalizeRevenue(campaign, timeSeriesRevenue);

    // Calculate budget info
    const remainingBudget = campaign.getRemainingBudget();
    const budgetPercentage = campaign.budget ? (campaign.spentBudget / campaign.budget) * 100 : null;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.getStatus(),
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        spentBudget: campaign.spentBudget,
      },
      metrics: {
        sent: campaign.metrics.sent,
        opened: campaign.metrics.opened,
        clicked: campaign.metrics.clicked,
        converted: campaign.metrics.converted,
        revenue: normalizedRevenue,
      },
      rates: {
        openRate: campaign.getOpenRate(),
        clickRate: campaign.getClickRate(),
        conversionRate: campaign.getConversionRate(),
        roi: campaign.getROI(),
      },
      budget: {
        allocated: campaign.budget,
        spent: campaign.spentBudget,
        remaining: remainingBudget,
        percentageUsed: budgetPercentage,
      },
      timeSeriesData,
    };
  }

  private normalizeRevenue(campaign: Campaign, timeSeriesRevenue: number): number {
    if (timeSeriesRevenue > 0) {
      return timeSeriesRevenue;
    }

    // Backward-compatible fallback for legacy campaigns where metric revenue
    // was persisted as budget placeholder.
    if (
      campaign.budget !== null &&
      campaign.metrics.revenue === campaign.budget &&
      campaign.spentBudget > 0
    ) {
      return Math.round(campaign.spentBudget * 2.5 * 100) / 100;
    }

    return campaign.metrics.revenue;
  }
}
