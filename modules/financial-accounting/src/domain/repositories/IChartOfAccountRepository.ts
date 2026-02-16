import { ChartOfAccount, AccountType } from '../entities/ChartOfAccount';

export interface IChartOfAccountRepository {
  create(account: ChartOfAccount): Promise<ChartOfAccount>;
  update(account: ChartOfAccount): Promise<ChartOfAccount>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<ChartOfAccount | null>;
  findByCode(code: string, organizationId: string): Promise<ChartOfAccount | null>;
  findByType(type: AccountType, organizationId: string): Promise<ChartOfAccount[]>;
  findAll(organizationId: string, filters?: { isActive?: boolean; parentAccountId?: string }): Promise<ChartOfAccount[]>;
  findHierarchy(parentId: string, organizationId: string): Promise<ChartOfAccount[]>;
  getBalance(accountId: string): Promise<number>;
  updateBalance(accountId: string, debit: number, credit: number): Promise<void>;
}
