/**
 * GenerateProductSeo Use Case
 *
 * Automatically generates SEO metadata for a product.
 * Creates meta title, description, slug, structured data, and OG tags.
 *
 * ### Process
 * 1. Fetch product data
 * 2. Generate meta title and description using templates
 * 3. Generate URL slug from product name
 * 4. Generate JSON-LD structured data
 * 5. Generate OpenGraph tags
 * 6. Calculate SEO score
 * 7. Save metadata to database
 * 8. Publish event for metadata generated
 *
 * ### Dependencies
 * - IProductPort: Fetch product data
 * - ISeoMetadataRepository: Save metadata
 * - MetaTagGenerator: Generate meta tags
 * - SlugGenerator: Generate slug
 * - StructuredDataGenerator: Generate schema
 * - SeoScoreCalculator: Calculate score
 * - EventBus: Publish events
 *
 * @example
 * const useCase = new GenerateProductSeo(
 *   productPort,
 *   metadataRepo,
 *   structuredDataRepo,
 *   metaTagGenerator,
 *   slugGenerator,
 *   structuredDataGenerator,
 *   scoreCalculator,
 *   eventBus,
 *   logger
 * );
 *
 * const result = await useCase.execute({ productId: 'prod-123', locale: 'ro' });
 * // Returns: { metadata, structuredData, score }
 */

import { Logger } from 'winston';
import { SeoMetadata } from '../../domain/entities/SeoMetadata';
import { StructuredData, SchemaType } from '../../domain/entities/StructuredData';
import { SeoEntityType } from '../../domain/entities/SeoIssue';
import { ISeoMetadataRepository } from '../../domain/repositories/ISeoMetadataRepository';
import { IStructuredDataRepository } from '../../domain/repositories/IStructuredDataRepository';
import { MetaTagGenerator } from '../../domain/services/MetaTagGenerator';
import { SlugGenerator } from '../../domain/services/SlugGenerator';
import { StructuredDataGenerator } from '../../domain/services/StructuredDataGenerator';
import { SeoScoreCalculator } from '../../domain/services/SeoScoreCalculator';
import { IProductPort } from '../ports/IProductPort';
import { IEventBus } from '@shared/module-system/module.interface';
import { ProductNotFoundError } from '../../domain/errors/seo.errors';
import { loadBrandStrategySync } from '@shared/utils/brand-strategy';
import { v4 as uuidv4 } from 'uuid';

/**
 * Input parameters for use case
 */
export interface GenerateProductSeoInput {
  productId: string;
  locale?: 'ro' | 'en';
}

/**
 * Output/result of use case
 */
export interface GenerateProductSeoOutput {
  metadata: SeoMetadata;
  structuredData: StructuredData;
  score: number;
  focusKeyword: string;
}

/**
 * GenerateProductSeo - Use Case
 *
 * Orchestrates SEO metadata generation for a product.
 * Implements SRP: focuses only on generation workflow.
 */
