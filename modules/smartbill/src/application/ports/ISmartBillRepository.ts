/**
 * SmartBill Repository Port (Application Layer)
 * Defines the contract for SmartBill data persistence
 */

import { SmartBillInvoice } from '../../domain/entities/SmartBillInvoice';
import { SmartBillProforma } from '../../domain/entities/SmartBillProforma';
import { SmartBillStock } from '../../domain/entities/SmartBillStock';

export interface StockSyncRecord {
  warehouseName: string;
  productSku: string;
  previousQuantity: number;
  newQuantity: number;
  syncedAt: Date;
  changed: boolean;
}

/**
 * Port interface for SmartBill data access
 * Abstracts the data persistence layer from business logic
 */
export interface ISmartBillRepository {
  // Invoice operations
  saveInvoice(invoice: SmartBillInvoice): Promise<SmartBillInvoice>;
  getInvoice(id: number): Promise<SmartBillInvoice | null>;
  getInvoiceByOrderId(orderId: string): Promise<SmartBillInvoice | null>;
  getInvoicesByStatus(status: string): Promise<SmartBillInvoice[]>;
  updateInvoice(invoice: SmartBillInvoice): Promise<void>;

  // Proforma operations
  saveProforma(proforma: SmartBillProforma): Promise<SmartBillProforma>;
  getProforma(id: number): Promise<SmartBillProforma | null>;
  getProformaByOrderId(orderId: string): Promise<SmartBillProforma | null>;
  getProformasByStatus(status: string): Promise<SmartBillProforma[]>;
  updateProforma(proforma: SmartBillProforma): Promise<void>;

  // Stock sync operations
  saveStockSync(stocks: SmartBillStock[], syncRecords: StockSyncRecord[]): Promise<void>;
  getLastSyncTime(): Promise<Date | null>;
  getStockSyncHistory(limit: number): Promise<StockSyncRecord[]>;
  getStockByProductSku(sku: string): Promise<SmartBillStock[]>;
}
