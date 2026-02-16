import {
  PurchaseBudget,
  BudgetStatus,
  BudgetPeriod,
} from '../entities/Budget';
import { IPaginationOptions, IPaginatedResult } from './IRequisitionRepository';

export interface IBudgetRepository {
  create(budget: PurchaseBudget): Promise<PurchaseBudget>;
  findById(id: string): Promise<PurchaseBudget | null>;
  findByCode(budgetCode: string): Promise<PurchaseBudget | null>;
  findByDepartment(
    departmentId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseBudget>>;
  findByStatus(
    status: BudgetStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseBudget>>;
  findByPeriod(
    period: BudgetPeriod,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseBudget>>;
  findActive(
    departmentId?: string
  ): Promise<PurchaseBudget[]>;
  findAll(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseBudget>>;
  update(id: string, updates: Partial<PurchaseBudget>): Promise<void>;
  delete(id: string): Promise<void>;

  // Utility
  existsByCode(budgetCode: string): Promise<boolean>;
  countByDepartment(departmentId: string): Promise<number>;
  countByStatus(status: BudgetStatus): Promise<number>;
}
