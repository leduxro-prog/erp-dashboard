import { ISupplierRepository, SupplierProductEntity } from '../../domain';
import { IScraperFactory } from '../../domain/ports/IScraper';
import { ScrapeError, SupplierNotFoundError, SupplierNotActiveError } from '../errors/supplier.errors';
import { ScrapeResult, PriceChangeAlert } from '../dtos/supplier.dtos';
import { EventEmitter } from 'events';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('scrape-supplier-stock');

export interface ScrapedProduct {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
}

export class ScrapeSupplierStock {
  private eventEmitter: EventEmitter;

  constructor(
    private repository: ISupplierRepository,
    private scraperFactory: IScraperFactory,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  async execute(supplierId: number): Promise<ScrapeResult> {
    const startTime = new Date();

    try {
      // Get supplier configuration
      const supplier = await this.repository.getSupplier(supplierId);
      if (!supplier) {
        throw new SupplierNotFoundError(supplierId);
      }

      if (!supplier.isActive) {
        throw new SupplierNotActiveError(supplier.name);
      }

      const result: ScrapeResult = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        productsFound: 0,
        productsUpdated: 0,
        productsCreated: 0,
        priceChanges: [],
        significantPriceChanges: [],
        errors: [],
        duration: 0,
        startTime,
        endTime: new Date(),
        success: true,
      };

      try {
        // Get scraper for this supplier
        const scraper = this.scraperFactory.getScraper(supplier.code);

        // Run scraper
        const scrapedProducts = await scraper.scrapeProducts(
          supplier.credentials,
        );

        result.productsFound = scrapedProducts.length;

        // Get existing products
        const existingProducts = await this.repository.getSupplierProducts(
          supplierId,
        );
        const existingMap = new Map(
          existingProducts.map((p) => [p.supplierSku, p]),
        );

        // Process scraped products
        const productsToUpsert: SupplierProductEntity[] = [];

        for (const scrapedProduct of scrapedProducts) {
          const existingProduct = existingMap.get(scrapedProduct.supplierSku);

          let productEntity: SupplierProductEntity;

          if (existingProduct) {
            // Update existing product
            productEntity = new SupplierProductEntity(existingProduct);

            // Check for price changes
            if (productEntity.hasPriceChanged(scrapedProduct.price)) {
              const changePercentage = productEntity.priceChangePercentage(
                scrapedProduct.price,
              );

              const alert: PriceChangeAlert = {
                supplierSku: scrapedProduct.supplierSku,
                productName: scrapedProduct.name,
                oldPrice: productEntity.price,
                newPrice: scrapedProduct.price,
                changePercentage,
                currency: scrapedProduct.currency,
              };

              result.priceChanges.push(alert);

              if (
                productEntity.isPriceChangeSignificant(scrapedProduct.price)
              ) {
                result.significantPriceChanges.push(alert);
              }

              productEntity.recordPriceChange(scrapedProduct.price);
            }

            productEntity.price = scrapedProduct.price;
            productEntity.stockQuantity = scrapedProduct.stockQuantity;
            productEntity.lastScraped = new Date();
            result.productsUpdated++;
          } else {
            // Create new product
            productEntity = new SupplierProductEntity({
              id: 0, // Will be assigned by repository
              supplierId,
              supplierSku: scrapedProduct.supplierSku,
              name: scrapedProduct.name,
              price: scrapedProduct.price,
              currency: scrapedProduct.currency,
              stockQuantity: scrapedProduct.stockQuantity,
              lastScraped: new Date(),
              priceHistory: [
                {
                  price: scrapedProduct.price,
                  date: new Date(),
                },
              ],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            result.productsCreated++;
          }

          productsToUpsert.push(productEntity);
        }

        // Bulk upsert products
        if (productsToUpsert.length > 0) {
          await this.repository.bulkUpsertProducts(productsToUpsert);
        }

        // Update last sync time
        await this.repository.updateLastSync(supplierId, new Date());

        // Emit success event
        this.eventEmitter.emit('scrape:complete', {
          supplier: supplier.name,
          result,
        });
      } catch (error) {
        result.success = false;
        if (error instanceof Error) {
          result.errors.push(error.message);
        } else {
          result.errors.push('Unknown error during scraping');
        }

        throw new ScrapeError(
          `Failed to scrape ${supplier.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          supplierId,
          supplier.name,
          error instanceof Error ? error : undefined,
        );
      } finally {
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
      }

      return result;
    } catch (error) {
      const endTime = new Date();
      if (error instanceof ScrapeError || error instanceof SupplierNotFoundError) {
        throw error;
      }

      throw new ScrapeError(
        error instanceof Error ? error.message : 'Unknown scrape error',
        supplierId,
        'unknown',
        error instanceof Error ? error : undefined,
      );
    }
  }

  async executeAll(): Promise<ScrapeResult[]> {
    const suppliers = await this.repository.listSuppliers(true);
    const results: ScrapeResult[] = [];

    for (const supplier of suppliers) {
      try {
        const result = await this.execute(supplier.id);
        results.push(result);
      } catch (error) {
        // Log error but continue with next supplier
        logger.error(
          `Error scraping supplier ${supplier.name}:`,
          { error },
        );

        results.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          productsFound: 0,
          productsUpdated: 0,
          productsCreated: 0,
          priceChanges: [],
          significantPriceChanges: [],
          errors: [
            error instanceof Error ? error.message : 'Unknown error',
          ],
          duration: 0,
          startTime: new Date(),
          endTime: new Date(),
          success: false,
        });
      }
    }

    return results;
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}
