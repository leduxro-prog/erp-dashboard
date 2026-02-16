import { Repository } from 'typeorm';
import { SmartBillInvoice } from '../../domain/entities/SmartBillInvoice';
import { SmartBillProforma } from '../../domain/entities/SmartBillProforma';
import { SmartBillStock } from '../../domain/entities/SmartBillStock';
import { ISmartBillRepository, StockSyncRecord } from '../../domain/repositories/ISmartBillRepository';
import { SmartBillInvoiceEntity } from '../entities/SmartBillInvoiceEntity';
import { SmartBillProformaEntity } from '../entities/SmartBillProformaEntity';
import { SmartBillStockSyncEntity } from '../entities/SmartBillStockSyncEntity';
import { SmartBillMapper } from '../mappers/SmartBillMapper';
import { RepositoryError } from '../../application/errors/smartbill.errors';

export class TypeOrmSmartBillRepository implements ISmartBillRepository {
  constructor(
    private readonly invoiceRepository: Repository<SmartBillInvoiceEntity>,
    private readonly proformaRepository: Repository<SmartBillProformaEntity>,
    private readonly stockSyncRepository: Repository<SmartBillStockSyncEntity>,
  ) { }

  async saveInvoice(invoice: SmartBillInvoice): Promise<SmartBillInvoice> {
    try {
      const entity = SmartBillMapper.toInvoiceEntity(invoice);
      const saved = await this.invoiceRepository.save(entity);
      return SmartBillMapper.toDomainInvoice(saved);
    } catch (error) {
      throw new RepositoryError(`Failed to save invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getInvoice(id: number): Promise<SmartBillInvoice | null> {
    try {
      const entity = await this.invoiceRepository.findOne({ where: { id } });
      return entity ? SmartBillMapper.toDomainInvoice(entity) : null;
    } catch (error) {
      throw new RepositoryError(`Failed to get invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getInvoiceByOrderId(orderId: string): Promise<SmartBillInvoice | null> {
    try {
      const entity = await this.invoiceRepository.findOne({ where: { orderId } });
      return entity ? SmartBillMapper.toDomainInvoice(entity) : null;
    } catch (error) {
      throw new RepositoryError(`Failed to get invoice by order id: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get invoices by status
   * @param status - Invoice status ('draft', 'issued', 'paid', 'cancelled', etc.)
   * @returns Array of matching invoices
   */
  async getInvoicesByStatus(status: string): Promise<SmartBillInvoice[]> {
    try {
      const entities = await this.invoiceRepository.find({ where: { status: status as any } });
      return entities.map((e) => SmartBillMapper.toDomainInvoice(e));
    } catch (error) {
      throw new RepositoryError(`Failed to get invoices by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateInvoice(invoice: SmartBillInvoice): Promise<void> {
    try {
      const entity = SmartBillMapper.toInvoiceEntity(invoice);
      await this.invoiceRepository.save(entity);
    } catch (error) {
      throw new RepositoryError(`Failed to update invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveProforma(proforma: SmartBillProforma): Promise<SmartBillProforma> {
    try {
      const entity = SmartBillMapper.toProformaEntity(proforma);
      const saved = await this.proformaRepository.save(entity);
      return SmartBillMapper.toDomainProforma(saved);
    } catch (error) {
      throw new RepositoryError(`Failed to save proforma: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProforma(id: number): Promise<SmartBillProforma | null> {
    try {
      const entity = await this.proformaRepository.findOne({ where: { id } });
      return entity ? SmartBillMapper.toDomainProforma(entity) : null;
    } catch (error) {
      throw new RepositoryError(`Failed to get proforma: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProformaByOrderId(orderId: string): Promise<SmartBillProforma | null> {
    try {
      const entity = await this.proformaRepository.findOne({ where: { orderId } });
      return entity ? SmartBillMapper.toDomainProforma(entity) : null;
    } catch (error) {
      throw new RepositoryError(`Failed to get proforma by order id: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get proformas by status
   * @param status - Proforma status ('draft', 'issued', 'converted', 'cancelled', etc.)
   * @returns Array of matching proformas
   */
  async getProformasByStatus(status: string): Promise<SmartBillProforma[]> {
    try {
      const entities = await this.proformaRepository.find({ where: { status: status as any } });
      return entities.map((e) => SmartBillMapper.toDomainProforma(e));
    } catch (error) {
      throw new RepositoryError(`Failed to get proformas by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProforma(proforma: SmartBillProforma): Promise<void> {
    try {
      const entity = SmartBillMapper.toProformaEntity(proforma);
      await this.proformaRepository.save(entity);
    } catch (error) {
      throw new RepositoryError(`Failed to update proforma: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveStockSync(stocks: SmartBillStock[], syncRecords: StockSyncRecord[]): Promise<void> {
    try {
      const entities = syncRecords.map((record) => {
        return this.stockSyncRepository.create({
          warehouseName: record.warehouseName,
          productSku: record.productSku,
          previousQuantity: record.previousQuantity,
          newQuantity: record.newQuantity,
          changed: record.changed,
          syncedAt: record.syncedAt,
        });
      });

      await this.stockSyncRepository.save(entities);
    } catch (error) {
      throw new RepositoryError(`Failed to save stock sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    try {
      const result = await this.stockSyncRepository
        .createQueryBuilder('sync')
        .select('MAX(sync.syncedAt)', 'lastSync')
        .getRawOne();

      return result?.lastSync ? new Date(result.lastSync) : null;
    } catch (error) {
      throw new RepositoryError(`Failed to get last sync time: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStockSyncHistory(limit: number): Promise<StockSyncRecord[]> {
    try {
      const entities = await this.stockSyncRepository.find({
        order: { syncedAt: 'DESC' },
        take: limit,
      });

      return entities.map((e) => ({
        warehouseName: e.warehouseName,
        productSku: e.productSku,
        previousQuantity: e.previousQuantity,
        newQuantity: e.newQuantity,
        syncedAt: e.syncedAt,
        changed: e.changed,
      }));
    } catch (error) {
      throw new RepositoryError(`Failed to get stock sync history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStockByProductSku(sku: string): Promise<SmartBillStock[]> {
    try {
      const entities = await this.stockSyncRepository.find({
        where: { productSku: sku },
        order: { syncedAt: 'DESC' },
        take: 100,
      });

      return entities.map((e) => new SmartBillStock(e.productSku, e.warehouseName, e.newQuantity, e.syncedAt));
    } catch (error) {
      throw new RepositoryError(`Failed to get stock by sku: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
