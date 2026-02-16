import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetricSnapshot, MetricType, Period } from '../../src/domain/entities/MetricSnapshot';

/**
 * MetricSnapshot Entity Unit Tests
 *
 * Tests metric snapshot functionality:
 * - Trend calculation
 * - Comparisons between periods
 * - Dimensional analysis
 * - Positive/negative tracking
 */
describe('MetricSnapshot Entity', () => {
  let snapshot: MetricSnapshot;
  let previousSnapshot: MetricSnapshot;

  beforeEach(() => {
    snapshot = new MetricSnapshot(
      'metric-001',
      MetricType.TOTAL_REVENUE,
      150000,
      Period.MONTHLY,
      new Date('2024-02-01'),
      new Date('2024-02-29'),
      new Map([
        ['region', 'US'],
        ['tier', 'GOLD'],
      ]),
      120000,
      25.0
    );

    previousSnapshot = new MetricSnapshot(
      'metric-000',
      MetricType.TOTAL_REVENUE,
      120000,
      Period.MONTHLY,
      new Date('2024-01-01'),
      new Date('2024-01-31'),
      new Map([
        ['region', 'US'],
        ['tier', 'GOLD'],
      ])
    );
  });

  describe('Trend Calculation', () => {
    it('should identify increasing trend', () => {
      const increasing = new MetricSnapshot(
        'metric-1',
        MetricType.TOTAL_REVENUE,
        150000,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29'),
        new Map(),
        100000,
        50.0
      );

      expect(increasing.getTrend()).toBe('increasing');
    });

    it('should identify decreasing trend', () => {
      const decreasing = new MetricSnapshot(
        'metric-2',
        MetricType.TOTAL_REVENUE,
        80000,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29'),
        new Map(),
        100000,
        -20.0
      );

      expect(decreasing.getTrend()).toBe('decreasing');
    });

    it('should identify stable trend within threshold', () => {
      const stable = new MetricSnapshot(
        'metric-3',
        MetricType.TOTAL_REVENUE,
        100200,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29'),
        new Map(),
        100000,
        0.2
      );

      expect(stable.getTrend()).toBe('stable');
    });

    it('should return null if no previous value', () => {
      const noHistory = new MetricSnapshot(
        'metric-4',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29'),
        new Map()
      );

      expect(noHistory.getTrend()).toBeNull();
    });
  });

  describe('Positive/Negative Tracking', () => {
    it('should report positive change as positive', () => {
      snapshot.changePercentage = 25.0;

      expect(snapshot.isPositive()).toBe(true);
    });

    it('should report zero change as positive', () => {
      snapshot.changePercentage = 0;

      expect(snapshot.isPositive()).toBe(true);
    });

    it('should report negative change as not positive', () => {
      snapshot.changePercentage = -15.0;

      expect(snapshot.isPositive()).toBe(false);
    });

    it('should handle null change as not positive', () => {
      snapshot.changePercentage = null;

      expect(snapshot.isPositive()).toBe(false);
    });
  });

  describe('Metric Comparison', () => {
    it('should calculate difference between snapshots', () => {
      const comparison = snapshot.compareWith(previousSnapshot);

      expect(comparison.difference).toBe(30000); // 150000 - 120000
    });

    it('should calculate percentage change', () => {
      const comparison = snapshot.compareWith(previousSnapshot);

      expect(comparison.percentageChange).toBe(25); // (30000 / 120000) * 100
    });

    it('should identify increasing trend in comparison', () => {
      const comparison = snapshot.compareWith(previousSnapshot);

      expect(comparison.trend).toBe('increasing');
    });

    it('should identify decreasing trend in comparison', () => {
      const decreasing = new MetricSnapshot(
        'metric-dec',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29'),
        new Map(),
        120000
      );

      const comparison = decreasing.compareWith(previousSnapshot);

      expect(comparison.trend).toBe('decreasing');
    });

    it('should throw error when comparing different metric types', () => {
      const differentMetric = new MetricSnapshot(
        'metric-cust',
        MetricType.CUSTOMER_COUNT,
        500,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29')
      );

      expect(() => snapshot.compareWith(differentMetric)).toThrow(
        'Cannot compare different metric types'
      );
    });

    it('should throw error when comparing different dimensions', () => {
      const differentDims = new MetricSnapshot(
        'metric-other-region',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29'),
        new Map([['region', 'EU']])
      );

      expect(() => snapshot.compareWith(differentDims)).toThrow(
        'Cannot compare metrics with different dimensions'
      );
    });

    it('should return comparison with correct metadata', () => {
      const comparison = snapshot.compareWith(previousSnapshot);

      expect(comparison.metricType).toBe(MetricType.TOTAL_REVENUE);
      expect(comparison.currentValue).toBe(150000);
      expect(comparison.previousValue).toBe(120000);
      expect(comparison.currentPeriod).toBe(Period.MONTHLY);
      expect(comparison.previousPeriod).toBe(Period.MONTHLY);
    });
  });

  describe('Dimensional Analysis', () => {
    it('should store multiple dimensions', () => {
      expect(snapshot.dimensions.get('region')).toBe('US');
      expect(snapshot.dimensions.get('tier')).toBe('GOLD');
    });

    it('should support empty dimensions', () => {
      const noDims = new MetricSnapshot(
        'metric-no-dims',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date('2024-02-01'),
        new Date('2024-02-29')
      );

      expect(noDims.dimensions.size).toBe(0);
    });

    it('should preserve dimensions in comparison', () => {
      const comparison = snapshot.compareWith(previousSnapshot);

      // Dimensions are part of the snapshot, not comparison result
      expect(snapshot.dimensions.get('region')).toBe('US');
    });
  });

  describe('Period Tracking', () => {
    it('should track daily period', () => {
      const daily = new MetricSnapshot(
        'daily-metric',
        MetricType.ORDER_COUNT,
        150,
        Period.DAILY,
        new Date('2024-02-15'),
        new Date('2024-02-16')
      );

      expect(daily.period).toBe(Period.DAILY);
    });

    it('should track weekly period', () => {
      const weekly = new MetricSnapshot(
        'weekly-metric',
        MetricType.ORDER_COUNT,
        1050,
        Period.WEEKLY,
        new Date('2024-02-12'),
        new Date('2024-02-19')
      );

      expect(weekly.period).toBe(Period.WEEKLY);
    });

    it('should track monthly period', () => {
      expect(snapshot.period).toBe(Period.MONTHLY);
    });

    it('should track yearly period', () => {
      const yearly = new MetricSnapshot(
        'yearly-metric',
        MetricType.TOTAL_REVENUE,
        1800000,
        Period.YEARLY,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(yearly.period).toBe(Period.YEARLY);
    });
  });

  describe('Timestamp Management', () => {
    it('should record creation timestamp', () => {
      const now = new Date();
      const metric = new MetricSnapshot(
        'metric-now',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date(),
        new Date(),
        new Map(),
        undefined,
        undefined,
        now
      );

      expect(metric.createdAt).toBe(now);
    });

    it('should default to current time if not provided', () => {
      const before = new Date();
      const metric = new MetricSnapshot(
        'metric-default-time',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date(),
        new Date()
      );
      const after = new Date();

      expect(metric.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(metric.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Zero Division Edge Cases', () => {
    it('should handle comparison with zero previous value', () => {
      const prevZero = new MetricSnapshot(
        'metric-zero',
        MetricType.TOTAL_REVENUE,
        100000,
        Period.MONTHLY,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        new Map(),
        0
      );

      const comparison = snapshot.compareWith(prevZero);

      // When dividing by zero, percentage change should be 100 or infinity
      expect(comparison.percentageChange).toBeGreaterThan(0);
    });
  });
});
