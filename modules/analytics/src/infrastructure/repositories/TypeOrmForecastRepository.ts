import { DataSource } from 'typeorm';
import { Forecast } from '../../domain/entities/Forecast';
import { IForecastRepository } from '../../domain/repositories/IForecastRepository';

export class TypeOrmForecastRepository implements IForecastRepository {
  constructor(private _dataSource: DataSource) {
    console.log(this._dataSource.isInitialized);
  }

  async save(forecast: Forecast): Promise<Forecast> {
    return forecast;
  }

  async findByMetric(_metricType: string): Promise<Forecast[]> {
    return [];
  }

  async findLatest(_metricType: string): Promise<Forecast | null> {
    return null;
  }

  async deleteOlderThan(_beforeDate: Date): Promise<number> {
    return 0;
  }
}
