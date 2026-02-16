import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';
import * as XLSX from 'xlsx';

const logger = createModuleLogger('ImportPricesFromExcel');

export interface ExcelRow {
  sku?: string;
  code?: string;
  productCode?: string;
  price?: number;
  priceWithVat?: number;
  priceWithoutVat?: number;
  basePrice?: number;
  vat?: number;
  vatRate?: number;
  currency?: string;
  [key: string]: any;
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  productsUpdated: number;
  productsNotFound: number;
  errors: Array<{ row: number; sku: string; error: string }>;
  preview: Array<{ sku: string; name: string; oldPrice: number; newPrice: number }>;
}

export class ImportPricesFromExcelUseCase {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Import prices from Excel file
   * @param fileBuffer - Excel file buffer
   * @param options - Import options
   */
  async execute(
    fileBuffer: Buffer,
    options: {
      priceColumn?: string;
      skuColumn?: string;
      vatRate?: number;
      priceIncludesVat?: boolean;
      dryRun?: boolean;
    } = {},
  ): Promise<ImportResult> {
    logger.info('Starting Excel price import', options);

    const result: ImportResult = {
      totalRows: 0,
      validRows: 0,
      productsUpdated: 0,
      productsNotFound: 0,
      errors: [],
      preview: [],
    };

    try {
      // Parse Excel file
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

      result.totalRows = data.length;
      logger.info(`Parsed ${data.length} rows from Excel`);

      // Default column mappings
      const skuColumn = options.skuColumn || this.detectSkuColumn(data);
      const priceColumn = options.priceColumn || this.detectPriceColumn(data);
      const vatRate = options.vatRate || 19;
      const priceIncludesVat = options.priceIncludesVat !== undefined ? options.priceIncludesVat : true;

      logger.info('Column mappings', { skuColumn, priceColumn, vatRate, priceIncludesVat });

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // Excel rows start at 1, +1 for header

        try {
          // Extract SKU
          const sku = this.extractValue(row, skuColumn);
          if (!sku) {
            result.errors.push({
              row: rowNumber,
              sku: 'N/A',
              error: `SKU not found in column '${skuColumn}'`,
            });
            continue;
          }

          // Extract price
          const rawPrice = this.extractValue(row, priceColumn);
          if (!rawPrice || isNaN(parseFloat(rawPrice))) {
            result.errors.push({
              row: rowNumber,
              sku: sku,
              error: `Invalid price in column '${priceColumn}': ${rawPrice}`,
            });
            continue;
          }

          const price = parseFloat(rawPrice);
          if (price <= 0) {
            result.errors.push({
              row: rowNumber,
              sku: sku,
              error: `Price must be greater than 0: ${price}`,
            });
            continue;
          }

          // Extract additional fields from Excel if present
          const productNameFromExcel = this.extractValue(row, 'Denumire produs');
          const vatIncludedFromExcel = this.extractValue(row, 'Pretul contine TVA');
          const vatRateFromExcel = this.extractValue(row, 'Cota TVA');
          const currencyFromExcel = this.extractValue(row, 'Moneda');
          const unitOfMeasureFromExcel = this.extractValue(row, 'Unitate masura');

          // Determine if price includes VAT (prefer Excel value, fallback to option)
          let rowPriceIncludesVat = priceIncludesVat;
          if (vatIncludedFromExcel !== undefined) {
            const vatIncludedStr = String(vatIncludedFromExcel).toLowerCase();
            rowPriceIncludesVat = vatIncludedStr === 'da' || vatIncludedStr === 'yes' || vatIncludedStr === 'true' || vatIncludedStr === '1';
          }

          // Determine VAT rate (prefer Excel value, fallback to option)
          let rowVatRate = vatRate;
          if (vatRateFromExcel !== undefined && !isNaN(parseFloat(vatRateFromExcel))) {
            rowVatRate = parseFloat(vatRateFromExcel);
          }

          // Validate currency (must be RON or convertible)
          if (currencyFromExcel !== undefined) {
            const currency = String(currencyFromExcel).toUpperCase().trim();
            if (currency !== 'RON' && currency !== '') {
              result.errors.push({
                row: rowNumber,
                sku: sku,
                error: `Only RON currency is supported, found: ${currency}`,
              });
              continue;
            }
          }

          // Calculate price without VAT
          const priceWithoutVat = rowPriceIncludesVat
            ? price / (1 + rowVatRate / 100)
            : price;

          result.validRows++;

          // Get current product info
          const existingProduct = await this.dataSource.query(
            `SELECT id, name, base_price FROM products WHERE sku = $1 AND is_active = true LIMIT 1`,
            [sku],
          );

          if (existingProduct.length === 0) {
            result.productsNotFound++;
            result.errors.push({
              row: rowNumber,
              sku: sku,
              error: 'Product not found in database',
            });
            continue;
          }

          const product = existingProduct[0];
          const oldPrice = parseFloat(product.base_price) || 0;

          // Add to preview
          if (result.preview.length < 50) {
            result.preview.push({
              sku: sku,
              name: product.name,
              oldPrice: oldPrice,
              newPrice: priceWithoutVat,
            });
          }

          // Update product if not dry run
          if (!options.dryRun) {
            // Build update query with optional fields
            const hasProductName = productNameFromExcel !== undefined && productNameFromExcel.trim() !== '';
            const hasUnitOfMeasure = unitOfMeasureFromExcel !== undefined && unitOfMeasureFromExcel.trim() !== '';

            if (hasProductName && hasUnitOfMeasure) {
              await this.dataSource.query(
                `UPDATE products
                 SET base_price = $1,
                     currency_code = 'RON',
                     name = $2,
                     unit_of_measure = $3,
                     updated_at = NOW()
                 WHERE id = $4`,
                [priceWithoutVat, productNameFromExcel.trim(), unitOfMeasureFromExcel.trim(), product.id],
              );
            } else if (hasProductName) {
              await this.dataSource.query(
                `UPDATE products
                 SET base_price = $1,
                     currency_code = 'RON',
                     name = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [priceWithoutVat, productNameFromExcel.trim(), product.id],
              );
            } else if (hasUnitOfMeasure) {
              await this.dataSource.query(
                `UPDATE products
                 SET base_price = $1,
                     currency_code = 'RON',
                     unit_of_measure = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [priceWithoutVat, unitOfMeasureFromExcel.trim(), product.id],
              );
            } else {
              await this.dataSource.query(
                `UPDATE products
                 SET base_price = $1,
                     currency_code = 'RON',
                     updated_at = NOW()
                 WHERE id = $2`,
                [priceWithoutVat, product.id],
              );
            }

            result.productsUpdated++;
            logger.debug(`Updated product ${sku} with price ${priceWithoutVat.toFixed(2)} RON (VAT: ${rowVatRate}%, includes VAT: ${rowPriceIncludesVat})`);
          }
        } catch (error) {
          result.errors.push({
            row: rowNumber,
            sku: String(row[skuColumn] || 'N/A'),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Excel import completed', {
        totalRows: result.totalRows,
        validRows: result.validRows,
        productsUpdated: result.productsUpdated,
        productsNotFound: result.productsNotFound,
        errors: result.errors.length,
        dryRun: options.dryRun,
      });

      return result;
    } catch (error) {
      logger.error('Failed to import prices from Excel', error);
      throw new Error(`Excel import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect SKU column name
   */
  private detectSkuColumn(data: ExcelRow[]): string {
    if (data.length === 0) return 'sku';

    const firstRow = data[0];
    const possibleSkuColumns = [
      'Cod produs',
      'cod produs',
      'COD PRODUS',
      'sku',
      'SKU',
      'code',
      'Code',
      'productCode',
      'product_code',
      'cod',
      'cod_produs',
    ];

    for (const col of possibleSkuColumns) {
      if (col in firstRow) return col;
    }

    // Return first column that looks like a code
    const columns = Object.keys(firstRow);
    for (const col of columns) {
      const lowerCol = col.toLowerCase();
      if (lowerCol.includes('cod') || lowerCol.includes('sku') || lowerCol.includes('code')) {
        return col;
      }
    }

    // Default to first column
    return columns[0] || 'sku';
  }

  /**
   * Detect price column name
   */
  private detectPriceColumn(data: ExcelRow[]): string {
    if (data.length === 0) return 'price';

    const firstRow = data[0];
    const possiblePriceColumns = [
      'Pret',
      'pret',
      'PRET',
      'Price',
      'price',
      'pret_vanzare',
      'pretVanzare',
      'Pret vanzare',
      'basePrice',
      'base_price',
      'priceWithVat',
      'priceWithoutVat',
    ];

    for (const col of possiblePriceColumns) {
      if (col in firstRow) return col;
    }

    // Return first column that looks like a price
    const columns = Object.keys(firstRow);
    for (const col of columns) {
      const lowerCol = col.toLowerCase();
      if (lowerCol.includes('pret') || lowerCol.includes('price') || lowerCol.includes('cost')) {
        return col;
      }
    }

    // Default to second column (assuming first is SKU)
    return columns[1] || 'price';
  }

  /**
   * Extract value from row with case-insensitive key matching
   */
  private extractValue(row: ExcelRow, key: string): string | undefined {
    // Direct match
    if (row[key] !== undefined) {
      return String(row[key]).trim();
    }

    // Case-insensitive match
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === lowerKey) {
        return String(v).trim();
      }
    }

    return undefined;
  }

  /**
   * Get template Excel file with sample data
   */
  getTemplate(): Buffer {
    const template = [
      { sku: 'EXAMPLE-001', price: 100.00 },
      { sku: 'EXAMPLE-002', price: 250.50 },
      { sku: 'EXAMPLE-003', price: 75.99 },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prices');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
