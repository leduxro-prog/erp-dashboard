export interface CreateRequisitionDTO {
  departmentId: string;
  departmentName: string;
  requestedById: string;
  requestedByName: string;
  requestedByEmail: string;
  priority: string;
  title: string;
  description: string;
  justification: string;
  budgetCode: string;
  costCenter: string;
  requiredBy: Date;
  notes?: string;
  currency: string;
  lines: CreateRequisitionLineDTO[];
}

export interface CreateRequisitionLineDTO {
  productId?: string;
  productCode?: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  notes?: string;
}

export interface SubmitRequisitionDTO {
  requisitionId: string;
  submittedBy: string;
}

export interface ApproveRequisitionDTO {
  requisitionId: string;
  approverId: string;
  approverName: string;
  approvalLevel: number;
  comments?: string;
}

export interface RejectRequisitionDTO {
  requisitionId: string;
  approverId: string;
  approverName: string;
  rejectionReason: string;
}

export interface RequisitionResponseDTO {
  id: string;
  requisitionNumber: string;
  departmentId: string;
  departmentName: string;
  requestedById: string;
  requestedByName: string;
  requestedByEmail: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  justification: string;
  budgetCode: string;
  costCenter: string;
  requiredBy: Date;
  notes?: string;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  convertedToPOId?: string;
  lines: RequisitionLineResponseDTO[];
}

export interface RequisitionLineResponseDTO {
  id: string;
  lineNumber: number;
  productId?: string;
  productCode?: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotalPrice: number;
  notes?: string;
}

export interface PaginatedRequisitionResponseDTO {
  data: RequisitionResponseDTO[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
