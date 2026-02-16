import { InvoiceItem, InvoiceStatus } from '../../domain/entities/SmartBillInvoice';
import { ProformaStatus } from '../../domain/entities/SmartBillProforma';

export interface InvoiceItemDto {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalWithoutVat: number;
  vatAmount: number;
}

export interface CreateInvoiceDto {
  orderId: string;
  customerName: string;
  customerVat: string;
  items: InvoiceItemDto[];
  dueDate: Date;
  series?: string;
  currency?: string;
}

export interface InvoiceResultDto {
  id: number;
  orderId: string;
  smartBillId: string;
  invoiceNumber: string;
  series: string;
  customerName: string;
  customerVat: string;
  totalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  currency: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  createdAt: Date;
  items: InvoiceItemDto[];
}

export interface CreateProformaDto {
  orderId: string;
  customerName: string;
  customerVat: string;
  items: InvoiceItemDto[];
  dueDate: Date;
  series?: string;
  currency?: string;
}

export interface ProformaResultDto {
  id: number;
  orderId: string;
  smartBillId: string;
  proformaNumber: string;
  series: string;
  customerName: string;
  customerVat: string;
  totalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  currency: string;
  status: ProformaStatus;
  issueDate: Date;
  dueDate: Date;
  createdAt: Date;
  items: InvoiceItemDto[];
}

export interface StockSyncItemResult {
  warehouseName: string;
  productSku: string;
  productName?: string;
  price?: number;
  measuringUnit?: string;
  previousQuantity: number;
  newQuantity: number;
  changed: boolean;
  difference: number;
  isLow: boolean;
}

export interface StockSyncResultDto {
  syncedAt: Date;
  totalItems: number;
  changedItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  warehouses: string[];
  syncDetails: StockSyncItemResult[];
}

export interface WarehouseInfoDto {
  warehouseId: string;
  warehouseName: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface GetInvoiceStatusDto {
  invoiceId: string;
  status: string;
  paidAmount: number;
  totalAmount: number;
  paymentDate: Date | null;
  daysUntilDue: number;
}
