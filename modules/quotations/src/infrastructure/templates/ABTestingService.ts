/**
 * A/B Testing Service for Email Templates
 * Test different email templates to optimize conversion rates
 */

import { DataSource } from 'typeorm';

export interface EmailVariant {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
  weight: number; // 0-100, percentage of traffic to receive this variant
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: EmailVariant[];
  status: 'draft' | 'running' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  targetSampleSize?: number;
  successMetric: 'open-rate' | 'click-rate' | 'conversion-rate';
  winnerId?: string;
}

export interface TestResults {
  testId: string;
  variantResults: Array<{
    variantId: string;
    variantName: string;
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
    isWinner: boolean;
  }>;
  confidenceLevel: number; // 0-100
  statisticalSignificance: boolean;
  winnerDetermined: boolean;
  recommendation: string;
}

export class ABTestingService {
  constructor(private dataSource: DataSource) {}

  /**
   * Create new A/B test
   */
  async createTest(test: Omit<ABTest, 'id'>): Promise<string> {
    // Validate weights sum to 100
    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100 (currently: ${totalWeight})`);
    }

    const query = `
      INSERT INTO email_ab_tests
        (name, description, variants, status, start_date, end_date, target_sample_size, success_metric)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const [result] = await this.dataSource.query(query, [
      test.name,
      test.description,
      JSON.stringify(test.variants),
      test.status,
      test.startDate,
      test.endDate || null,
      test.targetSampleSize || null,
      test.successMetric,
    ]);

    return result.id;
  }

