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

      // Step 3: Generate slug
      const slug = this.slugGenerator.generate(product.name);

      // Step 4: Generate structured data
      const structuredDataJson = this.structuredDataGenerator.generateProduct({
        id: product.id,
        name: product.name,
        description: product.description || 'High-quality LED lighting product',
        price: product.price || 0,
        currency: 'RON',
        imageUrl: product.image,
        brand: 'Ledux',
        sku: product.sku,
        category: product.category,
      });

      // Step 5: Calculate score
      const score = this.scoreCalculator.calculate({
        metaTitle: generatedTags.title,
        metaDescription: generatedTags.description,
        slug,
        focusKeyword: generatedTags.focusKeyword,
        canonicalUrl: `https://ledux.ro/products/${slug}`,
        ogTitle: generatedTags.title,
        ogDescription: generatedTags.description,
        structuredDataPresent: true,
      });

      // Step 6: Create metadata entity
      const metadata = new SeoMetadata({
        id: `meta-${input.productId}-${locale}`,
        entityType: 'PRODUCT',
        entityId: input.productId,
        locale,
        metaTitle: generatedTags.title,
        metaDescription: generatedTags.description,
        slug,
        canonicalUrl: `https://ledux.ro/products/${slug}`,
        ogTitle: generatedTags.title,
        ogDescription: generatedTags.description,
        ogImage: product.image,
        focusKeyword: generatedTags.focusKeyword,
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
        id: `sd-${input.productId}-${locale}`,
        entityType: SeoEntityType.PRODUCT,
        entityId: input.productId,
        schemaType: SchemaType.PRODUCT,
        jsonLd: structuredDataJson,
      });

      // Step 9: Validate structured data
      structuredData.validate();

      // Step 10: Save to database
      const savedMetadata = await this.metadataRepository.save(metadata);
      const savedStructuredData = await this.structuredDataRepository.save(structuredData);

      const executionTime = Date.now() - startTime;

      // Step 11: Publish event
      await this.eventBus.publish('seo.metadata_generated', {
        productId: input.productId,
        locale,
        score,
        focusKeyword: generatedTags.focusKeyword,
        executionTimeMs: executionTime,
      });

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
        focusKeyword: generatedTags.focusKeyword,
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
