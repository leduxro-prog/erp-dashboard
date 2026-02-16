export enum GRNStatus {
  DRAFT = 'draft',
  PENDING_INSPECTION = 'pending_inspection',
  INSPECTED = 'inspected',
  ACCEPTED = 'accepted',
  PARTIAL_REJECTION = 'partial_rejection',
  FULLY_REJECTED = 'fully_rejected',
  CLOSED = 'closed',
}

export enum GRNLineStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  PARTIAL_REJECTION = 'partial_rejection',
}

export interface InspectionDetails {
  inspectorId: string;
  inspectorName: string;
  inspectedAt: Date;
  remarks?: string;
  qualityOk: boolean;
  defectDetails?: string;
}

export interface ReceivingDetails {
  receivedAt: Date;
  receivedBy: string;
  receiverName: string;
  location: string;
  remarks?: string;
}

export class GoodsReceiptNote {
  id!: string;
  grnNumber!: string;
  poId!: string;
  poNumber!: string;
  vendorId!: string;
  vendorName!: string;
  grn_date!: Date;
  receiveDate!: Date;
  status!: GRNStatus;
  waybillNumber?: string;
  containerNumber?: string;
  totalQuantity!: number;
  totalWeight?: number;
  totalVolume?: number;
  currency!: string;
  totalReceivedAmount!: number;
  notes?: string;
  inspection?: InspectionDetails;
  receivingDetails!: ReceivingDetails;
  createdAt!: Date;
  updatedAt!: Date;
  lines!: GRNLine[];
  returnedItems!: ReturnItem[];

  constructor(data: Partial<GoodsReceiptNote>) {
    Object.assign(this, data);
    this.lines = data.lines || [];
    this.returnedItems = data.returnedItems || [];
  }

  canAccept(): boolean {
    return [GRNStatus.INSPECTED, GRNStatus.DRAFT].includes(this.status);
  }

  canReject(): boolean {
    return [GRNStatus.DRAFT, GRNStatus.INSPECTED].includes(this.status);
  }

  canReturn(): boolean {
    return [GRNStatus.ACCEPTED, GRNStatus.PARTIAL_REJECTION].includes(
      this.status
    );
  }

  getTotalQuantity(): number {
    return this.lines.reduce((sum, line) => sum + line.quantityReceived, 0);
  }

  hasDiscrepancies(): boolean {
    return this.lines.some(
      (line) =>
        Math.abs(line.quantityReceived - line.quantityOrdered) > 0 ||
        Math.abs(line.priceReceived - line.priceOrdered) > 0
    );
  }

  getVariancePercentage(lineId: string): number {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return 0;

    const variance =
      ((line.quantityReceived - line.quantityOrdered) /
        line.quantityOrdered) *
      100;
    return Math.abs(variance);
  }
}

export class GRNLine {
  id!: string;
  grnId!: string;
  poLineId!: string;
  lineNumber!: number;
  productId!: string;
  productCode!: string;
  productName!: string;
  quantityOrdered!: number;
  quantityReceived!: number;
  quantityRejected!: number;
  unit!: string;
  priceOrdered!: number;
  priceReceived!: number;
  status!: GRNLineStatus;
  batchNumber?: string;
  expiryDate?: Date;
  serialNumbers?: string[];
  remarks?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<GRNLine>) {
    Object.assign(this, data);
  }

  getTotalReceivedAmount(): number {
    return this.quantityReceived * this.priceReceived;
  }

  hasVariance(): boolean {
    return (
      this.quantityReceived !== this.quantityOrdered ||
      Math.abs(this.priceReceived - this.priceOrdered) > 0.01
    );
  }

  getQuantityVariance(): number {
    return this.quantityReceived - this.quantityOrdered;
  }

  getPriceVariance(): number {
    return (this.priceReceived - this.priceOrdered) * this.quantityReceived;
  }
}

export class ReturnItem {
  id!: string;
  grnId!: string;
  grnLineId!: string;
  productId!: string;
  productName!: string;
  quantityReturned!: number;
  unit!: string;
  reason!: string;
  returnDate!: Date;
  status!: 'requested' | 'approved' | 'picked' | 'shipped' | 'received_back';
  approvedBy?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<ReturnItem>) {
    Object.assign(this, data);
  }
}
