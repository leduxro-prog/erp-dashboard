export interface CreateThreeWayMatchDTO {
  poId: string;
  grnId: string;
  invoiceId: string;
  matchedBy: string;
  tolerances?: {
    quantityVariancePercent?: number;
    priceVariancePercent?: number;
    amountVarianceAmount?: number;
    amountVariancePercent?: number;
  };
}

export interface ResolveExceptionDTO {
  matchId: string;
  exceptionId: string;
  action: 'approve' | 'reject' | 'request_vendor_adjustment';
  reason: string;
  approvedBy: string;
  adjustmentAmount?: number;
}

export interface MatchExceptionResponseDTO {
  id: string;
  matchId: string;
  type: string;
  severity: string;
  description: string;
  variance: number;
  poValue?: number;
  grnValue?: number;
  invoiceValue?: number;
  status: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreeWayMatchResponseDTO {
  id: string;
  poId: string;
  poNumber: string;
  grnId: string;
  grnNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  matchedAt: Date;
  matchedBy: string;
  totalPOAmount: number;
  totalGRNAmount: number;
  totalInvoiceAmount: number;
  variance: VarianceResponseDTO;
  exceptions: MatchExceptionResponseDTO[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VarianceResponseDTO {
  quantityVariance: number;
  quantityVariancePercent: number;
  priceVariance: number;
  priceVariancePercent: number;
  amountVariance: number;
  amountVariancePercent: number;
}

export interface PaginatedMatchResponseDTO {
  data: ThreeWayMatchResponseDTO[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface MatchAnalyticsDTO {
  totalMatches: number;
  matchedCount: number;
  exceptionCount: number;
  resolvedCount: number;
  pendingExceptionsCount: number;
  averageQuantityVariance: number;
  averagePriceVariance: number;
  averageAmountVariance: number;
  matchRate: number;
}
