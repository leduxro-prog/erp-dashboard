export class CostCenter {
  id!: string;
  organizationId!: string;
  code!: string;
  name!: string;
  description?: string;
  managerId?: string;
  budget?: number;
  isActive!: boolean;
  metadata!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: string;
  updatedBy!: string;

  constructor(data: Partial<CostCenter>) {
    Object.assign(this, data);
    this.isActive = this.isActive ?? true;
    this.metadata = this.metadata ?? {};
  }

  validate(): void {
    if (!this.organizationId) throw new Error('Organization ID is required');
    if (!this.code) throw new Error('Cost center code is required');
    if (!this.name) throw new Error('Cost center name is required');
    if (this.code.length > 50) throw new Error('Cost center code cannot exceed 50 characters');
    if (this.name.length > 255) throw new Error('Cost center name cannot exceed 255 characters');
    if (this.budget && this.budget < 0) throw new Error('Budget cannot be negative');
  }

  isBudgetExceeded(spent: number): boolean {
    if (!this.budget) return false;
    return spent > this.budget;
  }

  getBudgetUtilization(spent: number): number {
    if (!this.budget) return 0;
    return (spent / this.budget) * 100;
  }
}
