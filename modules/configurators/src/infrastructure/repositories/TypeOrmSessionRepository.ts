import { DataSource, Repository } from 'typeorm';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

export class TypeOrmSessionRepository implements ISessionRepository {
  constructor(private dataSource: DataSource) { }

  async save(session: ConfiguratorSession): Promise<ConfiguratorSession> {
    return session;
  }

  async findById(id: string): Promise<ConfiguratorSession | undefined> {
    return undefined;
  }

  async findByToken(token: string): Promise<ConfiguratorSession | undefined> {
    return undefined;
  }

  async findByCustomer(customerId: number, page: number, limit: number): Promise<{ items: ConfiguratorSession[]; total: number; page: number; limit: number }> {
    return { items: [], total: 0, page, limit };
  }

  async findActive(): Promise<ConfiguratorSession[]> {
    return [];
  }

  async deleteExpired(): Promise<number> {
    return 0;
  }
}
