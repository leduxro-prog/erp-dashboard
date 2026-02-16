import { Forecast, ForecastMethod, ForecastDataPoint } from '../entities/Forecast';
import { ForecastError } from '../errors/analytics.errors';

/**
 * Forecasting Service
 *
 * Implements statistical forecasting methods for predicting future metric values.
 * Supports multiple algorithms: linear regression, moving average, exponential smoothing.
 *
 * Methods:
 * - LINEAR_REGRESSION: Best for consistent trends
 * - MOVING_AVERAGE: Good for smoothing noisy data
 * - EXPONENTIAL_SMOOTHING: Recent data weighted more heavily
 * - SEASONAL: Accounts for seasonal patterns (placeholder)
 *
 * @class ForecastingService
 */
export class ForecastingService {
  /**
   * Minimum historical data points required for forecasting
   */
  private static readonly MIN_DATA_POINTS = 5;

  /**
   * Maximum moving average window size
   */
  private static readonly MAX_MA_PERIOD = 30;

  /**
   * Generate a forecast using linear regression
   * Best for data with consistent upward/downward trends
   *
   * Formula: y = mx + b
   * m = (n * Σxy - Σx * Σy) / (n * Σx² - (Σx)²)
   * b = (Σy - m * Σx) / n
   *
   * @param metricType - Type of metric being forecasted
   * @param historicalData - Historical data points (sorted by date)
   * @param forecastDays - How many days to forecast ahead
   * @returns Generated Forecast
   * @throws ForecastError if insufficient data
   */
  public linearRegression(
    metricType: string,
    historicalData: ForecastDataPoint[],
    forecastDays: number = 30
  ): Forecast {
    if (historicalData.length < ForecastingService.MIN_DATA_POINTS) {
      throw new ForecastError(
        `Linear regression requires at least ${ForecastingService.MIN_DATA_POINTS} data points, got ${historicalData.length}`,
        'INSUFFICIENT_DATA'
      );
    }

    const values = historicalData.map((p) => p.actual).filter((v) => v !== null) as number[];

    // Calculate regression line: y = mx + b
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i); // 0, 1, 2, ...
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      throw new ForecastError('Cannot calculate linear regression: no variance in x');
    }

    const m = (n * sumXY - sumX * sumY) / denominator;
    const b = (sumY - m * sumX) / n;

    // Generate forecast points
    const forecastPoints: ForecastDataPoint[] = [...historicalData];
    const lastDate = historicalData[historicalData.length - 1].date;

    for (let i = 1; i <= forecastDays; i++) {
      const xVal = n + i;
      const predicted = m * xVal + b;
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      forecastPoints.push({
        date: forecastDate,
        actual: null,
        predicted: Math.max(0, predicted), // Ensure non-negative
      });
    }

    // Calculate accuracy (MAPE on historical data)
    const mape = this.calculateMAPE(historicalData);
    const accuracy = Math.max(0, 100 - mape);

    return new Forecast(
      `forecast_${metricType}_${Date.now()}`,
      metricType,
      ForecastMethod.LINEAR_REGRESSION,
      forecastPoints,
      accuracy,
      Math.min(95, accuracy), // Confidence = accuracy capped at 95%
      forecastDays
    );
  }

  /**
   * Generate a forecast using moving average
   * Good for smoothing noisy data and identifying trends
   *
   * Each forecast point is the average of the last N points
   *
   * @param metricType - Type of metric
   * @param historicalData - Historical data points
   * @param forecastDays - Days to forecast
   * @param period - Moving average period (default: 7)
   * @returns Generated Forecast
   * @throws ForecastError if insufficient data
   */
  public movingAverage(
    metricType: string,
    historicalData: ForecastDataPoint[],
    forecastDays: number = 30,
    period: number = 7
  ): Forecast {
    if (historicalData.length < period) {
      throw new ForecastError(
        `Moving average requires at least ${period} data points, got ${historicalData.length}`,
        'INSUFFICIENT_DATA'
      );
    }

    if (period > ForecastingService.MAX_MA_PERIOD) {
      throw new ForecastError(
        `Moving average period cannot exceed ${ForecastingService.MAX_MA_PERIOD}`,
        'INVALID_PERIOD'
      );
    }

    const values = historicalData.map((p) => p.actual).filter((v) => v !== null) as number[];

    // Generate forecast points
    const forecastPoints: ForecastDataPoint[] = [...historicalData];
    let lastValue =
      values.slice(-period).reduce((a, b) => a + b, 0) / period;
    const lastDate = historicalData[historicalData.length - 1].date;

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      forecastPoints.push({
        date: forecastDate,
        actual: null,
        predicted: lastValue, // MA stays constant for future periods
      });
    }

    // Calculate accuracy
    const mape = this.calculateMAPE(historicalData);
    const accuracy = Math.max(0, 100 - mape);

    return new Forecast(
      `forecast_${metricType}_${Date.now()}`,
      metricType,
      ForecastMethod.MOVING_AVERAGE,
      forecastPoints,
      accuracy,
      Math.min(90, accuracy), // Slightly lower confidence than LR
      forecastDays
    );
  }

  /**
   * Generate a forecast using exponential smoothing
   * Recent data is weighted more heavily than older data
   *
   * Formula: S_t = α * Y_t + (1 - α) * S_t-1
   * where α is smoothing factor (typically 0.3)
   *
   * @param metricType - Type of metric
   * @param historicalData - Historical data points
   * @param forecastDays - Days to forecast
   * @param alpha - Smoothing factor (0-1, default: 0.3)
   * @returns Generated Forecast
   * @throws ForecastError if insufficient data or invalid alpha
   */
  public exponentialSmoothing(
    metricType: string,
    historicalData: ForecastDataPoint[],
    forecastDays: number = 30,
    alpha: number = 0.3
  ): Forecast {
    if (historicalData.length < ForecastingService.MIN_DATA_POINTS) {
      throw new ForecastError(
        `Exponential smoothing requires at least ${ForecastingService.MIN_DATA_POINTS} data points`,
        'INSUFFICIENT_DATA'
      );
    }

    if (alpha < 0 || alpha > 1) {
      throw new ForecastError(
        `Smoothing factor alpha must be between 0 and 1, got ${alpha}`,
        'INVALID_ALPHA'
      );
    }

    const values = historicalData.map((p) => p.actual).filter((v) => v !== null) as number[];

    // Calculate smoothed values
    let smoothed = values[0];
    const smoothedValues: number[] = [smoothed];

    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
      smoothedValues.push(smoothed);
    }

    // Generate forecast points (smoothed value extends into future)
    const forecastPoints: ForecastDataPoint[] = [...historicalData];
    const lastDate = historicalData[historicalData.length - 1].date;

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      forecastPoints.push({
        date: forecastDate,
        actual: null,
        predicted: smoothed, // Continue with last smoothed value
      });
    }

    // Calculate accuracy
    const mape = this.calculateMAPE(historicalData);
    const accuracy = Math.max(0, 100 - mape);

    return new Forecast(
      `forecast_${metricType}_${Date.now()}`,
      metricType,
      ForecastMethod.EXPONENTIAL_SMOOTHING,
      forecastPoints,
      accuracy,
      Math.min(85, accuracy), // Lower confidence for smoothing
      forecastDays
    );
  }

  /**
   * Calculate Mean Absolute Percentage Error (MAPE)
   * Measures forecast accuracy
   * MAPE = Mean of (|Actual - Predicted| / |Actual|) * 100
   *
   * @param dataPoints - Data points with actual and predicted values
   * @returns MAPE as percentage
   */
  private calculateMAPE(dataPoints: ForecastDataPoint[]): number {
    const pointsWithActual = dataPoints.filter((p) => p.actual !== null);

    if (pointsWithActual.length === 0) {
      return 100; // No data to evaluate
    }

    const errors = pointsWithActual.map((p) => {
      const actual = p.actual as number;
      if (actual === 0) return 0;
      return Math.abs((actual - p.predicted) / actual);
    });

    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    return meanError * 100;
  }
}
