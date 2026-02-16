import { SmartBillInvoice } from '../entities/SmartBillInvoice';
import { SmartBillProforma } from '../entities/SmartBillProforma';
import { SmartBillStock } from '../entities/SmartBillStock';

export interface StockSyncRecord {
  warehouseName: string;
  productSku: string;
  previousQuantity: number;
  newQuantity: number;
  syncedAt: Date;
  changed: boolean;
}

export interface ISmartBillRepository {
  saveInvoice(invoice: SmartBillInvoice): Promise<SmartBillInvoice>;
  getInvoice(id: number): Promise<SmartBillInvoice | null>;
  getInvoiceByOrderId(orderId: string): Promise<SmartBillInvoice | null>;
  getInvoicesByStatus(status: string): Promise<SmartBillInvoice[]>;
  updateInvoice(invoice: SmartBillInvoice): Promise<void>;

  saveProforma(proforma: SmartBillProforma): Promise<SmartBillProforma>;
  getProforma(id: number): Promise<SmartBillProforma | null>;
  getProformaByOrderId(orderId: string): Promise<SmartBillProforma | null>;
  getProformasByStatus(status: string): Promise<SmartBillProforma[]>;
  updateProforma(proforma: SmartBillProforma): Promise<void>;

  saveStockSync(stocks: SmartBillStock[], syncRecords: StockSyncRecord[]): Promise<void>;
  getLastSyncTime(): Promise<Date | null>;
  getStockSyncHistory(limit: number): Promise<StockSyncRecord[]>;
  getStockByProductSku(sku: string): Promise<SmartBillStock[]>;
}
