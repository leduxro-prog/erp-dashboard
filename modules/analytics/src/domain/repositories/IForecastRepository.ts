import { Forecast } from '../entities/Forecast';

/**
 * Forecast Repository Interface
 *
 * Defines persistence operations for Forecast entities.
 * Implementations handle storage and retrieval of forecasts
 * from a database.
 *
 * @interface IForecastRepository
 */
export interface IForecastRepository {
  /**
   * Save a forecast (create or update)
   * If forecast.id already exists, updates it. Otherwise creates new.
   *
   * @param forecast - Forecast to save
   * @returns Promise resolving to saved forecast
   * @throws Error if save fails
   */
  save(forecast: Forecast): Promise<Forecast>;

  /**
   * Find all forecasts for a specific metric type
   * Returns the complete forecast history for a metric
   *
   * @param metricType - Metric type to find forecasts for
   * @returns Promise resolving to array of forecasts
   */
  findByMetric(metricType: string): Promise<Forecast[]>;

  /**
   * Find the latest forecast for a metric type
   * Used to get the current/most recent forecast
   *
   * @param metricType - Metric type
   * @returns Promise resolving to latest forecast, or null if none found
   */
  findLatest(metricType: string): Promise<Forecast | null>;

  /**
   * Delete old forecasts (retention policy)
   * Keep only recent forecasts to avoid stale data
   *
   * @param beforeDate - Delete forecasts generated before this date
   * @returns Promise resolving to number of deleted records
   */
  deleteOlderThan(beforeDate: Date): Promise<number>;
}
