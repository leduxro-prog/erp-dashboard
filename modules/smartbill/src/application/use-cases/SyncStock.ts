import { SmartBillStock } from '../../domain/entities/SmartBillStock';
import {
  ISmartBillRepository,
  StockSyncRecord,
} from '../../domain/repositories/ISmartBillRepository';
import { StockSyncResultDto, StockSyncItemResult } from '../dtos/smartbill.dtos';
import { StockSyncError } from '../errors/smartbill.errors';
import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('smartbill');

export interface SmartBillProduct {
  sku: string;
  name?: string;
  quantity: number;
  price?: number;
  measuringUnit?: string;
  vat?: number;
}

export interface ISmartBillApiClientStock {
  getWarehouses(): Promise<Array<{ id: string; name: string }>>;
  getStock(warehouseId: string): Promise<Array<SmartBillProduct>>;
  getStocks(): Promise<Array<{ warehouseName: string; products: Array<SmartBillProduct> }>>;
}

export interface IEventBusStock {
  publish(eventName: string, data: any): Promise<void>;
}

export class SyncStockUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClientStock,
    private readonly eventBus: IEventBusStock,
    private readonly dataSource?: DataSource,
  ) {}

  async execute(): Promise<StockSyncResultDto> {
    const failedWarehouses: string[] = [];
    const stocks: SmartBillStock[] = [];
    const syncRecords: StockSyncRecord[] = [];
    const syncDetails: StockSyncItemResult[] = [];

    try {
      // Get all stocks in one call
      const allStocks = await this.apiClient.getStocks();

      if (allStocks.length === 0) {
        throw new StockSyncError('No stock data found in SmartBill');
      }

      const syncDate = new Date();

      // Sync stock for each warehouse entry
      for (const entry of allStocks) {
        const warehouseName = entry.warehouseName;

        try {
          for (const item of entry.products) {
            // Sync product data to products table
            // Only sync if we have valid price data (price > 0)
            if (
              this.dataSource &&
              item.sku &&
              item.name &&
              item.price !== undefined &&
              item.price > 0
            ) {
              try {
                const vat = item.vat || 19;
                const priceWithVat = item.price;
                const priceWithoutVat = priceWithVat / (1 + vat / 100);

                // Check if product exists
                const existingProduct = await this.dataSource.query(
                  `SELECT id FROM products WHERE sku = $1 LIMIT 1`,
                  [item.sku],
                );

                if (existingProduct.length === 0) {
                  // Create new product with SmartBill data
                  await this.dataSource.query(
                    `INSERT INTO products (sku, name, base_price, currency_code, unit_of_measure, is_active, category_id, created_at, updated_at)
                     VALUES ($1, $2, $3, 'RON', $4, true,
                       (SELECT id FROM categories WHERE name = 'General' OR name ILIKE '%general%' LIMIT 1),
                       NOW(), NOW())
                     ON CONFLICT (sku) DO UPDATE
                     SET base_price = EXCLUDED.base_price,
                         currency_code = 'RON',
                         unit_of_measure = EXCLUDED.unit_of_measure,
                         updated_at = NOW()`,
                    [item.sku, item.name, priceWithoutVat, item.measuringUnit || 'buc'],
                  );
                } else {
                  // Update existing product - only update price if we have a valid price > 0
                  await this.dataSource.query(
                    `UPDATE products
                     SET base_price = $1,
                         currency_code = 'RON',
                         unit_of_measure = $2,
                         name = COALESCE(NULLIF(name, ''), $3),
                         updated_at = NOW()
                     WHERE sku = $4`,
                    [priceWithoutVat, item.measuringUnit || 'buc', item.name, item.sku],
                  );
                }
              } catch (productError) {
                // Log error but don't fail the stock sync
                logger.error(`Failed to sync product ${item.sku}:`, { error: productError });
              }
            } else if (this.dataSource && item.sku && item.name) {
              // If no valid price, only update name and unit (don't touch price)
              try {
                const existingProduct = await this.dataSource.query(
                  `SELECT id FROM products WHERE sku = $1 LIMIT 1`,
                  [item.sku],
                );

                if (existingProduct.length > 0) {
                  // Update only name and unit, preserve existing price
                  await this.dataSource.query(
                    `UPDATE products
                     SET currency_code = 'RON',
                         unit_of_measure = $1,
                         name = COALESCE(NULLIF(name, ''), $2),
                         updated_at = NOW()
                     WHERE sku = $3`,
                    [item.measuringUnit || 'buc', item.name, item.sku],
                  );
                }
              } catch (productError) {
                logger.error(`Failed to sync product metadata ${item.sku}:`, {
                  error: productError,
                });
              }
            }

            const previousStocks = await this.repository.getStockByProductSku(item.sku);
            const previousQty =
              previousStocks.find((s) => s.warehouseName === warehouseName)?.quantity || 0;

            const stock = new SmartBillStock(item.sku, warehouseName, item.quantity, syncDate);
            stocks.push(stock);

            const changed = stock.hasChanged(previousQty);
            const syncRecord: StockSyncRecord = {
              warehouseName,
              productSku: item.sku,
              previousQuantity: previousQty,
              newQuantity: item.quantity,
              syncedAt: syncDate,
              changed,
            };
            syncRecords.push(syncRecord);

            const detail: StockSyncItemResult = {
              warehouseName,
              productSku: item.sku,
              productName: item.name,
              price: item.price,
              measuringUnit: item.measuringUnit,
              previousQuantity: previousQty,
              newQuantity: item.quantity,
              changed,
              difference: item.quantity - previousQty,
              isLow: stock.isLow(),
            };
            syncDetails.push(detail);
          }
        } catch (error) {
          failedWarehouses.push(warehouseName || 'Unknown');
        }
      }

      // Save to database
      await this.repository.saveStockSync(stocks, syncRecords);

      // Calculate metrics
      const changedItems = syncDetails.filter((d) => d.changed).length;
      const lowStockItems = syncDetails.filter((d) => d.isLow).length;
      const outOfStockItems = syncDetails.filter((d) => d.newQuantity <= 0).length;

      const result: StockSyncResultDto = {
        syncedAt: syncDate,
        totalItems: syncDetails.length,
        changedItems,
        lowStockItems,
        outOfStockItems,
        warehouses: allStocks.map((s) => s.warehouseName),
        syncDetails,
      };

      // Publish event
      await this.eventBus.publish('stock.synced', {
        syncedAt: syncDate,
        totalItems: syncDetails.length,
        changedItems,
        failedWarehouses,
      });

      if (failedWarehouses.length > 0) {
        throw new StockSyncError(
          `Stock sync completed with errors on warehouses: ${failedWarehouses.join(', ')}`,
          failedWarehouses,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof StockSyncError) {
        throw error;
      }
      throw new StockSyncError(
        `Failed to sync stock: ${error instanceof Error ? error.message : 'Unknown error'}`,
        failedWarehouses,
      );
    }
  }
}
