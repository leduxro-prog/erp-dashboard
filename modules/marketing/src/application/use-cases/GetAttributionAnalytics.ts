/**
 * GetAttributionAnalytics Use-Case
 * Application use-case for retrieving attribution analytics across channels
 *
 * @module Application/UseCases
 */

import {
  IAttributionEventRepository,
  AttributionSummary,
} from '../../domain/repositories/IAttributionEventRepository';

/**
 * Input for GetAttributionAnalytics use-case
 */
export interface GetAttributionAnalyticsInput {
  /** Start date for the analytics period */
  startDate: Date;
  /** End date for the analytics period */
  endDate: Date;
  /** Optional campaign ID filter */
  campaignId?: string;
  /** Optional channel filter */
  channel?: string;
  /** Group results by channel or campaign */
  groupBy?: 'channel' | 'campaign';
}

/**
 * Output from GetAttributionAnalytics use-case
 */
export interface GetAttributionAnalyticsOutput {
  /** Attribution summary broken down by channel */
  summaryByChannel: AttributionSummary[];
  /** Total revenue across all channels */
  totalRevenue: number;
  /** Total cost across all channels */
  totalCost: number;
  /** Overall Return on Ad Spend */
  overallROAS: number;
  /** Total number of conversions */
  totalConversions: number;
}

/**
 * GetAttributionAnalytics Use-Case
 *
 * Responsibilities:
 * - Fetch attribution summary data grouped by channel
 * - Fetch revenue breakdown by channel
 * - Calculate aggregate totals and overall ROAS
 * - Return comprehensive analytics object
 *
 * @class GetAttributionAnalytics
 */
export class GetAttributionAnalytics {
  /**
   * Create a new GetAttributionAnalytics use-case instance
   *
   * @param attributionEventRepository - Attribution event repository
   */
  constructor(private readonly attributionEventRepository: IAttributionEventRepository) {}

  /**
   * Execute the GetAttributionAnalytics use-case
   *
   * @param input - Attribution analytics input
   * @returns Attribution analytics output
   */
  async execute(input: GetAttributionAnalyticsInput): Promise<GetAttributionAnalyticsOutput> {
    const { startDate, endDate, campaignId } = input;

    // Get attribution summary grouped by channel
    const summaryByChannel = await this.attributionEventRepository.getAttributionSummary({
      startDate,
      endDate,
      campaignId,
    });

    // Get revenue breakdown by channel
    const revenueByChannel = await this.attributionEventRepository.getRevenueByChannel(
      startDate,
      endDate,
    );

    // Calculate aggregate totals from the summary data
    const totalRevenue = summaryByChannel.reduce((sum, s) => sum + s.revenue, 0);
    const totalCost = summaryByChannel.reduce((sum, s) => sum + s.cost, 0);
    const totalConversions = summaryByChannel.reduce((sum, s) => sum + s.conversions, 0);
    const overallROAS = totalCost > 0 ? totalRevenue / totalCost : 0;

    return {
      summaryByChannel,
      totalRevenue,
      totalCost,
      overallROAS,
      totalConversions,
    };
  }
}
