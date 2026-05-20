import * as XLSX from '@e965/xlsx';

import {
  ensureManufacturerInProductName,
  isAzzardoSupplier,
} from '@shared/utils/product-name-manufacturer';
import { translateSupplierProductName } from '@shared/utils/product-name-translator';

import { ISupplierRepository } from '../ports/ISupplierRepository';
import { SupplierProduct } from '../../domain/entities/SupplierProduct';

export interface ImportRow {
  sku?: string;
  name?: string;
  price?: number;
  stock?: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  currency?: string;
  [key: string]: any;
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; sku: string; error: string }>;
  preview: Array<{
    sku: string;
    name: string;
    price: number;
    stock: number;
    action: 'create' | 'update' | 'skip';
  }>;
}

export interface ApiFeedConfig {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  authType?: 'none' | 'basic' | 'bearer' | 'api-key';
  authCredentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  dataPath?: string; // JSON path to the products array, e.g. "data.products"
  fieldMapping?: Record<string, string>; // Maps our field names to API field names
  body?: any;
}

export class ImportSupplierProducts {
  constructor(private repository: ISupplierRepository) {}

  /**
   * Import products from a CSV file buffer
   */
  async importFromCSV(
    supplierId: number,
    csvText: string,
    options: { dryRun?: boolean; delimiter?: string } = {},
  ): Promise<ImportResult> {
    const delimiter = options.delimiter || this.detectDelimiter(csvText);
    const rows = this.parseCSV(csvText, delimiter);
    return this.processRows(supplierId, rows, options.dryRun);
  }

