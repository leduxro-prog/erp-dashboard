export enum POStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
  REJECTED_FOR_EDIT = 'rejected_for_edit',
}

export enum POType {
  STANDARD = 'standard',
  BLANKET = 'blanket',
  FRAMEWORK = 'framework',
}

export enum POLineStatus {
  PENDING = 'pending',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export interface POContact {
  name: string;
  email: string;
  phone: string;
  department: string;
}

export interface POShippingDetails {
  addressId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryInstructions?: string;
}

export class PurchaseOrder {
  id!: string;
  poNumber!: string;
  requisitionId?: string;
  vendorId!: string;
  vendorName!: string;
  vendorCode!: string;
  status!: POStatus;
  type!: POType;
  issuedDate!: Date;
  requiredByDate!: Date;
  paymentTermsId?: string;
  paymentTerms?: string;
  incoTerms?: string;
  shippingDetails!: POShippingDetails;
  contact!: POContact;
  currency!: string;
  totalAmount!: number;
  taxAmount!: number;
  shippingCost!: number;
  discountAmount!: number;
  discountPercentage!: number;
  notes?: string;
  internalNotes?: string;
  createdBy!: string;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
  lines!: POLine[];
  revisions!: PORevision[];
  grnReferences!: string[]; // GRN IDs
  invoiceReferences!: string[]; // Vendor Invoice IDs

  constructor(data: Partial<PurchaseOrder>) {
    Object.assign(this, data);
    this.lines = data.lines || [];
    this.revisions = data.revisions || [];
    this.grnReferences = data.grnReferences || [];
    this.invoiceReferences = data.invoiceReferences || [];
  }

  canApprove(): boolean {
    return this.status === POStatus.PENDING_APPROVAL;
  }

  canSend(): boolean {
    return this.status === POStatus.APPROVED;
  }

  canCancel(): boolean {
    return ![POStatus.RECEIVED, POStatus.CLOSED, POStatus.CANCELLED].includes(
      this.status
    );
  }

  canCreateGRN(): boolean {
    return [
      POStatus.SENT,
      POStatus.PARTIALLY_RECEIVED,
      POStatus.RECEIVED,
    ].includes(this.status);
  }

  canAmend(): boolean {
    return [
      POStatus.DRAFT,
      POStatus.PENDING_APPROVAL,
      POStatus.APPROVED,
    ].includes(this.status);
  }

  getTotalAmount(): number {
    const lineTotal = this.lines.reduce((sum, line) => sum + line.getTotalAmount(), 0);
    return lineTotal + this.taxAmount + this.shippingCost - this.discountAmount;
  }

  getReceivedQuantity(lineId: string): number {
    // This would be populated from GRNs
    return 0;
  }

  getPendingQuantity(lineId: string): number {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return 0;
    return line.quantity - this.getReceivedQuantity(lineId);
  }

  updateStatus(newStatus: POStatus): void {
    const validTransitions: Record<POStatus, POStatus[]> = {
      [POStatus.DRAFT]: [POStatus.PENDING_APPROVAL, POStatus.CANCELLED],
      [POStatus.PENDING_APPROVAL]: [POStatus.APPROVED, POStatus.REJECTED_FOR_EDIT, POStatus.CANCELLED],
      [POStatus.APPROVED]: [POStatus.SENT, POStatus.CANCELLED],
      [POStatus.SENT]: [POStatus.PARTIALLY_RECEIVED, POStatus.RECEIVED, POStatus.CANCELLED],
      [POStatus.PARTIALLY_RECEIVED]: [POStatus.RECEIVED, POStatus.CANCELLED],
      [POStatus.RECEIVED]: [POStatus.CLOSED],
      [POStatus.CLOSED]: [],
      [POStatus.CANCELLED]: [],
      [POStatus.REJECTED_FOR_EDIT]: [POStatus.PENDING_APPROVAL, POStatus.CANCELLED],
    };

    if (!validTransitions[this.status]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${this.status} to ${newStatus}`
      );
    }

    this.status = newStatus;
    this.updatedAt = new Date();
  }
}

export class POLine {
  id!: string;
  poId!: string;
  lineNumber!: number;
  productId!: string;
  productCode!: string;
  productName!: string;
  description!: string;
  quantity!: number;
  unit!: string;
  unitPrice!: number;
  totalPrice!: number;
  status!: POLineStatus;
  taxRate!: number;
  taxAmount!: number;
  notes?: string;
  glAccountCode?: string;
  costCenter?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Partial<POLine>) {
    Object.assign(this, data);
  }

  getTotalAmount(): number {
    return this.quantity * this.unitPrice;
  }

  getTotalWithTax(): number {
    return this.getTotalAmount() + this.taxAmount;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.productCode?.trim()) {
      errors.push('Product code is required');
    }

    if (!this.productName?.trim()) {
      errors.push('Product name is required');
    }

    if (this.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (this.unitPrice < 0) {
      errors.push('Unit price cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export class PORevision {
  id!: string;
  poId!: string;
  revisionNumber!: number;
  previousPoVersion?: string;
  changedFields!: Record<string, { oldValue: any; newValue: any }>;
  reason!: string;
  createdBy!: string;
  createdAt!: Date;
  approvedBy?: string;
  approvedAt?: Date;
  status!: 'pending' | 'approved' | 'rejected';

  constructor(data: Partial<PORevision>) {
    Object.assign(this, data);
  }
}
