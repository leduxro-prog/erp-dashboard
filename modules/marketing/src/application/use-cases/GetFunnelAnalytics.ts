/**
 * GetFunnelAnalytics Use-Case
 * Application use-case for retrieving funnel analytics for a campaign
 *
 * @module Application/UseCases
 */

import {
  IAttributionEventRepository,
  FunnelStep,
} from '../../domain/repositories/IAttributionEventRepository';

/**
 * Input for GetFunnelAnalytics use-case
 */
export interface GetFunnelAnalyticsInput {
  /** Campaign ID to analyze */
  campaignId: string;
  /** Start date for the funnel period */
  startDate: Date;
  /** End date for the funnel period */
  endDate: Date;
}

/**
 * Output from GetFunnelAnalytics use-case
 */
export interface GetFunnelAnalyticsOutput {
  /** Campaign ID */
  campaignId: string;
  /** Funnel steps with counts and conversion rates */
  steps: FunnelStep[];
  /** Overall conversion rate from first to last step */
  overallConversionRate: number;
}

/**
 * GetFunnelAnalytics Use-Case
 *
 * Responsibilities:
 * - Fetch funnel step data for a campaign
 * - Calculate overall conversion rate from first to last stage
 * - Return structured funnel analytics
 *
 * @class GetFunnelAnalytics
 */
export class GetFunnelAnalytics {
  /**
   * Create a new GetFunnelAnalytics use-case instance
   *
   * @param attributionEventRepository - Attribution event repository
   */
  constructor(private readonly attributionEventRepository: IAttributionEventRepository) {}

  /**
   * Execute the GetFunnelAnalytics use-case
   *
   * @param input - Funnel analytics input
   * @returns Funnel analytics output
   */
  async execute(input: GetFunnelAnalyticsInput): Promise<GetFunnelAnalyticsOutput> {
    const { campaignId, startDate, endDate } = input;

    // Get funnel data from the repository
    const steps = await this.attributionEventRepository.getFunnelData(
      campaignId,
      startDate,
      endDate,
    );

    // Calculate overall conversion rate (last step count / first step count)
    let overallConversionRate = 0;
    if (steps.length >= 2) {
      const firstStepCount = steps[0].count;
      const lastStepCount = steps[steps.length - 1].count;
      overallConversionRate = firstStepCount > 0 ? (lastStepCount / firstStepCount) * 100 : 0;
    } else if (steps.length === 1) {
      overallConversionRate = 100;
    }

    return {
      campaignId,
      steps,
      overallConversionRate,
    };
  }
}
