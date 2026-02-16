export enum RequisitionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONVERTED_TO_PO = 'converted_to_po',
  CANCELLED = 'cancelled',
}

export enum RequisitionPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface RequisitionApprover {
  id: string;
  name: string;
  email: string;
  department: string;
  approvalLevel: number;
}

export interface RequisitionApprovalStep {
  id: string;
  requisitionId: string;
  approverLevel: number;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

export class PurchaseRequisition {
  id!: string;
  requisitionNumber!: string;
  departmentId!: string;
  departmentName!: string;
  requestedById!: string;
  requestedByName!: string;
  requestedByEmail!: string;
  status!: RequisitionStatus;
  priority!: RequisitionPriority;
  title!: string;
  description!: string;
  justification!: string;
  budgetCode!: string;
  costCenter!: string;
  requiredBy!: Date;
  notes?: string;
  totalAmount!: number;
  currency!: string;
  createdAt!: Date;
  updatedAt!: Date;
  convertedToPOId?: string;
  lines!: RequisitionLine[];
  approvals!: RequisitionApprovalStep[];

  constructor(data: Partial<PurchaseRequisition>) {
    Object.assign(this, data);
  }

  canSubmit(): boolean {
    return this.status === RequisitionStatus.DRAFT && this.lines.length > 0;
  }

  canApprove(): boolean {
    return this.status === RequisitionStatus.SUBMITTED;
  }

  canConvertToPO(): boolean {
    return this.status === RequisitionStatus.APPROVED;
  }

  canCancel(): boolean {
    return [RequisitionStatus.DRAFT, RequisitionStatus.SUBMITTED].includes(
      this.status
    );
  }

  getTotalAmount(): number {
    return this.lines.reduce((sum, line) => sum + line.getTotalAmount(), 0);
  }
}

export class RequisitionLine {
  id!: string;
  requisitionId!: string;
  lineNumber!: number;
  productId?: string;
  productCode?: string;
  productName!: string;
  description!: string;
  quantity!: number;
  unit!: string;
  estimatedUnitPrice!: number;
  estimatedTotalPrice!: number;
  notes?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<RequisitionLine>) {
    Object.assign(this, data);
  }

  getTotalAmount(): number {
    return this.quantity * this.estimatedUnitPrice;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.productName?.trim()) {
      errors.push('Product name is required');
    }

    if (this.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (this.estimatedUnitPrice < 0) {
      errors.push('Unit price cannot be negative');
    }

    if (!this.unit?.trim()) {
      errors.push('Unit is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
