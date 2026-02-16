import { describe, it, expect, beforeEach } from '@jest/globals';
import { Forecast, ForecastMethod, ForecastDataPoint } from '../../src/domain/entities/Forecast';

/**
 * Forecast Entity Unit Tests
 *
 * Tests forecasting functionality:
 * - Future value prediction
 * - Accuracy metrics (MAPE)
 * - Confidence intervals
 * - Forecast horizon validation
 */
describe('Forecast Entity', () => {
  let forecast: Forecast;
  let dataPoints: ForecastDataPoint[];

  beforeEach(() => {
    // Create historical data points with clear trend
    dataPoints = [
      { date: new Date('2024-01-01'), actual: 1000, predicted: 950 },
      { date: new Date('2024-01-02'), actual: 1100, predicted: 1050 },
      { date: new Date('2024-01-03'), actual: 1200, predicted: 1150 },
      { date: new Date('2024-01-04'), actual: 1300, predicted: 1250 },
      { date: new Date('2024-01-05'), actual: 1400, predicted: 1350 },
      // Future predictions (no actual values)
      { date: new Date('2024-01-06'), actual: null, predicted: 1450 },
      { date: new Date('2024-01-07'), actual: null, predicted: 1550 },
    ];

    forecast = new Forecast(
      'forecast-001',
      'TOTAL_REVENUE',
      ForecastMethod.LINEAR_REGRESSION,
      dataPoints,
      95,
      92,
      30
    );
  });

  describe('Future Value Prediction', () => {
    it('should predict value within forecast horizon', () => {
      const futureDate = new Date('2024-01-06');

      const predicted = forecast.predict(futureDate);

      expect(predicted).not.toBeNull();
      expect(predicted).toBeGreaterThan(0);
    });

    it('should return null for date outside forecast horizon', () => {
      const farFuture = new Date('2024-12-31'); // More than 30 days ahead

      const predicted = forecast.predict(farFuture);

      expect(predicted).toBeNull();
    });

    it('should return null for past dates', () => {
      const pastDate = new Date('2023-12-01');

      const predicted = forecast.predict(pastDate);

      expect(predicted).toBeNull();
    });

    it('should provide consistent predictions for same date', () => {
      const date = new Date('2024-01-10');

      const pred1 = forecast.predict(date);
      const pred2 = forecast.predict(date);

      expect(pred1).toBe(pred2);
    });

    it('should interpolate between data points', () => {
      // Midpoint between day 5 and 6
      const midpoint = new Date('2024-01-05T12:00:00');

      const predicted = forecast.predict(midpoint);

      expect(predicted).not.toBeNull();
      if (predicted !== null) {
        const day5 = forecast.dataPoints[4].predicted;
        const day6 = forecast.dataPoints[5].predicted;
        expect(predicted).toBeGreaterThanOrEqual(Math.min(day5, day6));
        expect(predicted).toBeLessThanOrEqual(Math.max(day5, day6));
      }
    });
  });

  describe('Accuracy Metrics', () => {
    it('should return accuracy percentage', () => {
      const accuracy = forecast.getAccuracy();

      expect(accuracy).toBe(95);
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
    });

    it('should calculate MAPE (Mean Absolute Percentage Error)', () => {
      const mape = forecast.getMAPE();

      expect(mape).toBeGreaterThanOrEqual(0);
      // MAPE should be less than 50% for this high-accuracy forecast
      expect(mape).toBeLessThan(50);
    });

    it('should handle forecast with high MAPE', () => {
      const poorForecast = new Forecast(
        'poor-forecast',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        [
          { date: new Date('2024-01-01'), actual: 1000, predicted: 500 },
          { date: new Date('2024-01-02'), actual: 1000, predicted: 1500 },
          { date: new Date('2024-01-03'), actual: 1000, predicted: 900 },
        ],
        20,
        15,
        30
      );

      const mape = poorForecast.getMAPE();

      expect(mape).toBeGreaterThan(30); // Poor accuracy
    });
  });

  describe('Confidence Intervals', () => {
    it('should return confidence interval for predicted date', () => {
      const date = new Date('2024-01-10');

      const interval = forecast.getConfidenceInterval(date);

      expect(interval).not.toBeNull();
      if (interval !== null) {
        const [lower, upper] = interval;
        expect(lower).toBeLessThan(upper);
        expect(lower).toBeGreaterThan(0); // Revenue forecast should be positive
      }
    });

    it('should return null for date outside forecast horizon', () => {
      const farFuture = new Date('2024-12-31');

      const interval = forecast.getConfidenceInterval(farFuture);

      expect(interval).toBeNull();
    });

    it('should have wider intervals with lower confidence', () => {
      const lowConfidence = new Forecast(
        'low-conf',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        dataPoints,
        85,
        50, // Low confidence
        30
      );

      const highConfidence = new Forecast(
        'high-conf',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        dataPoints,
        95,
        95, // High confidence
        30
      );

      const date = new Date('2024-01-10');

      const lowInterval = lowConfidence.getConfidenceInterval(date);
      const highInterval = highConfidence.getConfidenceInterval(date);

      if (lowInterval && highInterval) {
        const lowWidth = lowInterval[1] - lowInterval[0];
        const highWidth = highInterval[1] - highInterval[0];

        expect(lowWidth).toBeGreaterThan(highWidth);
      }
    });

    it('should ensure interval bounds are symmetric around prediction', () => {
      const date = new Date('2024-01-06');
      const predicted = forecast.predict(date);

      const interval = forecast.getConfidenceInterval(date);

      if (interval && predicted !== null) {
        const [lower, upper] = interval;
        const midpoint = (lower + upper) / 2;

        // Midpoint should be close to predicted value
        expect(Math.abs(midpoint - predicted)).toBeLessThan(Math.abs(upper - lower) * 0.1);
      }
    });
  });

  describe('Forecast Methods', () => {
    it('should support linear regression', () => {
      expect(forecast.method).toBe(ForecastMethod.LINEAR_REGRESSION);
    });

    it('should support moving average', () => {
      const maForecast = new Forecast(
        'ma-forecast',
        'TOTAL_REVENUE',
        ForecastMethod.MOVING_AVERAGE,
        dataPoints,
        92,
        90,
        30
      );

      expect(maForecast.method).toBe(ForecastMethod.MOVING_AVERAGE);
    });

    it('should support exponential smoothing', () => {
      const esForecast = new Forecast(
        'es-forecast',
        'TOTAL_REVENUE',
        ForecastMethod.EXPONENTIAL_SMOOTHING,
        dataPoints,
        90,
        88,
        30
      );

      expect(esForecast.method).toBe(ForecastMethod.EXPONENTIAL_SMOOTHING);
    });

    it('should support seasonal method', () => {
      const sForecast = new Forecast(
        's-forecast',
        'TOTAL_REVENUE',
        ForecastMethod.SEASONAL,
        dataPoints,
        96,
        94,
        30
      );

      expect(sForecast.method).toBe(ForecastMethod.SEASONAL);
    });
  });

  describe('Forecast Horizon', () => {
    it('should track forecast horizon in days', () => {
      const shortHorizon = new Forecast(
        'short',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        dataPoints,
        95,
        92,
        7 // 7 days
      );

      expect(shortHorizon.forecastHorizon).toBe(7);
    });

    it('should support extended horizons', () => {
      const longHorizon = new Forecast(
        'long',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        dataPoints,
        85,
        80,
        365 // 1 year
      );

      expect(longHorizon.forecastHorizon).toBe(365);
    });
  });

  describe('Generation Timestamp', () => {
    it('should track when forecast was generated', () => {
      const now = new Date();
      const gen = new Forecast(
        'forecast-ts',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        dataPoints,
        95,
        92,
        30,
        now
      );

      expect(gen.generatedAt).toBe(now);
    });

    it('should default to current time if not provided', () => {
      const before = new Date();
      const gen = new Forecast(
        'forecast-default-ts',
        'TOTAL_REVENUE',
        ForecastMethod.LINEAR_REGRESSION,
        dataPoints,
        95,
        92,
        30
      );
      const after = new Date();

      expect(gen.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(gen.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Historical Data Integration', () => {
    it('should include actual historical values', () => {
      const actual = dataPoints.filter((p) => p.actual !== null);

      expect(actual.length).toBeGreaterThan(0);
      expect(actual[0].actual).toBe(1000);
    });

    it('should separate predicted values for future dates', () => {
      const future = dataPoints.filter((p) => p.actual === null);

      expect(future.length).toBeGreaterThan(0);
      expect(future[0].actual).toBeNull();
      expect(future[0].predicted).not.toBeNull();
    });

    it('should maintain data point order', () => {
      for (let i = 1; i < dataPoints.length; i++) {
        expect(dataPoints[i].date.getTime()).toBeGreaterThanOrEqual(
          dataPoints[i - 1].date.getTime()
        );
      }
    });
  });
});
