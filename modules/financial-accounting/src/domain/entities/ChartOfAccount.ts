export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  CONTRA_ASSET = 'CONTRA_ASSET',
  CONTRA_LIABILITY = 'CONTRA_LIABILITY',
}

export class ChartOfAccount {
  id!: string;
  organizationId!: string;
  code!: string;
  name!: string;
  description?: string;
  accountType!: AccountType;
  parentAccountId?: string;
  isHeader!: boolean;
  isActive!: boolean;
  costCenterCode?: string;
  taxApplicable!: boolean;
  accumulatedDepreciation!: boolean;
  balance!: number;
  metadata!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: string;
  updatedBy!: string;

  constructor(data: Partial<ChartOfAccount>) {
    Object.assign(this, data);
    this.isActive = this.isActive ?? true;
    this.isHeader = this.isHeader ?? false;
    this.taxApplicable = this.taxApplicable ?? false;
    this.accumulatedDepreciation = this.accumulatedDepreciation ?? false;
    this.balance = this.balance ?? 0;
    this.metadata = this.metadata ?? {};
  }

  validate(): void {
    if (!this.organizationId) throw new Error('Organization ID is required');
    if (!this.code) throw new Error('Account code is required');
    if (!this.name) throw new Error('Account name is required');
    if (!this.accountType) throw new Error('Account type is required');
    if (!Object.values(AccountType).includes(this.accountType)) {
      throw new Error(`Invalid account type: ${this.accountType}`);
    }
    if (this.code.length > 50) throw new Error('Account code cannot exceed 50 characters');
    if (this.name.length > 255) throw new Error('Account name cannot exceed 255 characters');
  }

  isAssetAccount(): boolean {
    return [AccountType.ASSET, AccountType.CONTRA_LIABILITY].includes(this.accountType);
  }

  isLiabilityAccount(): boolean {
    return [AccountType.LIABILITY, AccountType.CONTRA_ASSET].includes(this.accountType);
  }

  isRevenueAccount(): boolean {
    return this.accountType === AccountType.REVENUE;
  }

  isExpenseAccount(): boolean {
    return this.accountType === AccountType.EXPENSE;
  }

  isEquityAccount(): boolean {
    return this.accountType === AccountType.EQUITY;
  }

  getNormalBalance(): 'DEBIT' | 'CREDIT' {
    switch (this.accountType) {
      case AccountType.ASSET:
      case AccountType.EXPENSE:
        return 'DEBIT';
      case AccountType.LIABILITY:
      case AccountType.REVENUE:
      case AccountType.EQUITY:
        return 'CREDIT';
      case AccountType.CONTRA_ASSET:
      case AccountType.CONTRA_LIABILITY:
        return this.accountType === AccountType.CONTRA_ASSET ? 'CREDIT' : 'DEBIT';
      default:
        return 'DEBIT';
    }
  }

  updateBalance(debit: number = 0, credit: number = 0): void {
    if (this.getNormalBalance() === 'DEBIT') {
      this.balance += debit - credit;
    } else {
      this.balance += credit - debit;
    }
  }
}
