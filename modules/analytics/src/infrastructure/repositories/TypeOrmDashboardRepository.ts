import { DataSource } from 'typeorm';
import { Dashboard } from '../../domain/entities/Dashboard';
import { IDashboardRepository, PaginatedResult } from '../../domain/repositories/IDashboardRepository';

export class TypeOrmDashboardRepository implements IDashboardRepository {
  constructor(private _dataSource: DataSource) {
    console.log(this._dataSource.isInitialized);
  }

  async save(dashboard: Dashboard): Promise<Dashboard> {
    return dashboard;
  }

  async findById(_id: string): Promise<Dashboard | null> {
    return null;
  }

  async findByUserId(_userId: string): Promise<Dashboard | null> {
    return null;
  }

  async findByOwner(
    _ownerId: string,
    page: number = 0,
    pageSize: number = 20
  ): Promise<PaginatedResult<Dashboard>> {
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

  async findShared(
    page: number = 0,
    pageSize: number = 20
  ): Promise<PaginatedResult<Dashboard>> {
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

  async findDefault(_userId: string): Promise<Dashboard | null> {
    return null;
  }

  async delete(_id: string): Promise<void> {
    return;
  }
}
