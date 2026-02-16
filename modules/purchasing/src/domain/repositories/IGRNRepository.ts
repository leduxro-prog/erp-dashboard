import {
  GoodsReceiptNote,
  GRNLine,
  ReturnItem,
  GRNStatus,
} from '../entities/GoodsReceiptNote';
import { IPaginationOptions, IPaginatedResult } from './IRequisitionRepository';

export interface IGRNRepository {
  create(grn: GoodsReceiptNote): Promise<GoodsReceiptNote>;
  findById(id: string): Promise<GoodsReceiptNote | null>;
  findByNumber(grnNumber: string): Promise<GoodsReceiptNote | null>;
  findByPO(poId: string): Promise<GoodsReceiptNote[]>;
  findByVendor(
    vendorId: string,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<GoodsReceiptNote>>;
  findByStatus(
    status: GRNStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<GoodsReceiptNote>>;
  findAll(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<GoodsReceiptNote>>;
  update(id: string, updates: Partial<GoodsReceiptNote>): Promise<void>;
  delete(id: string): Promise<void>;

  // Line operations
  addLine(grnId: string, line: GRNLine): Promise<void>;
  updateLine(grnId: string, lineId: string, updates: Partial<GRNLine>): Promise<void>;
  removeLine(grnId: string, lineId: string): Promise<void>;
  getLines(grnId: string): Promise<GRNLine[]>;

  // Return operations
  addReturnItem(grnId: string, item: ReturnItem): Promise<void>;
  updateReturnItem(
    grnId: string,
    returnId: string,
    updates: Partial<ReturnItem>
  ): Promise<void>;
  removeReturnItem(grnId: string, returnId: string): Promise<void>;
  getReturnItems(grnId: string): Promise<ReturnItem[]>;
  getReturnItemsByStatus(
    status: string
  ): Promise<ReturnItem[]>;

  // Utility
  existsByNumber(grnNumber: string): Promise<boolean>;
  countByPO(poId: string): Promise<number>;
  countByStatus(status: GRNStatus): Promise<number>;
}
