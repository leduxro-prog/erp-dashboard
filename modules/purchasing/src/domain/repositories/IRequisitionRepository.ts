import {
  PurchaseRequisition,
  RequisitionLine,
  RequisitionApprovalStep,
  RequisitionStatus,
} from '../entities/PurchaseRequisition';

export interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface IRequisitionRepository {
  create(requisition: PurchaseRequisition): Promise<PurchaseRequisition>;
  findById(id: string): Promise<PurchaseRequisition | null>;
  findByNumber(requisitionNumber: string): Promise<PurchaseRequisition | null>;
  findByDepartment(
    departmentId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseRequisition>>;
  findByStatus(
    status: RequisitionStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseRequisition>>;
  findAll(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<PurchaseRequisition>>;
  update(id: string, updates: Partial<PurchaseRequisition>): Promise<void>;
  delete(id: string): Promise<void>;

  // Line operations
  addLine(requisitionId: string, line: RequisitionLine): Promise<void>;
  updateLine(
    requisitionId: string,
    lineId: string,
    updates: Partial<RequisitionLine>
  ): Promise<void>;
  removeLine(requisitionId: string, lineId: string): Promise<void>;

  // Approval operations
  addApprovalStep(
    requisitionId: string,
    approval: RequisitionApprovalStep
  ): Promise<void>;
  updateApprovalStep(
    requisitionId: string,
    approvalId: string,
    updates: Partial<RequisitionApprovalStep>
  ): Promise<void>;
  getApprovalSteps(requisitionId: string): Promise<RequisitionApprovalStep[]>;

  // Utility
  existsByNumber(requisitionNumber: string): Promise<boolean>;
  countByDepartment(departmentId: string): Promise<number>;
}