  /**
   * Import products from an Excel file buffer
   */
  async importFromExcel(
    supplierId: number,
    fileBuffer: Buffer,
    options: { dryRun?: boolean; sheetName?: string } = {},
  ): Promise<ImportResult> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = options.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(
        `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`,
      );
    }

    const data: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);
    return this.processRows(supplierId, data, options.dryRun);
  }

  /**
   * Import products from an external API feed
   */
  async importFromApi(
    supplierId: number,
    config: ApiFeedConfig,
    options: { dryRun?: boolean } = {},
  ): Promise<ImportResult> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // Apply authentication
    if (config.authType === 'basic' && config.authCredentials) {
      const { username, password } = config.authCredentials;
      const encoded = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else if (config.authType === 'bearer' && config.authCredentials?.token) {
      headers['Authorization'] = `Bearer ${config.authCredentials.token}`;
    } else if (config.authType === 'api-key' && config.authCredentials) {
      const headerName = config.authCredentials.apiKeyHeader || 'X-API-Key';
      headers[headerName] = config.authCredentials.apiKey || '';
    }

    // Also try loading credentials from supplier record if not provided
    if (config.authType !== 'none' && !config.authCredentials) {
      const supplier = await this.repository.getSupplier(supplierId);
      if (supplier?.credentials) {
        if (supplier.credentials.apiKey) {
          headers['Authorization'] = `Bearer ${supplier.credentials.apiKey}`;
        } else if (supplier.credentials.username && supplier.credentials.password) {
          const encoded = Buffer.from(
            `${supplier.credentials.username}:${supplier.credentials.password}`,
          ).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
      }
    }

    const fetchOptions: RequestInit = {
      method: config.method || 'GET',
      headers,
    };

    if (config.method === 'POST' && config.body) {
      fetchOptions.body = JSON.stringify(config.body);
    }

    const response = await fetch(config.url, fetchOptions);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    // Navigate to the data path
    let products: any = json;
    if (config.dataPath) {
      const pathParts = config.dataPath.split('.');
      for (const part of pathParts) {
        if (products && typeof products === 'object') {
          products = (products as Record<string, any>)[part];
        }
      }
    }

    if (!Array.isArray(products)) {
      throw new Error(
        `Expected array at path "${config.dataPath || 'root'}". Got ${typeof products}`,
      );
    }

    // Apply field mapping if provided
    const mappedRows: ImportRow[] = products.map((item: any) => {
      if (!config.fieldMapping) return item;

      const mapped: Record<string, any> = {};
      for (const [ourField, theirField] of Object.entries(config.fieldMapping)) {
        mapped[ourField] = this.getNestedValue(item, theirField);
      }
      return mapped as ImportRow;
    });

    return this.processRows(supplierId, mappedRows, options.dryRun);
  }

  /**
   * Generate an import template as Excel buffer
   */
  getTemplate(): Buffer {
    const template = [
      {
        sku: 'SUPPLIER-SKU-001',
        name: 'Produs exemplu 1',
        price: 25.5,
        stock: 100,
        min_order_qty: 1,
        lead_time_days: 3,
        currency: 'RON',
      },
      {
        sku: 'SUPPLIER-SKU-002',
        name: 'Produs exemplu 2',
        price: 49.99,
        stock: 50,
        min_order_qty: 5,
        lead_time_days: 7,
        currency: 'EUR',
      },
      {
        sku: 'SUPPLIER-SKU-003',
        name: 'Produs exemplu 3',
        price: 150.0,
        stock: 0,
        min_order_qty: 1,
        lead_time_days: 14,
        currency: 'RON',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // sku
      { wch: 30 }, // name
      { wch: 12 }, // price
      { wch: 10 }, // stock
      { wch: 15 }, // min_order_qty
      { wch: 15 }, // lead_time_days
      { wch: 10 }, // currency
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Products');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  // --- Private methods ---

  private async processRows(
    supplierId: number,
    rows: ImportRow[],
    dryRun?: boolean,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: rows.length,
      validRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      preview: [],
    };

    if (rows.length === 0) {
      return result;
    }

    // Detect column names from first row
    const skuCol = this.detectColumn(rows, [
      'sku',
      'cod',
      'cod_produs',
      'product_code',
      'supplier_sku',
      'cod produs',
      'articol',
    ]);
    const nameCol = this.detectColumn(rows, [
      'name',
      'nume',
      'denumire',
      'product_name',
      'denumire_produs',
      'denumire produs',
      'descriere',
    ]);
    const priceCol = this.detectColumn(rows, [
      'price',
      'pret',
      'cost',
      'supplier_price',
      'pret_furnizor',
      'pret furnizor',
      'pret_achizitie',
    ]);
    const stockCol = this.detectColumn(rows, [
      'stock',
      'stoc',
      'qty',
      'quantity',
      'cantitate',
      'disponibil',
      'stock_quantity',
    ]);
    const minQtyCol = this.detectColumn(rows, [
      'min_order_qty',
      'min_qty',
      'moq',
      'cantitate_minima',
      'min_order_quantity',
    ]);
    const leadTimeCol = this.detectColumn(rows, [
      'lead_time_days',
      'lead_time',
      'termen_livrare',
      'livrare_zile',
    ]);
    // Currency column detection (reserved for future currency conversion support)
    this.detectColumn(rows, ['currency', 'moneda', 'valuta', 'currency_code']);

    // Get existing products to detect creates vs updates
    const supplier = await this.repository.getSupplier(supplierId);
    const shouldPrefixManufacturer = isAzzardoSupplier(
      supplier?.name,
      supplier ? String(supplier.code) : undefined,
    );

    const existingProducts = await this.repository.getSupplierProducts(supplierId);
    const existingBySkuMap = new Map(existingProducts.map((p) => [p.supplierSku, p]));

    const productsToUpsert: SupplierProduct[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +1 for 0-index, +1 for header

      try {
        const sku = this.extractValue(row, skuCol);
        if (!sku) {
          result.errors.push({
            row: rowNumber,
            sku: 'N/A',
            error: `SKU not found (column: ${skuCol || 'auto-detect failed'})`,
          });
          continue;
        }

        const rawName = this.extractValue(row, nameCol) || sku;
        const translatedName = translateSupplierProductName(rawName);
        const name = shouldPrefixManufacturer
          ? ensureManufacturerInProductName(translatedName, supplier?.name || 'Azzardo')
          : translatedName;
        const rawPrice = this.extractValue(row, priceCol);
        const price = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : 0;
        const rawStock = this.extractValue(row, stockCol);
        const stock = rawStock ? parseInt(rawStock, 10) : 0;
        const rawMinQty = this.extractValue(row, minQtyCol);
        const minOrderQty = rawMinQty ? parseInt(rawMinQty, 10) : 1;
        const rawLeadTime = this.extractValue(row, leadTimeCol);
        const leadTimeDays = rawLeadTime ? parseInt(rawLeadTime, 10) : undefined;

        if (isNaN(price) || price < 0) {
          result.errors.push({
            row: rowNumber,
            sku,
            error: `Invalid price: ${rawPrice}`,
          });
          continue;
        }

        result.validRows++;

        const existing = existingBySkuMap.get(sku);
        const action: 'create' | 'update' | 'skip' = existing ? 'update' : 'create';

        // Add to preview (first 100 rows)
        if (result.preview.length < 100) {
          result.preview.push({ sku, name, price, stock, action });
        }

        if (!dryRun) {
          productsToUpsert.push({
            supplierId,
            supplierSku: sku,
            name,
            price,
            stockQuantity: stock,
            minOrderQuantity: minOrderQty,
            leadTimeDays,
            isActive: true,
            priceHistory: [],
          } as any);
        }

        if (action === 'create') {
          result.created++;
        } else {
          result.updated++;
        }
      } catch (err) {
        result.errors.push({
          row: rowNumber,
          sku: String(row[skuCol || ''] || 'N/A'),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Bulk upsert if not dry run
    if (!dryRun && productsToUpsert.length > 0) {
      await this.repository.bulkUpsertProducts(productsToUpsert);
    }

    return result;
  }

  private parseCSV(text: string, delimiter: string): ImportRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const headers = this.splitCSVLine(headerLine, delimiter);

    const rows: ImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.splitCSVLine(lines[i], delimiter);
      const row: ImportRow = {};
      headers.forEach((h, idx) => {
        row[h.trim()] = values[idx]?.trim() || '';
      });
      rows.push(row);
    }

    return rows;
  }

  private splitCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private detectDelimiter(text: string): string {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;

    if (tabs >= commas && tabs >= semicolons) return '\t';
    if (semicolons >= commas) return ';';
    return ',';
  }

  private detectColumn(rows: ImportRow[], candidates: string[]): string | undefined {
    if (rows.length === 0) return undefined;

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    // Direct match (case-insensitive)
    for (const candidate of candidates) {
      for (const key of keys) {
        if (key.toLowerCase() === candidate.toLowerCase()) {
          return key;
        }
      }
    }

    // Partial match
    for (const candidate of candidates) {
      for (const key of keys) {
        if (key.toLowerCase().includes(candidate.toLowerCase())) {
          return key;
        }
      }
    }

    return undefined;
  }

  private extractValue(row: ImportRow, key: string | undefined): string | undefined {
    if (!key) return undefined;

    if (row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }

    // Case-insensitive fallback
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === lowerKey && v !== undefined && v !== null) {
        return String(v).trim();
      }
    }

    return undefined;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
}
