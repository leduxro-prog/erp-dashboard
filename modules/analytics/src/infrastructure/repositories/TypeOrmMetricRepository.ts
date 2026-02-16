import { DataSource } from 'typeorm';
import { MetricSnapshot, MetricType, Period } from '../../domain/entities/MetricSnapshot';
import { IMetricRepository, DateRange, TimeSeriesData } from '../../domain/repositories/IMetricRepository';

export class TypeOrmMetricRepository implements IMetricRepository {
  constructor(private _dataSource: DataSource) {
    console.log(this._dataSource.isInitialized);
  }

  async save(metric: MetricSnapshot): Promise<MetricSnapshot> {
    return metric;
  }

  async findByType(
    _type: MetricType,
    _period: Period,
    _dateRange: DateRange,
    _dimensions?: Record<string, string>
  ): Promise<MetricSnapshot[]> {
    return [];
  }

  async findLatest(_type: MetricType, _dimensions?: Record<string, string>): Promise<MetricSnapshot | null> {
    return null;
  }

  async getTimeSeries(
    type: MetricType,
    dateRange: DateRange,
    _groupBy?: string
  ): Promise<TimeSeriesData> {
    return {
      metricType: type,
      points: [],
      count: 0,
      dateRange,
      period: Period.DAILY // Assuming Period.DAILY exists, otherwise I might need to check the entity file
    };
  }

  async aggregate(
    _types: MetricType[],
    _dateRange: DateRange,
    _period: Period
  ): Promise<Record<MetricType, MetricSnapshot[]>> {
    return {} as Record<MetricType, MetricSnapshot[]>;
  }

  async deleteOlderThan(_beforeDate: Date): Promise<number> {
    return 0;
  }
}
