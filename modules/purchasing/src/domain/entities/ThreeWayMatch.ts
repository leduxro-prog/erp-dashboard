export enum MatchStatus {
  MATCHED = 'matched',
  EXCEPTION = 'exception',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum ExceptionType {
  QUANTITY_VARIANCE = 'quantity_variance',
  PRICE_VARIANCE = 'price_variance',
  AMOUNT_VARIANCE = 'amount_variance',
  MISSING_GRN = 'missing_grn',
  MISSING_INVOICE = 'missing_invoice',
  DUPLICATE_INVOICE = 'duplicate_invoice',
  PAYMENT_TERM_MISMATCH = 'payment_term_mismatch',
  CURRENCY_MISMATCH = 'currency_mismatch',
}

export interface ToleranceConfig {
  quantityVariancePercent: number; // e.g., 5%
  priceVariancePercent: number; // e.g., 3%
  amountVarianceAmount: number; // e.g., 100
  amountVariancePercent: number; // e.g., 2%
}

export class ThreeWayMatch {
  id!: string;
  poId!: string;
  poNumber!: string;
  grnId!: string;
  grnNumber!: string;
  invoiceId!: string;
  invoiceNumber!: string;
  vendorId!: string;
  vendorName!: string;
  status!: MatchStatus;
  matchedAt!: Date;
  matchedBy!: string;
  totalPOAmount!: number;
  totalGRNAmount!: number;
  totalInvoiceAmount!: number;
  variance!: {
    quantityVariance: number;
    quantityVariancePercent: number;
    priceVariance: number;
    priceVariancePercent: number;
    amountVariance: number;
    amountVariancePercent: number;
  };
  exceptions!: MatchException[];
  notes?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<ThreeWayMatch>) {
    Object.assign(this, data);
    this.exceptions = data.exceptions || [];
  }

  hasExceptions(): boolean {
    return this.exceptions.length > 0;
  }

  canAutoApprove(tolerances: ToleranceConfig): boolean {
    if (this.exceptions.length === 0) return true;

    return this.exceptions.every((ex) =>
      this.isExceptionWithinTolerance(ex, tolerances)
    );
  }

  private isExceptionWithinTolerance(
    exception: MatchException,
    tolerances: ToleranceConfig
  ): boolean {
    switch (exception.type) {
      case ExceptionType.QUANTITY_VARIANCE:
        return (
          Math.abs(exception.variance) <=
          tolerances.quantityVariancePercent
        );
      case ExceptionType.PRICE_VARIANCE:
        return (
          Math.abs(exception.variance) <=
          tolerances.priceVariancePercent
        );
      case ExceptionType.AMOUNT_VARIANCE:
        return (
          Math.abs(exception.variance) <=
          Math.max(
            tolerances.amountVarianceAmount,
            (tolerances.amountVariancePercent / 100) * this.totalPOAmount
          )
        );
      default:
        return false;
    }
  }
}

export class MatchException {
  id!: string;
  matchId!: string;
  type!: ExceptionType;
  severity!: 'low' | 'medium' | 'high';
  description!: string;
  variance!: number; // Can be amount or percentage
  poValue?: number;
  grnValue?: number;
  invoiceValue?: number;
  status!: 'pending' | 'approved' | 'rejected' | 'escalated';
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<MatchException>) {
    Object.assign(this, data);
  }

  canResolve(): boolean {
    return this.status === 'pending';
  }

  shouldEscalate(): boolean {
    return this.severity === 'high' && this.variance > 100;
  }
}

export class MatchExceptionResolution {
  id!: string;
  exceptionId!: string;
  matchId!: string;
  action!: 'approve' | 'reject' | 'request_vendor_adjustment';
  reason!: string;
  approvedBy!: string;
  approvedAt!: Date;
  adjustmentAmount?: number;
  adjustmentReason?: string;
  vendorNotificationSent!: boolean;
  createdAt!: Date;

  constructor(data: Partial<MatchExceptionResolution>) {
    Object.assign(this, data);
  }
}