  /**
   * Get variant to send for a customer (based on weights)
   */
  async getVariantForCustomer(testId: string, customerId: string): Promise<EmailVariant> {
    // Check if customer has already been assigned a variant
    const assignmentQuery = `
      SELECT variant_id, variant_data
      FROM email_ab_test_assignments
      WHERE test_id = $1 AND customer_id = $2
    `;

    const [existing] = await this.dataSource.query(assignmentQuery, [testId, customerId]);

    if (existing) {
      return existing.variant_data;
    }

    // Get test variants
    const testQuery = `
      SELECT variants FROM email_ab_tests WHERE id = $1
    `;

    const [test] = await this.dataSource.query(testQuery, [testId]);

    if (!test) {
      throw new Error('Test not found');
    }

    const variants: EmailVariant[] = test.variants;

    // Select variant based on weighted random selection
    const selectedVariant = this.weightedRandomSelection(variants);

    // Assign variant to customer
    await this.dataSource.query(
      `INSERT INTO email_ab_test_assignments (test_id, customer_id, variant_id, variant_data, assigned_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [testId, customerId, selectedVariant.id, JSON.stringify(selectedVariant)]
    );

    return selectedVariant;
  }

  /**
   * Record email event (sent, opened, clicked, converted)
   */
  async recordEvent(
    testId: string,
    customerId: string,
    event: 'sent' | 'opened' | 'clicked' | 'converted',
    metadata?: any
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO email_ab_test_events (test_id, customer_id, event_type, event_data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [testId, customerId, event, JSON.stringify(metadata || {})]
    );
  }

  /**
   * Get test results
   */
  async getTestResults(testId: string): Promise<TestResults> {
    const query = `
      WITH variant_stats AS (
        SELECT
          a.variant_id,
          a.variant_data->>'name' as variant_name,
          COUNT(DISTINCT CASE WHEN e.event_type = 'sent' THEN e.customer_id END) as sent,
          COUNT(DISTINCT CASE WHEN e.event_type = 'opened' THEN e.customer_id END) as opened,
          COUNT(DISTINCT CASE WHEN e.event_type = 'clicked' THEN e.customer_id END) as clicked,
          COUNT(DISTINCT CASE WHEN e.event_type = 'converted' THEN e.customer_id END) as converted
        FROM email_ab_test_assignments a
        LEFT JOIN email_ab_test_events e ON e.test_id = a.test_id AND e.customer_id = a.customer_id
        WHERE a.test_id = $1
        GROUP BY a.variant_id, a.variant_data->>'name'
      )
      SELECT
        variant_id,
        variant_name,
        sent,
        opened,
        clicked,
        converted,
        CASE WHEN sent > 0 THEN (opened::float / sent * 100) ELSE 0 END as open_rate,
        CASE WHEN opened > 0 THEN (clicked::float / opened * 100) ELSE 0 END as click_rate,
        CASE WHEN sent > 0 THEN (converted::float / sent * 100) ELSE 0 END as conversion_rate
      FROM variant_stats
      ORDER BY conversion_rate DESC
    `;

    const results = await this.dataSource.query(query, [testId]);

    // Get test info
    const [test] = await this.dataSource.query(
      'SELECT success_metric, winner_id FROM email_ab_tests WHERE id = $1',
      [testId]
    );

    // Determine winner based on success metric
    const successMetric = test.success_metric;
    const metricKey = successMetric === 'open-rate' ? 'open_rate'
      : successMetric === 'click-rate' ? 'click_rate'
      : 'conversion_rate';

    const sortedResults = [...results].sort((a, b) => b[metricKey] - a[metricKey]);
    const winner = sortedResults[0];
    const runnerUp = sortedResults[1];

    // Calculate statistical significance (simplified chi-square test)
    const { significant, confidence } = this.calculateSignificance(winner, runnerUp, metricKey);

    const variantResults = results.map((r: any) => ({
      variantId: r.variant_id,
      variantName: r.variant_name,
      sent: parseInt(r.sent),
      opened: parseInt(r.opened),
      clicked: parseInt(r.clicked),
      converted: parseInt(r.converted),
      openRate: parseFloat(r.open_rate),
      clickRate: parseFloat(r.click_rate),
      conversionRate: parseFloat(r.conversion_rate),
      isWinner: r.variant_id === winner.variant_id,
    }));

    return {
      testId,
      variantResults,
      confidenceLevel: confidence,
      statisticalSignificance: significant,
      winnerDetermined: significant && test.winner_id != null,
      recommendation: this.generateRecommendation(variantResults, significant, successMetric),
    };
  }

  /**
   * Declare winner and stop test
   */
  async declareWinner(testId: string, winnerId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE email_ab_tests
       SET winner_id = $2, status = 'completed', end_date = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [testId, winnerId]
    );
  }

  /**
   * Weighted random selection of variant
   */
  private weightedRandomSelection(variants: EmailVariant[]): EmailVariant {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  /**
   * Calculate statistical significance (simplified)
   */
  private calculateSignificance(
    winner: any,
    runnerUp: any,
    metric: string
  ): { significant: boolean; confidence: number } {
    if (!winner || !runnerUp) {
      return { significant: false, confidence: 0 };
    }

    const winnerValue = parseFloat(winner[metric]);
    const runnerUpValue = parseFloat(runnerUp[metric]);
    const winnerSampleSize = parseInt(winner.sent);
    const runnerUpSampleSize = parseInt(runnerUp.sent);

    // Need minimum sample size
    if (winnerSampleSize < 100 || runnerUpSampleSize < 100) {
      return { significant: false, confidence: 0 };
    }

    // Calculate difference
    const difference = Math.abs(winnerValue - runnerUpValue);
    const relativeDifference = (difference / runnerUpValue) * 100;

    // Simplified confidence calculation
    // In production, use proper statistical tests (chi-square, t-test, etc.)
    let confidence = 0;

    if (relativeDifference > 20 && winnerSampleSize > 200) {
      confidence = 95;
    } else if (relativeDifference > 15 && winnerSampleSize > 150) {
      confidence = 90;
    } else if (relativeDifference > 10 && winnerSampleSize > 100) {
      confidence = 80;
    } else {
      confidence = Math.min(70, relativeDifference * 3);
    }

    return {
      significant: confidence >= 90,
      confidence: Math.round(confidence),
    };
  }

  /**
   * Generate recommendation based on results
   */
  private generateRecommendation(
    results: any[],
    significant: boolean,
    metric: string
  ): string {
    if (results.length < 2) {
      return 'Not enough data to make a recommendation.';
    }

    const winner = results.find(r => r.isWinner);

    if (!winner) {
      return 'Unable to determine winner.';
    }

    if (!significant) {
      return `Continue testing. ${winner.variantName} is leading but results are not statistically significant yet. Need more data.`;
    }

    const metricName = metric === 'open-rate' ? 'open rate'
      : metric === 'click-rate' ? 'click rate'
      : 'conversion rate';

    return `${winner.variantName} is the clear winner with ${winner.conversionRate.toFixed(1)}% ${metricName}. Recommend using this variant for all future sends.`;
  }

  /**
   * List all A/B tests
   */
  async listTests(status?: string): Promise<any[]> {
    let query = `
      SELECT
        id,
        name,
        description,
        status,
        start_date as "startDate",
        end_date as "endDate",
        success_metric as "successMetric",
        winner_id as "winnerId",
        created_at as "createdAt"
      FROM email_ab_tests
    `;

    if (status) {
      query += ` WHERE status = $1`;
      return await this.dataSource.query(query, [status]);
    }

    query += ` ORDER BY created_at DESC`;
    return await this.dataSource.query(query);
  }
}
