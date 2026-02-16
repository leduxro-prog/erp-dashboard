import { DataSource, Repository } from 'typeorm';
import { CreditTransaction, CreditTransactionType } from '../../domain/entities/CreditTransaction';
import { ICreditTransactionRepository, CreditTransactionFilters } from '../../domain/repositories/ICreditTransactionRepository';
import { PaginationParams, PaginatedResult } from '../../domain/repositories/IRegistrationRepository';
import { CreditTransactionEntity } from '../entities/CreditTransactionEntity';

/**
 * TypeORM Implementation of Credit Transaction Repository
 */
export class TypeOrmCreditTransactionRepository implements ICreditTransactionRepository {
  private repository: Repository<CreditTransactionEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(CreditTransactionEntity);
  }

  async save(transaction: CreditTransaction): Promise<CreditTransaction> {
    const entity = new CreditTransactionEntity();
    entity.id = transaction.id;
    entity.customerId = transaction.customerId;
    entity.type = transaction.type as any;
    entity.amount = transaction.amount;
    entity.balanceBefore = transaction.balanceBefore;
    entity.balanceAfter = transaction.balanceAfter;
    entity.description = transaction.description;
    entity.description = transaction.description;
    // entity.referenceId = transaction.referenceId; // Domain doesn't have referenceId
    // entity.referenceType = transaction.referenceType; // Domain doesn't have referenceType

    // Map from domain specific fields if available
    if (transaction.orderId) {
      entity.referenceId = transaction.orderId;
      entity.referenceType = 'ORDER';
    } else {
      // For other types, maybe use metadata or default?
      entity.referenceId = (transaction as any).referenceId || null;
      entity.referenceType = (transaction as any).referenceType || null;
    }
    // metadata is not in domain entity strictly but can be mapped if added
    entity.createdAt = transaction.createdAt;
    entity.updatedAt = new Date();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<CreditTransaction | undefined> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByCustomer(
    customerId: string,
    pagination: PaginationParams,
    filters?: CreditTransactionFilters
  ): Promise<PaginatedResult<CreditTransaction>> {
    let query = this.repository.createQueryBuilder('txn').where('txn.customerId = :customerId', {
      customerId,
    });

    if (filters?.type) {
      query = query.andWhere('txn.type = :type', { type: filters.type });
    }

    if (filters?.minAmount !== undefined) {
      query = query.andWhere('txn.amount >= :minAmount', { minAmount: filters.minAmount });
    }

    if (filters?.maxAmount !== undefined) {
      query = query.andWhere('txn.amount <= :maxAmount', { maxAmount: filters.maxAmount });
    }

    if (filters?.fromDate) {
      query = query.andWhere('txn.createdAt >= :fromDate', { fromDate: filters.fromDate });
    }

    if (filters?.toDate) {
      query = query.andWhere('txn.createdAt <= :toDate', { toDate: filters.toDate });
    }

    const page = pagination.page;
    const limit = pagination.limit;
    const [entities, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('txn.createdAt', 'DESC')
      .getManyAndCount();

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findLatest(customerId: string): Promise<CreditTransaction | undefined> {
    const entity = await this.repository.findOne({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByOrderId(orderId: string): Promise<CreditTransaction[]> {
    const entities = await this.repository.find({
      where: { referenceId: orderId, referenceType: 'ORDER' },
      order: { createdAt: 'DESC' },
    });
    return entities.map(e => this.toDomain(e));
  }

  async getTotalUsage(customerId: string, fromDate: Date, toDate: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('txn')
      .select('SUM(txn.amount)', 'total')
      .where('txn.customerId = :customerId', { customerId })
      .andWhere('txn.type = :type', { type: 'DEBIT' }) // Assuming DEBIT is usage
      .andWhere('txn.createdAt >= :fromDate', { fromDate })
      .andWhere('txn.createdAt <= :toDate', { toDate })
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  async countByCustomer(customerId: string): Promise<number> {
    return this.repository.countBy({ customerId });
  }

  async findByType(
    customerId: string,
    type: CreditTransactionType,
    pagination: PaginationParams
  ): Promise<PaginatedResult<CreditTransaction>> {
    const [entities, total] = await this.repository.findAndCount({
      where: { customerId, type: type as any },
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

  private toDomain(entity: CreditTransactionEntity): CreditTransaction {
    return new CreditTransaction(
      entity.id,
      entity.customerId,
      entity.type as CreditTransactionType,
      entity.amount,
      entity.balanceBefore,
      entity.balanceAfter,
      entity.createdBy || 'system', // Default if missing
      entity.description || '',
      entity.referenceType === 'ORDER' ? entity.referenceId : undefined,
      entity.createdAt
    );
  }
}
