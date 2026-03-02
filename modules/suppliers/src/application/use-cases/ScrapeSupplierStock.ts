import { EventEmitter } from 'events';

import {
  ensureManufacturerInProductName,
} from '@shared/utils/product-name-manufacturer';
import { translateSupplierProductName } from '@shared/utils/product-name-translator';
import { createModuleLogger } from '@shared/utils/logger';

import {
  ISupplierRepository,
  SupplierProductEntity,
  SupplierProductSpecification,
} from '../../domain';
import { SupplierCode } from '../../domain/entities/Supplier';
import { IScraperFactory, ScrapedProduct } from '../../domain/ports/IScraper';
import { BnrExchangeRateService } from '../../infrastructure/services/BnrExchangeRateService';
import {
  ScrapeError,
  SupplierNotFoundError,
  SupplierNotActiveError,
} from '../errors/supplier.errors';
import { ScrapeResult, PriceChangeAlert } from '../dtos/supplier.dtos';

const logger = createModuleLogger('scrape-supplier-stock');

export type { ScrapedProduct };

export class ScrapeSupplierStock {
  private eventEmitter: EventEmitter;
  private readonly upsertBatchSize: number;

  constructor(
    private repository: ISupplierRepository,
    private scraperFactory: IScraperFactory,
  ) {
    this.eventEmitter = new EventEmitter();
    const rawBatchSize = Number(process.env.SUPPLIER_UPSERT_BATCH_SIZE);
    this.upsertBatchSize =
      Number.isFinite(rawBatchSize) && rawBatchSize >= 10 ? Math.floor(rawBatchSize) : 20;
  }

  private isStatementTimeoutError(error: unknown): boolean {
    const pgCode = (error as { code?: string } | undefined)?.code;
    const message = error instanceof Error ? error.message : String(error || '');
    return (
      pgCode === '57014' ||
      /query read timeout/i.test(message) ||
      /statement timeout/i.test(message) ||
      /canceling statement/i.test(message)
    );
  }

  private async upsertWithRetry(products: SupplierProductEntity[]): Promise<void> {
    if (products.length === 0) {
      return;
    }

    try {
      await this.repository.bulkUpsertProducts(products);
      return;
    } catch (error) {
      if (!this.isStatementTimeoutError(error) || products.length <= 1) {
        throw error;
      }

      const midpoint = Math.ceil(products.length / 2);
      const left = products.slice(0, midpoint);
      const right = products.slice(midpoint);

      logger.warn('Supplier bulk upsert timed out, retrying with smaller chunks', {
        originalBatchSize: products.length,
        leftBatchSize: left.length,
        rightBatchSize: right.length,
      });

      await this.upsertWithRetry(left);
      await this.upsertWithRetry(right);
    }
  }

  private parseOptionalNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseOptionalInt(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  private parseOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
    }

