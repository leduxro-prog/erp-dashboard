export interface CreateGRNDTO {
  poId: string;
  vendorId: string;
  vendorName: string;
  receiveDate: Date;
  waybillNumber?: string;
  containerNumber?: string;
  totalQuantity: number;
  totalWeight?: number;
  totalVolume?: number;
  currency: string;
  notes?: string;
  receivingDetails: ReceivingDetailsDTO;
  lines: CreateGRNLineDTO[];
}

export interface CreateGRNLineDTO {
  poLineId: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRejected: number;
  unit: string;
  priceOrdered: number;
  priceReceived: number;
  batchNumber?: string;
  expiryDate?: Date;
  serialNumbers?: string[];
  remarks?: string;
}

export interface ReceivingDetailsDTO {
  receivedAt: Date;
  receivedBy: string;
  receiverName: string;
  location: string;
  remarks?: string;
}

export interface InspectGRNDTO {
  grnId: string;
  inspectorId: string;
  inspectorName: string;
  qualityOk: boolean;
  remarks?: string;
  defectDetails?: string;
}

export interface RequestReturnDTO {
  grnId: string;
  grnLineId: string;
  quantityToReturn: number;
  reason: string;
}

export interface GRNResponseDTO {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  grn_date: Date;
  receiveDate: Date;
  status: string;
  waybillNumber?: string;
  containerNumber?: string;
  totalQuantity: number;
  totalWeight?: number;
  totalVolume?: number;
  currency: string;
  totalReceivedAmount: number;
  notes?: string;
  inspection?: InspectionResponseDTO;
  receivingDetails: ReceivingDetailsDTO;
  createdAt: Date;
  updatedAt: Date;
  lines: GRNLineResponseDTO[];
  returnedItems: ReturnItemResponseDTO[];
}

export interface InspectionResponseDTO {
  inspectorId: string;
  inspectorName: string;
  inspectedAt: Date;
  remarks?: string;
  qualityOk: boolean;
  defectDetails?: string;
}

export interface GRNLineResponseDTO {
  id: string;
  lineNumber: number;
  poLineId: string;
  productId: string;
  productCode: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRejected: number;
  unit: string;
  priceOrdered: number;
  priceReceived: number;
  status: string;
  batchNumber?: string;
  expiryDate?: Date;
  serialNumbers?: string[];
  remarks?: string;
}

export interface ReturnItemResponseDTO {
  id: string;
  grnLineId: string;
  productId: string;
  productName: string;
  quantityReturned: number;
  unit: string;
  reason: string;
  returnDate: Date;
  status: string;
  approvedBy?: string;
}

export interface PaginatedGRNResponseDTO {
  data: GRNResponseDTO[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
