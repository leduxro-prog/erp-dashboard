import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('SyncPricesFromInvoices');

export interface InvoiceProduct {
  name: string;
  code: string;
  price: number;
  currency: string;
  isTaxIncluded: boolean;
  taxPercentage: number;
  quantity: number;
}

export interface Invoice {
  seriesName: string;
  number: string;
  issueDate: string;
  products: InvoiceProduct[];
}

export interface ISmartBillApiClientInvoices {
  getInvoices(params: { startDate: string; endDate: string }): Promise<Invoice[]>;
}

export interface PriceSyncResult {
  totalInvoices: number;
  totalProducts: number;
  productsUpdated: number;
  productsCostUpdated: number;
  pricesExtracted: Map<
    string,
    { price: number; priceWithVat: number; lastInvoiceDate: string; count: number }
  >;
  errors: string[];
}

export class SyncPricesFromInvoicesUseCase {
  constructor(
    private readonly apiClient: ISmartBillApiClientInvoices,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Extract prices from invoices and update products
   * @param daysBack - Number of days to look back for invoices (default: 90)
   * @param updateStrategy - 'latest' (use most recent price) or 'average' (use average price)
   */
  async execute(
    daysBack: number = 90,
    updateStrategy: 'latest' | 'average' = 'latest',
  ): Promise<PriceSyncResult> {
    logger.info('Starting price sync from invoices', { daysBack, updateStrategy });

    const result: PriceSyncResult = {
      totalInvoices: 0,
      totalProducts: 0,
      productsUpdated: 0,
      productsCostUpdated: 0,
      pricesExtracted: new Map(),
      errors: [],
    };

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      logger.info('Fetching invoices', { startDate: startDateStr, endDate: endDateStr });

      // Get invoices from SmartBill
      const invoices = await this.apiClient.getInvoices({
        startDate: startDateStr,
        endDate: endDateStr,
      });

      result.totalInvoices = invoices.length;
      logger.info(`Retrieved ${invoices.length} invoices`);

      // Extract prices from invoices
      for (const invoice of invoices) {
        try {
          for (const product of invoice.products) {
            if (!product.code || product.price <= 0) {
              continue;
            }

            result.totalProducts++;

            // Calculate price without VAT if needed
            let priceWithoutVat = product.price;
            let priceWithVat = product.price;

            if (product.isTaxIncluded) {
              // Price includes VAT, calculate without VAT
              priceWithoutVat = product.price / (1 + product.taxPercentage / 100);
            } else {
              // Price is without VAT, calculate with VAT
              priceWithVat = product.price * (1 + product.taxPercentage / 100);
            }

            // Convert to RON if needed (assume EUR if not RON)
            if (product.currency && product.currency.toUpperCase() !== 'RON') {
              // Simple conversion - in production, you'd use exchange rates
              logger.warn(
                `Product ${product.code} has price in ${product.currency}, manual conversion may be needed`,
              );
            }

            // Aggregate prices by SKU
            const existing = result.pricesExtracted.get(product.code);
            if (existing) {
              existing.price =
                (existing.price * existing.count + priceWithoutVat) / (existing.count + 1);
              existing.priceWithVat =
                (existing.priceWithVat * existing.count + priceWithVat) / (existing.count + 1);
              existing.count++;
              if (invoice.issueDate > existing.lastInvoiceDate) {
                existing.lastInvoiceDate = invoice.issueDate;
                if (updateStrategy === 'latest') {
                  existing.price = priceWithoutVat;
                  existing.priceWithVat = priceWithVat;
                }
              }
            } else {
              result.pricesExtracted.set(product.code, {
                price: priceWithoutVat,
                priceWithVat: priceWithVat,
                lastInvoiceDate: invoice.issueDate,
                count: 1,
              });
            }
          }
        } catch (error) {
          const errorMsg = `Error processing invoice ${invoice.seriesName}${invoice.number}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      logger.info(`Extracted prices for ${result.pricesExtracted.size} unique products`);

      // Update products in database
      for (const [sku, priceData] of result.pricesExtracted) {
        try {
          const updateResult = await this.dataSource.query(
            `UPDATE products
             SET base_price = $1,
                  currency_code = 'RON',
                  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'cost', ROUND($1::numeric, 4),
                    'cost_with_vat', ROUND($2::numeric, 4),
                    'cost_currency', 'RON',
                    'cost_source', 'smartbill_invoice',
                    'cost_last_invoice_date', $3,
                    'cost_sync_strategy', $4,
                    'cost_occurrences', $5
                  ),
                  updated_at = NOW()
             WHERE sku = $6 AND is_active = true
             RETURNING id`,
            [
              priceData.price,
              priceData.priceWithVat,
              priceData.lastInvoiceDate,
              updateStrategy,
              priceData.count,
              sku,
            ],
          );

          if (updateResult.length > 0) {
            result.productsUpdated++;
            result.productsCostUpdated++;
            logger.debug(`Updated product ${sku} with price ${priceData.price.toFixed(2)} RON`);
          } else {
            logger.warn(`Product not found for SKU: ${sku}`);
          }
        } catch (error) {
          const errorMsg = `Error updating product ${sku}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      logger.info('Price sync completed', {
        totalInvoices: result.totalInvoices,
        totalProducts: result.totalProducts,
        uniqueProducts: result.pricesExtracted.size,
        productsUpdated: result.productsUpdated,
        productsCostUpdated: result.productsCostUpdated,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to sync prices from invoices', error);
      throw error;
    }
  }

  /**
   * Get summary of prices that would be extracted without updating
   */
  async previewPrices(daysBack: number = 90): Promise<{
    totalInvoices: number;
    productPrices: Array<{ sku: string; name: string; price: number; occurrences: number }>;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const invoices = await this.apiClient.getInvoices({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    const pricesMap = new Map<string, { name: string; price: number; count: number }>();

    for (const invoice of invoices) {
      for (const product of invoice.products) {
        if (!product.code || product.price <= 0) continue;

        const priceWithoutVat = product.isTaxIncluded
          ? product.price / (1 + product.taxPercentage / 100)
          : product.price;

        const existing = pricesMap.get(product.code);
        if (existing) {
          existing.price =
            (existing.price * existing.count + priceWithoutVat) / (existing.count + 1);
          existing.count++;
        } else {
          pricesMap.set(product.code, {
            name: product.name,
            price: priceWithoutVat,
            count: 1,
          });
        }
      }
    }

    const productPrices = Array.from(pricesMap.entries()).map(([sku, data]) => ({
      sku,
      name: data.name,
      price: data.price,
      occurrences: data.count,
    }));

    return {
      totalInvoices: invoices.length,
      productPrices: productPrices.sort((a, b) => b.occurrences - a.occurrences),
    };
  }
}
