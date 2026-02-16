export enum BudgetStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export enum BudgetPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export class PurchaseBudget {
  id!: string;
  budgetCode!: string;
  departmentId!: string;
  departmentName!: string;
  period!: BudgetPeriod;
  periodStart!: Date;
  periodEnd!: Date;
  status!: BudgetStatus;
  allocatedAmount!: number;
  spentAmount!: number;
  reservedAmount!: number;
  currency!: string;
  approvedBy!: string;
  approvedAt?: Date;
  notes?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<PurchaseBudget>) {
    Object.assign(this, data);
  }

  getRemainingAmount(): number {
    return this.allocatedAmount - this.spentAmount - this.reservedAmount;
  }

  getUtilizationPercentage(): number {
    return (
      ((this.spentAmount + this.reservedAmount) / this.allocatedAmount) * 100
    );
  }

  isWithinBudget(amount: number): boolean {
    return amount <= this.getRemainingAmount();
  }

  canAllocate(amount: number): boolean {
    return this.status === BudgetStatus.ACTIVE && this.isWithinBudget(amount);
  }

  canApprove(): boolean {
    return this.status === BudgetStatus.DRAFT;
  }

  isActive(): boolean {
    const now = new Date();
    return (
      this.status === BudgetStatus.ACTIVE &&
      now >= this.periodStart &&
      now <= this.periodEnd
    );
  }
}