    return undefined;
  }

  private parseOptionalText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeAttributeKey(key: string): string {
    return String(key || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private parseNumberFromUnknown(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.replace(',', '.');
    const match = normalized.match(/(-?\d+(?:\.\d+)?)/);
    if (!match) {
      return undefined;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseIpFromUnknown(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const match = value.toUpperCase().match(/\bIP\s?([0-6][0-9])\b/);
    return match ? `IP${match[1]}` : undefined;
  }

  private parseVoltageFromUnknown(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const upper = value.toUpperCase();
    const range = upper.match(/\b(\d{2,3}\s*-\s*\d{2,3}\s*V)\b/);
    if (range?.[1]) {
      return range[1].replace(/\s+/g, '');
    }

    const single = upper.match(/\b(12|24|48|110|120|220|230|240)\s*V\b/);
    return single?.[1] ? `${single[1]}V` : undefined;
  }

  private extractSpecsFromAttributes(attributes: Record<string, unknown> | undefined): {
    wattage?: number;
    lumens?: number;
    colorTemperature?: number;
    cri?: number;
    beamAngle?: number;
    ipRating?: string;
    voltageInput?: string;
    mountingType?: string;
  } {
    if (!attributes || typeof attributes !== 'object') {
      return {};
    }

    const result: {
      wattage?: number;
      lumens?: number;
      colorTemperature?: number;
      cri?: number;
      beamAngle?: number;
      ipRating?: string;
      voltageInput?: string;
      mountingType?: string;
    } = {};

    for (const [rawKey, rawValue] of Object.entries(attributes)) {
      const key = this.normalizeAttributeKey(rawKey);

      if (!result.wattage && (key.includes('watt') || key === 'power')) {
        const n = this.parseNumberFromUnknown(rawValue);
        if (Number.isFinite(n)) {
          result.wattage = n;
        }
      }

      if (!result.lumens && (key.includes('lumen') || key.includes('luminousflux'))) {
        const n = this.parseNumberFromUnknown(rawValue);
        if (Number.isFinite(n)) {
          result.lumens = Math.round(n as number);
        }
      }

      if (
        !result.colorTemperature &&
        (key.includes('colortemp') || key.includes('colourtemp') || key.includes('kelvin') || key === 'cct')
      ) {
        const n = this.parseNumberFromUnknown(rawValue);
        if (Number.isFinite(n)) {
          result.colorTemperature = Math.round(n as number);
        }
      }

      if (!result.cri && (key === 'cri' || key === 'ra' || key.includes('colorrender'))) {
        const n = this.parseNumberFromUnknown(rawValue);
        if (Number.isFinite(n)) {
          result.cri = Math.round(n as number);
        }
      }

      if (!result.beamAngle && (key.includes('beamangle') || key === 'beam')) {
        const n = this.parseNumberFromUnknown(rawValue);
        if (Number.isFinite(n)) {
          result.beamAngle = Math.round(n as number);
        }
      }

      if (!result.ipRating && (key === 'ip' || key.includes('iprating') || key.includes('protection'))) {
        const ip = this.parseIpFromUnknown(rawValue);
        if (ip) {
          result.ipRating = ip;
        }
      }

      if (!result.voltageInput && (key.includes('voltage') || key.includes('inputvolt'))) {
        const voltage = this.parseVoltageFromUnknown(rawValue);
        if (voltage) {
          result.voltageInput = voltage;
        }
      }

      if (
        !result.mountingType &&
        (key.includes('mount') || key.includes('install') || key.includes('fitting')) &&
        typeof rawValue === 'string' &&
        rawValue.trim().length > 0
      ) {
        result.mountingType = rawValue.trim();
      }
    }

    return result;
  }

  private normalizeCustomSpecs(
    attributes: Record<string, string | number | boolean> | undefined,
    customSpecs: unknown,
  ): Record<string, unknown> | undefined {
    const merged: Record<string, unknown> = {};

    if (attributes && typeof attributes === 'object') {
      Object.assign(merged, attributes);
    }

    if (customSpecs && typeof customSpecs === 'object') {
      Object.assign(merged, customSpecs);
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private extractSpecsFromName(rawName: string | undefined): {
    wattage?: number;
    lumens?: number;
    colorTemperature?: number;
    ipRating?: string;
    voltageInput?: string;
    cri?: number;
    beamAngle?: number;
    mountingType?: string;
  } {
    const name = String(rawName || '').trim();
    if (!name) {
      return {};
    }

    const upper = name.toUpperCase();

    const wattageMatch = upper.match(/(\d+(?:[.,]\d+)?)\s*W\b/);
    const lumensMatch = upper.match(/(\d{3,6})\s*LM\b/);
    const kelvinMatch = upper.match(/(2200|2700|3000|3500|4000|4500|5000|5500|6000|6500)\s*K\b/);
    const ipMatch = upper.match(/\bIP\s?([0-6]\d)\b/);
    const voltageRangeMatch = upper.match(/\b(\d{2,3}\s*-\s*\d{2,3}\s*V)\b/);
    const voltageSingleMatch = upper.match(/\b(12|24|48|110|120|220|230|240)\s*V\b/);
    const criMatch = upper.match(/\bCRI\s*([7-9]\d)\b|\bRA\s*([7-9]\d)\b/);
    const beamAngleMatch = upper.match(/\b(\d{2,3})\s*(?:DEG|DEGREES|°)\b/);

    let mountingType: string | undefined;
    if (/(INCASTR|RECESSED)/.test(upper)) {
      mountingType = 'Incastrat';
    } else if (/(SUSPEND|PENDANT)/.test(upper)) {
      mountingType = 'Suspendat';
    } else if (/(APLICAT|SURFACE|PLAFONIER|CEILING)/.test(upper)) {
      mountingType = 'Aplicat';
    } else if (/(STALP|POLE)/.test(upper)) {
      mountingType = 'Stalp';
    }

    const wattage = wattageMatch ? Number(wattageMatch[1].replace(',', '.')) : undefined;
    const lumens = lumensMatch ? Number(lumensMatch[1]) : undefined;
    const colorTemperature = kelvinMatch ? Number(kelvinMatch[1]) : undefined;
    const ipRating = ipMatch ? `IP${ipMatch[1]}` : undefined;
    const voltageInput = voltageRangeMatch?.[1] || voltageSingleMatch?.[0];
    const cri = criMatch ? Number(criMatch[1] || criMatch[2]) : undefined;
    const beamAngle = beamAngleMatch ? Number(beamAngleMatch[1]) : undefined;

    return {
      wattage: Number.isFinite(wattage as number) ? wattage : undefined,
      lumens: Number.isFinite(lumens as number) ? Math.round(lumens as number) : undefined,
      colorTemperature: Number.isFinite(colorTemperature as number)
        ? Math.round(colorTemperature as number)
        : undefined,
      ipRating,
      voltageInput,
      cri: Number.isFinite(cri as number) ? Math.round(cri as number) : undefined,
      beamAngle: Number.isFinite(beamAngle as number) ? Math.round(beamAngle as number) : undefined,
      mountingType,
    };
  }

  private pickBestImageUrl(scrapedProduct: ScrapedProduct): string | null {
    const directImage = this.parseOptionalText(scrapedProduct.imageUrl);
    if (directImage) {
      return directImage;
    }

    if (Array.isArray(scrapedProduct.images)) {
      for (const image of scrapedProduct.images) {
        const normalized = this.parseOptionalText(image);
        if (normalized) {
          return normalized;
        }
      }
    }

    return null;
  }

  private getManufacturerForName(scrapedProduct: ScrapedProduct, supplierName: string): string {
    return (
      this.parseOptionalText(scrapedProduct.manufacturer) ||
      this.parseOptionalText(scrapedProduct.brand) ||
      this.parseOptionalText(supplierName) ||
      ''
    );
  }

  private buildProductSpecification(
    supplierId: number,
    scrapedProduct: ScrapedProduct,
    productId: number | undefined,
    supplierName: string,
  ): SupplierProductSpecification | null {
    const normalizedProductId = Number(productId);
    if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
      return null;
    }

    const specs = scrapedProduct.specifications;
    const derivedFromAttributes = this.extractSpecsFromAttributes(
      scrapedProduct.attributes as Record<string, unknown> | undefined,
    );
    const derivedSpecs = this.extractSpecsFromName(scrapedProduct.name);
    const hasStructuredSpecs = specs && Object.keys(specs).length > 0;
    const hasLooseData =
      Boolean(scrapedProduct.ean) ||
      Boolean(scrapedProduct.brand) ||
      Boolean(scrapedProduct.manufacturer) ||
      Boolean(this.parseOptionalText(supplierName)) ||
      Object.keys(derivedSpecs).length > 0 ||
      Object.keys(derivedFromAttributes).length > 0 ||
      Boolean(scrapedProduct.attributes && Object.keys(scrapedProduct.attributes).length > 0);

    if (!hasStructuredSpecs && !hasLooseData) {
      return null;
    }

    const customSpecs = this.normalizeCustomSpecs(scrapedProduct.attributes, specs?.customSpecs);

      return {
      productId: normalizedProductId,
      supplierId,
      supplierSku: scrapedProduct.supplierSku,
      brand:
        this.parseOptionalText(scrapedProduct.brand) ||
        this.parseOptionalText(scrapedProduct.manufacturer) ||
        this.parseOptionalText(supplierName),
      manufacturer: this.parseOptionalText(scrapedProduct.manufacturer),
      countryOfOrigin: this.parseOptionalText(specs?.countryOfOrigin),
      eanCode: this.parseOptionalText(scrapedProduct.ean),
      wattage: this.parseOptionalNumber(
        specs?.wattage ?? derivedFromAttributes.wattage ?? derivedSpecs.wattage,
      ),
      lumens: this.parseOptionalInt(specs?.lumens ?? derivedFromAttributes.lumens ?? derivedSpecs.lumens),
      colorTemperature: this.parseOptionalInt(
        specs?.colorTemperature ?? derivedFromAttributes.colorTemperature ?? derivedSpecs.colorTemperature,
      ),
      cri: this.parseOptionalInt(specs?.cri ?? derivedFromAttributes.cri ?? derivedSpecs.cri),
      beamAngle: this.parseOptionalInt(
        specs?.beamAngle ?? derivedFromAttributes.beamAngle ?? derivedSpecs.beamAngle,
      ),
      ipRating: this.parseOptionalText(
        specs?.ipRating ?? derivedFromAttributes.ipRating ?? derivedSpecs.ipRating,
      ),
      efficacy: this.parseOptionalNumber(specs?.efficacy),
      dimmable: this.parseOptionalBoolean(specs?.dimmable),
      dimmingType: this.parseOptionalText(specs?.dimmingType),
      voltageInput: this.parseOptionalText(
        specs?.voltageInput ?? derivedFromAttributes.voltageInput ?? derivedSpecs.voltageInput,
      ),
      voltageOutput: this.parseOptionalText(specs?.voltageOutput),
      powerFactor: this.parseOptionalNumber(specs?.powerFactor),
      frequency: this.parseOptionalText(specs?.frequency),
      mountingType: this.parseOptionalText(
        specs?.mountingType ?? derivedFromAttributes.mountingType ?? derivedSpecs.mountingType,
      ),
      material: this.parseOptionalText(specs?.material),
      color: this.parseOptionalText(specs?.color),
      lifespanHours: this.parseOptionalInt(specs?.lifespanHours),
      warrantyYears: this.parseOptionalInt(specs?.warrantyYears),
      certificationCe: this.parseOptionalBoolean(specs?.certificationCe),
      certificationRohs: this.parseOptionalBoolean(specs?.certificationRohs),
      certificationUl: this.parseOptionalBoolean(specs?.certificationUl),
      certificationEtl: this.parseOptionalBoolean(specs?.certificationEtl),
      certificationEnec: this.parseOptionalBoolean(specs?.certificationEnec),
      energyClass: this.parseOptionalText(specs?.energyClass),
      datasheetUrl: this.parseOptionalText(specs?.datasheetUrl),
      iesFileUrl: this.parseOptionalText(specs?.iesFileUrl),
      installationGuideUrl: this.parseOptionalText(specs?.installationGuideUrl),
      customSpecs,
      sourceUpdatedAt: scrapedProduct.sourceUpdatedAt
        ? new Date(scrapedProduct.sourceUpdatedAt)
        : new Date(),
    };
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
        specificationsDetected: 0,
        specificationsUpdated: 0,
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
        const scrapedProducts = await scraper.scrapeProducts(supplier.credentials);

        const sourceCurrencies = new Set<string>();
        for (const product of scrapedProducts) {
          const normalized = (product.currency || '').trim().toUpperCase();
          if (normalized) {
            sourceCurrencies.add(normalized);
          }
        }

        if (supplier.code === SupplierCode.ACA_LIGHTING && !sourceCurrencies.has('EUR')) {
          sourceCurrencies.add('EUR');
        }

        const currenciesToConvert = Array.from(sourceCurrencies).filter(
          (currency) => currency === 'EUR' || currency === 'PLN',
        );
        const conversionRates = new Map<string, number>();

        if (currenciesToConvert.length > 0) {
          const bnrService = new BnrExchangeRateService(5);

          for (const currency of currenciesToConvert) {
            try {
              const rate = await bnrService.getCurrencyToRonRate(currency);
              conversionRates.set(currency, rate);
            } catch (error) {
              logger.warn('Missing BNR conversion rate for supplier currency', {
                supplierId,
                supplierCode: supplier.code,
                currency,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (conversionRates.size > 0) {
            logger.info('Applying BNR+5% conversion for supplier sync', {
              supplierId,
              supplierCode: supplier.code,
              conversionRates: Object.fromEntries(conversionRates.entries()),
            });
          }
        }

        result.productsFound = scrapedProducts.length;

        // Get existing products
        const existingProducts = await this.repository.getSupplierProducts(supplierId);
        const existingMap = new Map(existingProducts.map((p) => [p.supplierSku, p]));

        // Process scraped products
        const productsToUpsert = new Map<string, SupplierProductEntity>();
        const specsToUpsert: SupplierProductSpecification[] = [];

        const flushBatch = async (): Promise<void> => {
          if (productsToUpsert.size === 0) {
            return;
          }

          await this.upsertWithRetry(Array.from(productsToUpsert.values()));
          productsToUpsert.clear();
        };

        for (const scrapedProduct of scrapedProducts) {
          const normalizedCurrency = (scrapedProduct.currency || '').toUpperCase();
          const sourceCurrency =
            normalizedCurrency || (supplier.code === SupplierCode.ACA_LIGHTING ? 'EUR' : 'RON');
          const conversionRate = sourceCurrency === 'RON' ? null : conversionRates.get(sourceCurrency) || null;
          const convertedPrice =
            sourceCurrency !== 'RON' && conversionRate
              ? Math.round(Number(scrapedProduct.price || 0) * conversionRate * 100) / 100
              : Number(scrapedProduct.price || 0);
          const priceCurrency = sourceCurrency !== 'RON' && conversionRate ? 'RON' : sourceCurrency;

          const translatedName = translateSupplierProductName(scrapedProduct.name);
          const normalizedName = ensureManufacturerInProductName(
            translatedName,
            this.getManufacturerForName(scrapedProduct, supplier.name),
          );
          const preferredImageUrl = this.pickBestImageUrl(scrapedProduct);
          const existingProduct = existingMap.get(scrapedProduct.supplierSku);

          let productEntity: SupplierProductEntity;

          if (existingProduct) {
            // Update existing product
            productEntity = new SupplierProductEntity(existingProduct);
            const nextPrice = convertedPrice > 0 ? convertedPrice : productEntity.price;

            // Check for price changes
            if (convertedPrice > 0 && productEntity.hasPriceChanged(nextPrice)) {
              const changePercentage = productEntity.priceChangePercentage(nextPrice);

              const alert: PriceChangeAlert = {
                supplierSku: scrapedProduct.supplierSku,
                productName: normalizedName,
                oldPrice: productEntity.price,
                newPrice: nextPrice,
                changePercentage,
                currency: priceCurrency,
              };

              result.priceChanges.push(alert);

              if (productEntity.isPriceChangeSignificant(nextPrice)) {
                result.significantPriceChanges.push(alert);
              }

              productEntity.recordPriceChange(nextPrice);
            }

            productEntity.name = normalizedName;
            productEntity.price = nextPrice;
            productEntity.currency = priceCurrency;
            productEntity.stockQuantity = scrapedProduct.stockQuantity;
            if (preferredImageUrl) {
              productEntity.imageUrl = preferredImageUrl;
            }
            productEntity.lastScraped = new Date();
            result.productsUpdated++;
          } else {
            // Create new product
            productEntity = new SupplierProductEntity({
              id: 0, // Will be assigned by repository
              supplierId,
              supplierSku: scrapedProduct.supplierSku,
              name: normalizedName,
              price: convertedPrice,
              currency: priceCurrency,
              stockQuantity: scrapedProduct.stockQuantity,
              lastScraped: new Date(),
              markupPercentage: null,
              sellingPrice: null,
              imageUrl: preferredImageUrl,
              priceHistory: [
                {
                  price: convertedPrice,
                  date: new Date(),
                },
              ],
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            result.productsCreated++;
          }

          const batchKey = String(productEntity.supplierSku || '').trim().toUpperCase();
          if (batchKey.length > 0) {
            productsToUpsert.set(batchKey, productEntity);
          }

          const spec = this.buildProductSpecification(
            supplierId,
            scrapedProduct,
            productEntity.productId,
            supplier.name,
          );
          if (spec) {
            specsToUpsert.push(spec);
          }

          if (productsToUpsert.size >= this.upsertBatchSize) {
            await flushBatch();
          }
        }

        // Bulk upsert products
        await flushBatch();

        if (specsToUpsert.length > 0) {
          result.specificationsDetected = specsToUpsert.length;
          result.specificationsUpdated = await this.repository.upsertProductSpecifications(specsToUpsert, {
            conflictPolicy: 'merge_non_empty',
            source: `supplier:${supplier.code}`,
          });
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
        logger.error(`Error scraping supplier ${supplier.name}:`, { error });

        results.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          productsFound: 0,
          productsUpdated: 0,
          productsCreated: 0,
          specificationsDetected: 0,
          specificationsUpdated: 0,
          priceChanges: [],
          significantPriceChanges: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
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
