/**
 * Forecast Entity
 *
 * Represents a forecast/prediction for a business metric using statistical methods.
 * Forecasts help predict future performance based on historical data.
 *
 * Features:
 * - Multiple forecasting methods (linear regression, moving average, exponential smoothing, seasonal)
 * - Tracks actual vs predicted values for accuracy validation
 * - Provides accuracy metrics (MAPE, confidence intervals)
 * - Supports different forecast horizons (30/60/90 days)
 *
 * @class Forecast
 */
export class Forecast {
  /**
   * Unique identifier for this forecast
   */
  public id: string;

  /**
   * Type of metric being forecasted
   */
  public metricType: string;

  /**
   * Forecasting method used
   */
  public method: ForecastMethod;

  /**
   * Array of data points: actual values, predicted values, dates
   */
  public dataPoints: ForecastDataPoint[];

  /**
   * Model accuracy as percentage (0-100)
   * Based on MAPE or other accuracy metric
   */
  public accuracy: number;

  /**
   * Confidence level of forecast (0-100)
   * Higher = more confident in predictions
   */
  public confidence: number;

  /**
   * How many days into the future this forecast extends
   */
  public forecastHorizon: number;

  /**
   * When this forecast was generated
   */
  public generatedAt: Date;

  /**
   * Create a new Forecast
   */
  constructor(
    id: string,
    metricType: string,
    method: ForecastMethod,
    dataPoints: ForecastDataPoint[],
    accuracy: number,
    confidence: number,
    forecastHorizon: number,
    generatedAt: Date = new Date()
  ) {
    this.id = id;
    this.metricType = metricType;
    this.method = method;
    this.dataPoints = dataPoints;
    this.accuracy = accuracy;
    this.confidence = confidence;
    this.forecastHorizon = forecastHorizon;
    this.generatedAt = generatedAt;
  }

  /**
   * Predict the value for a future date
   * Uses interpolation/extrapolation from the forecast data points
   *
   * @param futureDate - Date to predict for
   * @returns Predicted value, or null if outside forecast horizon
   */
  public predict(futureDate: Date): number | null {
    const sortedPoints = [...this.dataPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const firstDataPoint = sortedPoints[0];
    const lastDataPoint = sortedPoints[sortedPoints.length - 1];

    if (!firstDataPoint || !lastDataPoint) {
      return null;
    }

    const dayMs = 1000 * 60 * 60 * 24;
    const horizonEnd = new Date(lastDataPoint.date.getTime() + this.forecastHorizon * dayMs);

    if (futureDate < firstDataPoint.date || futureDate > horizonEnd) {
      return null;
    }

    const exactPoint = sortedPoints.find(
      (p) => p.date.getTime() === futureDate.getTime()
    );
    if (exactPoint) {
      return exactPoint.predicted;
    }

    // Find surrounding data points for interpolation
    const beforePoint = sortedPoints.filter((p) => p.date < futureDate).pop();
    const afterPoint = sortedPoints.find((p) => p.date > futureDate);

    if (!beforePoint) {
      return null;
    }

    // Linear interpolation between points
    if (!afterPoint) {
      // Extrapolate if beyond last point
      return beforePoint.predicted;
    }

    const timeDiff = afterPoint.date.getTime() - beforePoint.date.getTime();
    const valueDiff = afterPoint.predicted - beforePoint.predicted;
    const timeFromBefore = futureDate.getTime() - beforePoint.date.getTime();

    return beforePoint.predicted + (valueDiff * timeFromBefore) / timeDiff;
  }

  /**
   * Get the accuracy of this forecast
   * Calculated as: 100 - MAPE (Mean Absolute Percentage Error)
   *
   * @returns Accuracy as percentage (0-100)
   */
  public getAccuracy(): number {
    return this.accuracy;
  }

  /**
   * Get Mean Absolute Percentage Error (MAPE)
   * Lower MAPE = better forecast
   * Formula: Mean of (|Actual - Predicted| / |Actual|) * 100
   *
   * @returns MAPE as percentage
   */
  public getMAPE(): number {
    const pointsWithActual = this.dataPoints.filter((p) => p.actual !== null);

    if (pointsWithActual.length === 0) {
      return 0;
    }

    const sumErrors = pointsWithActual.reduce((sum, point) => {
      if (point.actual === null) return sum;
      const error = Math.abs((point.actual - point.predicted) / point.actual);
      return sum + error;
    }, 0);

    return (sumErrors / pointsWithActual.length) * 100;
  }

  /**
   * Get confidence interval for a predicted value
   * Returns [lower_bound, upper_bound] at 95% confidence
   *
   * @param date - Date to get confidence interval for
   * @returns Confidence interval as [min, max], or null if outside horizon
   */
  public getConfidenceInterval(date: Date): [number, number] | null {
    const predicted = this.predict(date);

    if (predicted === null) {
      return null;
    }

    // Standard approach: use accuracy/confidence to determine interval width
    // At 95% confidence, multiply by ~1.96 (2 standard deviations)
    // Adjust based on forecast confidence
    const confidenceMultiplier = 1.96;
    const margin = predicted * (1 - this.confidence / 100) * confidenceMultiplier;

    return [predicted - margin, predicted + margin];
  }
}

/**
 * Forecasting method enumeration
 */
export enum ForecastMethod {
  LINEAR_REGRESSION = 'LINEAR_REGRESSION',
  MOVING_AVERAGE = 'MOVING_AVERAGE',
  EXPONENTIAL_SMOOTHING = 'EXPONENTIAL_SMOOTHING',
  SEASONAL = 'SEASONAL',
}

/**
 * Single data point in a forecast
 */
export interface ForecastDataPoint {
  /** Date of this data point */
  date: Date;

  /** Actual observed value (null for future dates) */
  actual: number | null;

  /** Predicted/modeled value */
  predicted: number;
}

/**
 * Forecast data transfer object (for API responses)
 */
export type ForecastDTO = Omit<Forecast, 'predict' | 'getAccuracy' | 'getMAPE' | 'getConfidenceInterval'>;
