import { Repository } from 'typeorm';
import { ChartOfAccount, AccountType } from '../../domain/entities/ChartOfAccount';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { ChartOfAccountEntity } from '../entities/ChartOfAccountEntity';

export class ChartOfAccountRepository implements IChartOfAccountRepository {
  constructor(private ormRepository: Repository<ChartOfAccountEntity>) {}

  async create(account: ChartOfAccount): Promise<ChartOfAccount> {
    const entity = this.ormRepository.create({
      id: account.id,
      organizationId: account.organizationId,
      code: account.code,
      name: account.name,
      description: account.description,
      accountType: account.accountType,
      parentAccountId: account.parentAccountId,
      isHeader: account.isHeader,
      isActive: account.isActive,
      costCenterCode: account.costCenterCode,
      taxApplicable: account.taxApplicable,
      accumulatedDepreciation: account.accumulatedDepreciation,
      balance: account.balance,
      metadata: account.metadata,
      createdBy: account.createdBy,
      updatedBy: account.updatedBy,
    });

    const saved = await this.ormRepository.save(entity);
    return this.toDomain(saved);
  }

  async update(account: ChartOfAccount): Promise<ChartOfAccount> {
    await this.ormRepository.update(account.id, {
      name: account.name,
      description: account.description,
      parentAccountId: account.parentAccountId,
      isHeader: account.isHeader,
      isActive: account.isActive,
      costCenterCode: account.costCenterCode,
      taxApplicable: account.taxApplicable,
      accumulatedDepreciation: account.accumulatedDepreciation,
      balance: account.balance,
      metadata: account.metadata,
      updatedBy: account.updatedBy,
    });

    const updated = await this.ormRepository.findOneBy({ id: account.id });
    if (!updated) throw new Error('Account not found after update');
    return this.toDomain(updated);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.ormRepository.delete({ id, organizationId });
  }

  async findById(id: string, organizationId: string): Promise<ChartOfAccount | null> {
    const entity = await this.ormRepository.findOneBy({ id, organizationId });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCode(code: string, organizationId: string): Promise<ChartOfAccount | null> {
    const entity = await this.ormRepository.findOneBy({ code, organizationId });
    return entity ? this.toDomain(entity) : null;
  }

  async findByType(type: AccountType, organizationId: string): Promise<ChartOfAccount[]> {
    const entities = await this.ormRepository.findBy({ accountType: type, organizationId });
    return entities.map(e => this.toDomain(e));
  }

  async findAll(organizationId: string, filters?: { isActive?: boolean; parentAccountId?: string }): Promise<ChartOfAccount[]> {
    const query = this.ormRepository.createQueryBuilder('account').where('account.organizationId = :orgId', {
      orgId: organizationId,
    });

    if (filters?.isActive !== undefined) {
      query.andWhere('account.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters?.parentAccountId) {
      query.andWhere('account.parentAccountId = :parentId', { parentId: filters.parentAccountId });
    }

    const entities = await query.getMany();
    return entities.map(e => this.toDomain(e));
  }

  async findHierarchy(parentId: string, organizationId: string): Promise<ChartOfAccount[]> {
    const entities = await this.ormRepository.find({
      where: { parentAccountId: parentId, organizationId },
    });
    return entities.map(e => this.toDomain(e));
  }

  async getBalance(accountId: string): Promise<number> {
    const entity = await this.ormRepository.findOneBy({ id: accountId });
    return entity?.balance ?? 0;
  }

  async updateBalance(accountId: string, debit: number, credit: number): Promise<void> {
    const account = await this.ormRepository.findOneBy({ id: accountId });
    if (!account) throw new Error('Account not found');

    const normalBalance = ['ASSET', 'EXPENSE'].includes(account.accountType) ? 'DEBIT' : 'CREDIT';

    if (normalBalance === 'DEBIT') {
      account.balance += debit - credit;
    } else {
      account.balance += credit - debit;
    }

    await this.ormRepository.save(account);
  }

  private toDomain(entity: ChartOfAccountEntity): ChartOfAccount {
    return new ChartOfAccount({
      id: entity.id,
      organizationId: entity.organizationId,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      accountType: entity.accountType as AccountType,
      parentAccountId: entity.parentAccountId,
      isHeader: entity.isHeader,
      isActive: entity.isActive,
      costCenterCode: entity.costCenterCode,
      taxApplicable: entity.taxApplicable,
      accumulatedDepreciation: entity.accumulatedDepreciation,
      balance: parseFloat(entity.balance.toString()),
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    });
  }
}
