import { EventEmitter } from 'events';

import { createModuleLogger } from '@shared/utils/logger';
import { translateSupplierProductName } from '@shared/utils/product-name-translator';

import {
  ISupplierRepository,
  SupplierCode,
  SupplierProductEntity,
  SupplierProductSpecification,
} from '../../domain';
import {
  InnproIofClient,
} from '../../infrastructure/iof/InnproIofClient';
import {
  InnproIofGatewayFeeds,
  InnproIofParser,
} from '../../infrastructure/iof/InnproIofParser';
import { InnproScraper } from '../../infrastructure/scrapers/InnproScraper';
import {
  ScrapeError,
  SupplierNotActiveError,
  SupplierNotFoundError,
} from '../errors/supplier.errors';
import { PriceChangeAlert, ScrapeResult } from '../dtos/supplier.dtos';
import { SupplierPricingResolution, SupplierPricingService } from '../services/SupplierPricingService';
import { ScrapedProduct } from '../../domain/ports/IScraper';

const logger = createModuleLogger('sync-innpro-from-iof');

type MergedIofProduct = {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity?: number;
  category?: string;
  imageUrl?: string;
  images?: string[];
  brand?: string;
  manufacturer?: string;
  ean?: string;
  specifications?: ScrapedProduct['specifications'];
  sourceUpdatedAt?: ScrapedProduct['sourceUpdatedAt'];
};

export class SyncInnproFromIof {
  private eventEmitter = new EventEmitter();

  constructor(
    private readonly repository: ISupplierRepository,
    private readonly iofClient: InnproIofClient = new InnproIofClient(),
    private readonly iofParser: InnproIofParser = new InnproIofParser(),
    private readonly supplierPricingService: SupplierPricingService = new SupplierPricingService(repository),
    private readonly innproScraper: InnproScraper = new InnproScraper(),
  ) {}