export class GenerateProductSeo {
  private isEntityLocaleDuplicateError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    return (
      String(err?.code || '') === '23505' &&
      String(err?.message || '').includes('idx_seo_metadata_entity_locale')
    );
  }

  /**
   * Create a new GenerateProductSeo use case
   *
   * @param productPort - Product data accessor
   * @param metadataRepository - Metadata persistence
   * @param structuredDataRepository - Structured data persistence
   * @param metaTagGenerator - Meta tag generation service
   * @param slugGenerator - Slug generation service
   * @param structuredDataGenerator - Schema generation service
   * @param scoreCalculator - Score calculation service
   * @param eventBus - Event publishing
   * @param logger - Structured logger
   */
  constructor(
    private readonly productPort: IProductPort,
    private readonly metadataRepository: ISeoMetadataRepository,
    private readonly structuredDataRepository: IStructuredDataRepository,
    private readonly metaTagGenerator: MetaTagGenerator,
    private readonly slugGenerator: SlugGenerator,
    private readonly structuredDataGenerator: StructuredDataGenerator,
    private readonly scoreCalculator: SeoScoreCalculator,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger
  ) { }

  /**
   * Execute the use case
   *
   * @param input - Use case input parameters
   * @returns Generated SEO metadata and structured data
   * @throws {ProductNotFoundError} If product not found
   * @throws {Error} If generation fails
   */
  async execute(input: GenerateProductSeoInput): Promise<GenerateProductSeoOutput> {
    const locale = input.locale ?? 'ro';
    const startTime = Date.now();

    this.logger.info('Generating SEO metadata for product', {
      productId: input.productId,
      locale,
    });

    try {
      // Step 1: Fetch product
      const product = await this.productPort.getProduct(input.productId);
      if (!product) {
        throw new ProductNotFoundError(input.productId);
      }

      // Step 2: Generate meta tags
      const generatedTags = this.metaTagGenerator.generateForProduct({
        name: product.name,
        category: product.category,
        description: product.description,
        price: product.price,
        features: product.features,
        sku: product.sku,
      });

      const trimToLength = (value: string | undefined, max: number): string =>
        String(value || '').trim().slice(0, max);

      // Step 3: Generate slug
      const slug = trimToLength(this.slugGenerator.generate(product.name), 255);
      const metaTitle = trimToLength(generatedTags.title || product.name, 60);
      const metaDescription = trimToLength(generatedTags.description || productDescriptionFallback(product), 160);
      const focusKeyword = trimToLength(generatedTags.focusKeyword || product.name, 255);
      const brandStrategy = loadBrandStrategySync();
      const canonicalUrl = `${String(brandStrategy.website || 'https://ledux.ro').replace(/\/$/, '')}/produs/${slug}/`;
      const productDescription =
        product.description ||
        metaDescription ||
        `${brandStrategy.promise} ${brandStrategy.seo.metaDescriptionCta}`;
      const imageUrls = Array.isArray(product.images)
        ? product.images.map((value) => String(value || '').trim()).filter((value) => value.length > 0)
        : [];
      const primaryImage = imageUrls[0] || product.image;

      // Step 4: Generate structured data
      const structuredDataJson = this.structuredDataGenerator.generateProduct({
        id: product.id,
        name: product.name,
        description: productDescription,
        price: product.price || 0,
        currency: 'RON',
        imageUrl: primaryImage,
        imageUrls,
        brand: brandStrategy.brandName || 'Ledux',
        sku: product.sku,
        category: product.category,
      });

      // Step 5: Calculate score
      const score = this.scoreCalculator.calculate({
        metaTitle,
        metaDescription,
        slug,
        focusKeyword,
        canonicalUrl,
        ogTitle: metaTitle,
        ogDescription: metaDescription,
        structuredDataPresent: true,
      });

      const existingMetadata = await this.metadataRepository.findByEntity('PRODUCT', input.productId, locale);
      const existingStructuredData = await this.structuredDataRepository.findByEntity(
        SeoEntityType.PRODUCT,
        input.productId,
      );
      const existingProductSchema = existingStructuredData.find(
        (item) => item.schemaType === SchemaType.PRODUCT,
      );

      // Step 6: Create metadata entity
      const metadata = new SeoMetadata({
        id: existingMetadata?.id || uuidv4(),
        entityType: 'PRODUCT',
        entityId: input.productId,
        locale,
        metaTitle,
        metaDescription,
        slug,
        canonicalUrl,
        ogTitle: metaTitle,
        ogDescription: metaDescription,
        ogImage: primaryImage,
        focusKeyword,
        seoScore: score,
      });

      // Step 7: Validate metadata
      const validationErrors = metadata.validate();
      if (validationErrors.length > 0) {
        this.logger.warn('Metadata validation issues', {
          productId: input.productId,
          errors: validationErrors,
        });
      }

      // Step 8: Create structured data entity
      const structuredData = new StructuredData({
        id: existingProductSchema?.id || uuidv4(),
        entityType: SeoEntityType.PRODUCT,
        entityId: input.productId,
        schemaType: SchemaType.PRODUCT,
        jsonLd: structuredDataJson,
      });

      // Step 9: Validate structured data
      structuredData.validate();

      // Step 10: Save to database
      let savedMetadata: SeoMetadata;
      try {
        savedMetadata = await this.metadataRepository.save(metadata);
      } catch (error) {
        if (!this.isEntityLocaleDuplicateError(error)) {
          throw error;
        }

        const concurrentMetadata = await this.metadataRepository.findByEntity(
          'PRODUCT',
          input.productId,
          locale,
        );

        if (!concurrentMetadata) {
          throw error;
        }

        savedMetadata = await this.metadataRepository.save(
          new SeoMetadata({
            id: concurrentMetadata.id,
            entityType: 'PRODUCT',
            entityId: input.productId,
            locale,
            metaTitle,
            metaDescription,
            slug,
            canonicalUrl,
            ogTitle: metaTitle,
            ogDescription: metaDescription,
            ogImage: primaryImage,
            focusKeyword,
            seoScore: score,
          }),
        );
      }

      const savedStructuredData = await this.structuredDataRepository.save(structuredData);

      const executionTime = Date.now() - startTime;

      // Step 11: Publish event (best-effort)
      try {
        await this.eventBus.publish('seo.metadata_generated', {
          productId: input.productId,
          locale,
          score,
          focusKeyword,
          executionTimeMs: executionTime,
        });
      } catch (eventError) {
        this.logger.warn('Failed to publish seo.metadata_generated event', {
          productId: input.productId,
          locale,
          error: eventError instanceof Error ? eventError.message : String(eventError),
        });
      }

      this.logger.info('SEO metadata generated successfully', {
        productId: input.productId,
        locale,
        score,
        executionTimeMs: executionTime,
      });

      return {
        metadata: savedMetadata,
        structuredData: savedStructuredData,
        score,
        focusKeyword,
      };
    } catch (error) {
      this.logger.error('Failed to generate SEO metadata', {
        productId: input.productId,
        locale,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

function productDescriptionFallback(product: {
  description?: string;
  name?: string;
}): string {
  return product.description || `${product.name || 'Produs'} de calitate pentru aplicatii profesionale.`;
}
