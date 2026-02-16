export interface CreatePurchaseOrderDTO {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  requisitionId?: string;
  issuedDate: Date;
  requiredByDate: Date;
  paymentTermsId?: string;
  paymentTerms?: string;
  incoTerms?: string;
  shippingDetails: ShippingDetailsDTO;
  contact: ContactDTO;
  currency: string;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  discountPercentage: number;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  lines: CreatePOLineDTO[];
}

export interface CreatePOLineDTO {
  productId: string;
  productCode: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  notes?: string;
  glAccountCode?: string;
  costCenter?: string;
}

export interface ShippingDetailsDTO {
  addressId: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryInstructions?: string;
}

export interface ContactDTO {
  name: string;
  email: string;
  phone: string;
  department: string;
}

export interface ApprovePurchaseOrderDTO {
  poId: string;
  approvedBy: string;
}

export interface SendPurchaseOrderDTO {
  poId: string;
  comments?: string;
}

export interface AmendPurchaseOrderDTO {
  poId: string;
  changes: Record<string, any>;
  reason: string;
  amendedBy: string;
}

export interface UpdatePOLineDTO {
  poId: string;
  lineId: string;
  updates: Partial<CreatePOLineDTO>;
}

export interface PurchaseOrderResponseDTO {
  id: string;
  poNumber: string;
  requisitionId?: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  status: string;
  type: string;
  issuedDate: Date;
  requiredByDate: Date;
  paymentTerms?: string;
  incoTerms?: string;
  shippingDetails: ShippingDetailsDTO;
  contact: ContactDTO;
  currency: string;
  totalAmount: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  discountPercentage: number;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lines: POLineResponseDTO[];
  revisions: PORevisionResponseDTO[];
}

export interface POLineResponseDTO {
  id: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  status: string;
  taxRate: number;
  taxAmount: number;
  notes?: string;
  glAccountCode?: string;
  costCenter?: string;
}

export interface PORevisionResponseDTO {
  id: string;
  revisionNumber: number;
  changedFields: Record<string, any>;
  reason: string;
  createdBy: string;
  createdAt: Date;
  status: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface PaginatedPOResponseDTO {
  data: PurchaseOrderResponseDTO[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