  async execute(supplierId: number): Promise<ScrapeResult> {
    const startTime = new Date();

    try {
      const supplier = await this.repository.getSupplier(supplierId);
      if (!supplier) {
        throw new SupplierNotFoundError(supplierId);
      }

      if (!supplier.isActive) {
        throw new SupplierNotActiveError(supplier.name);
      }

      if (supplier.code !== SupplierCode.INNPRO) {
        throw new ScrapeError(`Supplier ${supplier.name} is not configured for Innpro IOF sync`, supplierId, supplier.name);
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
        const gatewayRaw = await this.iofClient.readGateway(supplier.credentials);
        const feeds = this.iofParser.parseGateway(gatewayRaw);
        const mergedProducts = await this.readAndMergeFeedProducts(feeds, supplier.credentials);

        result.productsFound = mergedProducts.length;

        const existingProducts = await this.repository.getSupplierProducts(supplier.id);
        const existingBySku = new Map(
          existingProducts.map((product) => [this.normalizeSku(product.supplierSku), product]),
        );

        const productsToUpsert: SupplierProductEntity[] = [];
        const specificationsToUpsert: SupplierProductSpecification[] = [];
        const pricingResolutions = new Map<string, SupplierPricingResolution>();

        for (const mergedProduct of mergedProducts) {
          const normalizedSku = this.normalizeSku(mergedProduct.supplierSku);
          if (!normalizedSku) {
            continue;
          }

          const pricingCacheKey = `${supplier.code}:${
            this.supplierPricingService.normalizeCategoryKey(mergedProduct.category) || '__fallback__'
          }`;
          let pricingResolution = pricingResolutions.get(pricingCacheKey);
          if (!pricingResolution) {
            pricingResolution = await this.supplierPricingService.resolveMarkup(supplier.code, mergedProduct.category);
            pricingResolutions.set(pricingCacheKey, pricingResolution);
          }

          const existingProduct = existingBySku.get(normalizedSku);
          if (existingProduct) {
            const entity = new SupplierProductEntity(existingProduct);
            const nextPrice = mergedProduct.price > 0 ? mergedProduct.price : entity.price;
            const nextSellingPrice = this.supplierPricingService.applyMarkup(
              nextPrice,
              pricingResolution.markupPercentage,
            );

            if (mergedProduct.price > 0 && entity.hasPriceChanged(nextPrice)) {
              const alert: PriceChangeAlert = {
                supplierSku: mergedProduct.supplierSku,
                productName: mergedProduct.name,
                oldPrice: entity.price,
                newPrice: nextPrice,
                changePercentage: entity.priceChangePercentage(nextPrice),
                currency: mergedProduct.currency,
              };

              result.priceChanges.push(alert);
              if (entity.isPriceChangeSignificant(nextPrice)) {
                result.significantPriceChanges.push(alert);
              }
              entity.recordPriceChange(nextPrice);
            }

            entity.name = translateSupplierProductName(mergedProduct.name || mergedProduct.supplierSku);
            entity.price = nextPrice;
            entity.currency = mergedProduct.currency;
            if (typeof mergedProduct.stockQuantity === 'number') {
              entity.stockQuantity = mergedProduct.stockQuantity;
            }
            entity.markupPercentage = pricingResolution.markupPercentage;
            entity.sellingPrice = Number.isFinite(nextSellingPrice) ? nextSellingPrice : null;
            const preferredImageUrl = this.resolvePrimaryImage(mergedProduct);
            if (preferredImageUrl) {
              entity.imageUrl = preferredImageUrl;
            }
            entity.lastScraped = new Date();

            const specification = this.buildProductSpecification(
              supplier.id,
              mergedProduct,
              entity.productId,
            );
            if (specification) {
              specificationsToUpsert.push(specification);
            }

            result.productsUpdated++;
            productsToUpsert.push(entity);
            continue;
          }

          productsToUpsert.push(
            new SupplierProductEntity({
              id: 0,
              supplierId: supplier.id,
              supplierSku: mergedProduct.supplierSku,
              name: translateSupplierProductName(mergedProduct.name || mergedProduct.supplierSku),
              price: mergedProduct.price,
              currency: mergedProduct.currency,
              stockQuantity: typeof mergedProduct.stockQuantity === 'number' ? mergedProduct.stockQuantity : 0,
              lastScraped: new Date(),
              markupPercentage: pricingResolution.markupPercentage,
              sellingPrice: this.supplierPricingService.applyMarkup(
                mergedProduct.price,
                pricingResolution.markupPercentage,
              ),
              imageUrl: this.resolvePrimaryImage(mergedProduct),
              priceHistory: [{ price: mergedProduct.price, date: new Date() }],
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          );

          const specification = this.buildProductSpecification(
            supplier.id,
            mergedProduct,
            0,
          );
          if (specification) {
            specificationsToUpsert.push(specification);
          }

          result.productsCreated++;
        }

        await this.repository.bulkUpsertProducts(productsToUpsert);
        if (specificationsToUpsert.length > 0) {
          result.specificationsDetected = specificationsToUpsert.length;
          result.specificationsUpdated = await this.repository.upsertProductSpecifications(
            specificationsToUpsert,
            {
              conflictPolicy: 'merge_non_empty',
              source: `supplier:${supplier.code}`,
            },
          );
        }
        await this.repository.updateLastSync(supplier.id, new Date());

        this.eventEmitter.emit('sync:complete', {
          supplier: supplier.name,
          result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during Innpro IOF sync';
        logger.error('Innpro IOF sync failed', {
          supplierId,
          message,
        });

        result.success = false;
        result.errors.push(message);

        throw new ScrapeError(`Failed to sync ${supplier.name} via IOF: ${message}`, supplier.id, supplier.name, error instanceof Error ? error : undefined);
      } finally {
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
      }

      return result;
    } catch (error) {
      if (error instanceof SupplierNotFoundError || error instanceof ScrapeError) {
        throw error;
      }

      throw new ScrapeError(
        error instanceof Error ? error.message : 'Unknown Innpro IOF sync error',
        supplierId,
        'innpro',
        error instanceof Error ? error : undefined,
      );
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  private async readAndMergeFeedProducts(
    feeds: InnproIofGatewayFeeds,
    credentials: { username: string; password: string; apiKey?: string; customHeader?: Record<string, string> },
  ): Promise<MergedIofProduct[]> {
    if (!feeds.full) {
      throw new Error('Innpro IOF gateway does not provide a full feed URL');
    }

    const fullRaw = await this.iofClient.readFeed(feeds.full, credentials);
    const fullProducts = this.iofParser.parseProducts(fullRaw);

    const merged = new Map<string, MergedIofProduct>();

    for (const product of fullProducts) {
      const key = this.normalizeSku(product.supplierSku);
      if (!key) {
        continue;
      }
      merged.set(key, {
        supplierSku: String(product.supplierSku || '').trim(),
        name: String(product.name || '').trim(),
        price: Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
        currency: String(product.currency || 'RON').trim() || 'RON',
        stockQuantity: this.toOptionalStock(product.stockQuantity),
        category: product.category,
        imageUrl: product.imageUrl,
        images: product.images,
        brand: product.brand,
        manufacturer: product.manufacturer,
        ean: product.ean,
        specifications: product.specifications,
        sourceUpdatedAt: product.sourceUpdatedAt,
      });
    }

    const mergeFromFeed = async (url: string | undefined): Promise<void> => {
      if (!url) {
        return;
      }

      const raw = await this.iofClient.readFeed(url, credentials);
      const updates = this.iofParser.parseProducts(raw);

      for (const product of updates) {
        const key = this.normalizeSku(product.supplierSku);
        if (!key || !merged.has(key)) {
          if (!key) {
            continue;
          }

          merged.set(key, {
            supplierSku: String(product.supplierSku || '').trim(),
            name: String(product.name || '').trim(),
            price: Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
            currency: String(product.currency || 'RON').trim() || 'RON',
            stockQuantity: this.toOptionalStock(product.stockQuantity),
            category: product.category,
            imageUrl: product.imageUrl,
            images: product.images,
            brand: product.brand,
            manufacturer: product.manufacturer,
            ean: product.ean,
            specifications: product.specifications,
            sourceUpdatedAt: product.sourceUpdatedAt,
          });
          continue;
        }

        const current = merged.get(key)!;
        merged.set(key, {
          ...current,
          name: String(product.name || '').trim() || current.name,
          price: Number(product.price) > 0 ? Number(product.price) : current.price,
          currency: String(product.currency || '').trim() || current.currency,
          stockQuantity: this.toOptionalStock(product.stockQuantity) ?? current.stockQuantity,
          category: String(product.category || '').trim() || current.category,
          imageUrl: String(product.imageUrl || '').trim() || current.imageUrl,
          images: this.mergeImageCollections(current.images, product.images, product.imageUrl),
          brand: String(product.brand || '').trim() || current.brand,
          manufacturer: String(product.manufacturer || '').trim() || current.manufacturer,
          ean: String(product.ean || '').trim() || current.ean,
          specifications: product.specifications || current.specifications,
          sourceUpdatedAt: product.sourceUpdatedAt || current.sourceUpdatedAt,
        });
      }
    };

    const mergeOptionalFeed = async (label: 'light' | 'fullChange', url: string | undefined): Promise<void> => {
      if (!url) {
        return;
      }

      try {
        await mergeFromFeed(url);
      } catch (error) {
        logger.warn('Optional Innpro IOF feed merge failed, continuing with available data', {
          feed: label,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    await mergeOptionalFeed('light', feeds.light);
    await mergeOptionalFeed('fullChange', feeds.fullChange);

    await this.applyTargetedFallbackForMissingFields(merged, credentials);

    for (const [key, product] of merged.entries()) {
      merged.set(key, {
        ...product,
        name: product.name || product.supplierSku,
      });
    }

    return Array.from(merged.values());
  }

  private async applyTargetedFallbackForMissingFields(
    merged: Map<string, MergedIofProduct>,
    credentials: { username: string; password: string; apiKey?: string; customHeader?: Record<string, string> },
  ): Promise<void> {
    const affectedSkus = Array.from(merged.values())
      .filter((product) => this.hasMissingCriticalFields(product))
      .map((product) => this.normalizeSku(product.supplierSku))
      .filter((sku) => sku.length > 0);

    if (affectedSkus.length === 0) {
      return;
    }

    try {
      const fallbackProducts = await this.innproScraper.scrapeProductsBySkus(credentials, affectedSkus);
      const fallbackBySku = new Map(
        fallbackProducts.map((product) => [this.normalizeSku(product.supplierSku), product]),
      );

      for (const sku of affectedSkus) {
        const current = merged.get(sku);
        const fallback = fallbackBySku.get(sku);
        if (!current || !fallback) {
          continue;
        }

        merged.set(sku, this.mergeFallbackFields(current, fallback));
      }
    } catch (error) {
      logger.warn('Innpro targeted fallback scraping failed, continuing with IOF data', {
        affectedSkus: affectedSkus.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private hasMissingCriticalFields(product: MergedIofProduct): boolean {
    return (
      String(product.name || '').trim().length === 0
      || !(Number.isFinite(product.price) && product.price > 0)
      || !(typeof product.stockQuantity === 'number' && Number.isFinite(product.stockQuantity))
    );
  }

  private mergeFallbackFields(product: MergedIofProduct, fallback: ScrapedProduct): MergedIofProduct {
    const fallbackPrice = Number(fallback.price);
    const fallbackStock = this.toOptionalStock(fallback.stockQuantity);

    return {
      ...product,
      name: product.name || String(fallback.name || '').trim(),
      price:
        Number.isFinite(product.price) && product.price > 0
          ? product.price
          : (Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : product.price),
      currency: product.currency || String(fallback.currency || '').trim() || 'RON',
      stockQuantity:
        typeof product.stockQuantity === 'number' && Number.isFinite(product.stockQuantity)
          ? product.stockQuantity
          : fallbackStock,
      category: product.category || fallback.category,
      imageUrl: product.imageUrl || fallback.imageUrl,
      images: this.mergeImageCollections(product.images, fallback.images, fallback.imageUrl),
      brand: product.brand || fallback.brand,
      manufacturer: product.manufacturer || fallback.manufacturer,
      ean: product.ean || fallback.ean,
      specifications: product.specifications || fallback.specifications,
      sourceUpdatedAt: product.sourceUpdatedAt || fallback.sourceUpdatedAt,
    };
  }

  private buildProductSpecification(
    supplierId: number,
    product: MergedIofProduct,
    productId: number | undefined,
  ): SupplierProductSpecification | null {
    const normalizedSku = String(product.supplierSku || '').trim();
    if (!normalizedSku) {
      return null;
    }

    const specs = product.specifications;
    const hasSpecPayload = specs && Object.keys(specs).length > 0;
    const hasLooseFields = Boolean(product.brand || product.manufacturer || product.ean);

    if (!hasSpecPayload && !hasLooseFields) {
      return null;
    }

    const normalizedProductId = typeof productId === 'number' && Number.isFinite(productId) && productId > 0
      ? productId
      : 0;

    const customSpecs: Record<string, unknown> = {
      ...(specs?.customSpecs || {}),
    };

    if (Array.isArray(product.images) && product.images.length > 0) {
      customSpecs.imageGallery = product.images;
    }

    return {
      productId: normalizedProductId,
      supplierId,
      supplierSku: normalizedSku,
      brand: product.brand,
      manufacturer: product.manufacturer,
      eanCode: product.ean,
      countryOfOrigin: specs?.countryOfOrigin,
      wattage: specs?.wattage,
      lumens: specs?.lumens,
      colorTemperature: specs?.colorTemperature,
      cri: specs?.cri,
      beamAngle: specs?.beamAngle,
      ipRating: specs?.ipRating,
      efficacy: specs?.efficacy,
      dimmable: specs?.dimmable,
      dimmingType: specs?.dimmingType,
      voltageInput: specs?.voltageInput,
      voltageOutput: specs?.voltageOutput,
      powerFactor: specs?.powerFactor,
      frequency: specs?.frequency,
      mountingType: specs?.mountingType,
      material: specs?.material,
      color: specs?.color,
      lifespanHours: specs?.lifespanHours,
      warrantyYears: specs?.warrantyYears,
      certificationCe: specs?.certificationCe,
      certificationRohs: specs?.certificationRohs,
      certificationUl: specs?.certificationUl,
      certificationEtl: specs?.certificationEtl,
      certificationEnec: specs?.certificationEnec,
      energyClass: specs?.energyClass,
      datasheetUrl: specs?.datasheetUrl,
      iesFileUrl: specs?.iesFileUrl,
      installationGuideUrl: specs?.installationGuideUrl,
      customSpecs: Object.keys(customSpecs).length > 0 ? customSpecs : undefined,
      sourceUpdatedAt: product.sourceUpdatedAt ? new Date(product.sourceUpdatedAt) : new Date(),
    };
  }

  private resolvePrimaryImage(product: MergedIofProduct): string | undefined {
    const direct = String(product.imageUrl || '').trim();
    if (direct.length > 0) {
      return direct;
    }

    if (Array.isArray(product.images)) {
      for (const image of product.images) {
        const normalized = String(image || '').trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    return undefined;
  }

  private mergeImageCollections(
    currentImages?: string[],
    incomingImages?: string[],
    incomingPrimary?: string,
  ): string[] | undefined {
    const merged = new Set<string>();

    if (Array.isArray(currentImages)) {
      currentImages
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0)
        .forEach((value) => merged.add(value));
    }

    const normalizedPrimary = String(incomingPrimary || '').trim();
    if (normalizedPrimary.length > 0) {
      merged.add(normalizedPrimary);
    }

    if (Array.isArray(incomingImages)) {
      incomingImages
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0)
        .forEach((value) => merged.add(value));
    }

    return merged.size > 0 ? Array.from(merged.values()) : undefined;
  }

  private toOptionalStock(stockQuantity: unknown): number | undefined {
    if (typeof stockQuantity !== 'number' || !Number.isFinite(stockQuantity)) {
      return undefined;
    }

    return Math.round(stockQuantity);
  }

  private normalizeSku(value: string): string {
    return String(value || '').trim().toUpperCase();
  }
}
