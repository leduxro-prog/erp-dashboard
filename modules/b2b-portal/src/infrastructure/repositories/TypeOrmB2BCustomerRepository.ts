import { DataSource, Repository } from 'typeorm';
import { B2BCustomer, B2BCustomerTier } from '../../domain/entities/B2BCustomer';
import { IB2BCustomerRepository, CustomerFilters } from '../../domain/repositories/IB2BCustomerRepository';
import { PaginationParams, PaginatedResult } from '../../domain/repositories/IRegistrationRepository';
import { B2BCustomerEntity } from '../entities/B2BCustomerEntity';

/**
 * TypeORM Implementation of B2B Customer Repository
 */
export class TypeOrmB2BCustomerRepository implements IB2BCustomerRepository {
  private repository: Repository<B2BCustomerEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(B2BCustomerEntity);
  }

  async save(customer: B2BCustomer): Promise<B2BCustomer> {
    const entity = new B2BCustomerEntity();
    entity.id = customer.id;
    entity.registrationId = customer.registrationId;
    entity.companyName = customer.companyName;
    entity.cui = customer.cui;
    entity.tier = customer.tier as any;
    entity.creditLimit = customer.creditLimit;
    entity.usedCredit = customer.usedCredit || 0;
    entity.paymentTermsDays = customer.paymentTermsDays || 0;
    entity.isActive = customer.isActive ?? true;
    entity.totalOrders = customer.totalOrders || 0;
    entity.totalSpent = customer.totalSpent || 0;
    entity.salesRepId = customer.salesRepId;
    entity.createdAt = customer.createdAt;
    entity.updatedAt = new Date();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<B2BCustomer | undefined> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByCui(cui: string): Promise<B2BCustomer | undefined> {
    const entity = await this.repository.findOne({ where: { cui } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByRegistrationId(registrationId: string): Promise<B2BCustomer | undefined> {
    const entity = await this.repository.findOne({ where: { registrationId } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByTier(
    tier: B2BCustomerTier,
    pagination: PaginationParams
  ): Promise<PaginatedResult<B2BCustomer>> {
    const [entities, total] = await this.repository.findAndCount({
      where: { tier: tier as any, isActive: true },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findActive(pagination: PaginationParams): Promise<PaginatedResult<B2BCustomer>> {
    const [entities, total] = await this.repository.findAndCount({
      where: { isActive: true },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async search(
    filters: CustomerFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<B2BCustomer>> {
    let query = this.repository.createQueryBuilder('cust');

    if (filters.tier) {
      query = query.where('cust.tier = :tier', { tier: filters.tier });
    }

    if (filters.isActive !== undefined) {
      query = query.andWhere('cust.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.andWhere(
        '(cust.companyName ILIKE :search OR cust.cui ILIKE :search)',
        { search: searchTerm }
      );
    }

    if (filters.minTotalSpent !== undefined) {
      query = query.andWhere('cust.totalSpent >= :minSpent', { minSpent: filters.minTotalSpent });
    }

    if (filters.maxTotalSpent !== undefined) {
      query = query.andWhere('cust.totalSpent <= :maxSpent', { maxSpent: filters.maxTotalSpent });
    }

    const page = pagination.page;
    const limit = pagination.limit;
    const [entities, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('cust.createdAt', 'DESC')
      .getManyAndCount();

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateCredit(id: string, newLimit: number): Promise<B2BCustomer> {
    await this.repository.update({ id }, { creditLimit: newLimit, updatedAt: new Date() });
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new Error(`Customer with ID ${id} not found`);
    }
    return this.toDomain(entity);
  }

  async updateTier(id: string, newTier: B2BCustomerTier): Promise<B2BCustomer> {
    await this.repository.update({ id }, { tier: newTier as any, updatedAt: new Date() });
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new Error(`Customer with ID ${id} not found`);
    }
    return this.toDomain(entity);
  }

  async updateStatus(id: string, isActive: boolean): Promise<B2BCustomer> {
    await this.repository.update({ id }, { isActive, updatedAt: new Date() });
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new Error(`Customer with ID ${id} not found`);
    }
    return this.toDomain(entity);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async countActive(): Promise<number> {
    return this.repository.countBy({ isActive: true });
  }

  async findDueForRecalculation(
    pagination: PaginationParams
  ): Promise<PaginatedResult<B2BCustomer>> {
    const [entities, total] = await this.repository.findAndCount({
      where: undefined, // Would need custom query for "orders in last 30 days"
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { lastOrderAt: 'DESC' },
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  private toDomain(entity: B2BCustomerEntity): B2BCustomer {
    return new B2BCustomer(
      entity.id,
      entity.registrationId,
      entity.companyName,
      entity.cui,
      entity.tier as B2BCustomerTier,
      entity.creditLimit,
      entity.paymentTermsDays || 0, // 7
      entity.salesRepId,            // 8
      entity.usedCredit || 0,       // 9
      entity.isActive,              // 10
      entity.createdAt,             // 11
      entity.updatedAt,             // 12
      entity.totalOrders,           // 13
      entity.totalSpent             // 14
    );
  }
}
