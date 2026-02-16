import { DataSource } from 'typeorm';
import { Report } from '../../domain/entities/Report';
import { IReportRepository, ReportFilter } from '../../domain/repositories/IReportRepository';
import { PaginatedResult } from '../../domain/repositories/IDashboardRepository';

export class TypeOrmReportRepository implements IReportRepository {
  constructor(private _dataSource: DataSource) {
    console.log(this._dataSource.isInitialized);
  }

  async save(report: Report): Promise<Report> {
    return report;
  }

  async findById(_id: string): Promise<Report | null> {
    return null;
  }

  async findByType(_type: string): Promise<Report[]> {
    return [];
  }

  async findAll(
    _filters?: ReportFilter,
    page: number = 0,
    pageSize: number = 20
  ): Promise<PaginatedResult<Report>> {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    };
  }

  async findScheduled(): Promise<Report[]> {
    return [];
  }

  async updateLastGenerated(
    _reportId: string,
    _lastGeneratedAt: Date,
    _incrementCount: boolean = true
  ): Promise<void> {
    return;
  }

  async delete(_id: string): Promise<void> {
    return;
  }
}
