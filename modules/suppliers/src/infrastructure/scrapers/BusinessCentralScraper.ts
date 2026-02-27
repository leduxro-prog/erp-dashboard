import { createModuleLogger } from '@shared/utils/logger';

import { SupplierCredentials } from '../../domain';
import { BusinessCentralApiClient } from '../services/BusinessCentralApiClient';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

const logger = createModuleLogger('business-central-scraper');

const SKU_ALIASES = [
  'No',
  'No_',
  'ItemNo',
  'Item_No',
  'itemNo',
  'item_no',
  'sku',
  'SKU',
  'Code',
  'ItemCode',
  'Number',
];

const NAME_ALIASES = [
  'Description',
  'description',
  'Description_2',
  'ItemDescription',
  'Name',
  'name',
  'Title',
];

const PRICE_ALIASES = [
  'Unit_Price',
  'UnitPrice',
  'unitPrice',
  'Price',
  'price',
  'SalesPrice',
  'LastDirectCost',
  'Cost',
];

const STOCK_ALIASES = [
  'Inventory',
  'inventory',
  'Stock',
  'stock',
  'Qty',
  'QtyOnHand',
  'Qty_On_Hand',
  'QtyAvailable',
  'Quantity',
  'QuantityAvailable',
  'AvailInventory',
  'Avail_Inventory',
  'AvailableInventory',
  'Remaining_Quantity',
];

const STOCK_STATUS_ALIASES = [
  'Availability',
  'availability',
  'AvailInventoryText',
  'Avail_Inventory_Text',
  'StockStatus',
  'stockStatus',
  'Status',
  'status',
];

const CURRENCY_ALIASES = ['Currency_Code', 'CurrencyCode', 'currency', 'Currency'];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class BusinessCentralScraper extends BaseScraper {
  constructor(
    browser?: any,
    private apiClient: BusinessCentralApiClient = new BusinessCentralApiClient(),
  ) {
    super('business-central', browser);
  }

  async scrapeProducts(credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    return this.retry(async () => {
      const rows = await this.apiClient.fetchInventoryRows(credentials);
      const bySku = new Map<string, ScrapedProduct>();

      for (const row of rows) {
        const parsed = this.parseRow(row);
        if (!parsed) {
          continue;
        }

        const existing = bySku.get(parsed.supplierSku);
        if (!existing) {
          bySku.set(parsed.supplierSku, parsed);
          continue;
        }

        existing.stockQuantity = Math.max(existing.stockQuantity, parsed.stockQuantity);
        if (existing.price <= 0 && parsed.price > 0) {
          existing.price = parsed.price;
          existing.currency = parsed.currency;
        }
      }

      const products = Array.from(bySku.values());
      logger.info('Business Central scrape completed', {
        rows: rows.length,
        products: products.length,
      });

      return products;
    });
  }

  private parseRow(row: Record<string, unknown>): ScrapedProduct | null {
    const sku = this.readFirstString(row, SKU_ALIASES);
    if (!sku) {
      return null;
    }

    const name = this.readFirstString(row, NAME_ALIASES) || sku;
    const price = Math.max(0, this.readFirstNumber(row, PRICE_ALIASES));
    const numericStock = this.readFirstNumber(row, STOCK_ALIASES, NaN);
    const statusText = this.readFirstString(row, STOCK_STATUS_ALIASES);
    const stockQuantity = Number.isFinite(numericStock)
      ? Math.max(0, Math.round(numericStock))
      : this.mapStockStatusToTier(statusText);

    const currencyRaw = this.readFirstString(row, CURRENCY_ALIASES);
    const currency = currencyRaw ? currencyRaw.toUpperCase() : 'EUR';

    return {
      supplierSku: this.normalizeSku(sku),
      name: this.normalizeProductName(name),
      price,
      currency,
      stockQuantity,
    };
  }

  private readFirstString(row: Record<string, unknown>, aliases: string[]): string {
    const value = this.readFirstValue(row, aliases);
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return '';
  }

  private readFirstNumber(
    row: Record<string, unknown>,
    aliases: string[],
    fallback: number = 0,
  ): number {
    const value = this.readFirstValue(row, aliases);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/g, '.').replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private readFirstValue(row: Record<string, unknown>, aliases: string[]): unknown {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(row, alias)) {
        const value = row[alias];
        if (value !== null && value !== undefined && value !== '') {
          return value;
        }
      }
    }

    const normalizedIndex = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      normalizedIndex.set(normalizeKey(key), value);
    }

    for (const alias of aliases) {
      const value = normalizedIndex.get(normalizeKey(alias));
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }

    return null;
  }

  private mapStockStatusToTier(status: string): number {
    const text = status.trim().toLowerCase();
    if (!text) {
      return 0;
    }

    if (text.includes('out') || text.includes('not available') || text.includes('unavailable')) {
      return 0;
    }

    if (text.includes('limited') || text.includes('low')) {
      return 5;
    }

    if (text.includes('available') || text.includes('in stock')) {
      return 40;
    }

    return 0;
  }
}
