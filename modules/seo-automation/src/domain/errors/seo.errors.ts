/**
 * SEO Module Error Classes
 *
 * Specific error types for SEO operations.
 * All extend BaseError for consistent error handling.
 *
 * @module seo.errors
 */

import { BaseError } from '@shared/errors/BaseError';

/**
 * MetadataNotFoundError - HTTP 404
 *
 * Thrown when requested SEO metadata does not exist.
 *
 * @example
 * if (!metadata) {
 *   throw new MetadataNotFoundError('PRODUCT', 'prod-123', 'ro');
 * }
 */
export class MetadataNotFoundError extends BaseError {
  /**
   * Create a MetadataNotFoundError
   *
   * @param entityType - Type of entity (PRODUCT, CATEGORY, PAGE)
   * @param entityId - ID of the entity
   * @param locale - Locale code (ro, en)
   */
  constructor(entityType: string, entityId: string, locale: string) {
    super(
      `Metadata for ${entityType} ${entityId} (locale: ${locale}) not found`,
      'METADATA_NOT_FOUND',
      404
    );
  }
}

/**
 * InvalidSchemaError - HTTP 400
 *
 * Thrown when JSON-LD schema is invalid.
 * Includes validation error details.
 *
 * @example
 * if (!structuredData.isValid) {
 *   throw new InvalidSchemaError('Product', structuredData.validationErrors);
 * }
 */
export class InvalidSchemaError extends BaseError {
  /**
   * Validation errors found
   */
  readonly validationErrors: string[];

  /**
   * Create an InvalidSchemaError
   *
   * @param schemaType - Schema type that is invalid (e.g., 'Product')
   * @param errors - Array of validation error messages
   */
  constructor(schemaType: string, errors: string[]) {
    const errorList = errors.join(', ');
    super(
      `Invalid JSON-LD schema for ${schemaType}: ${errorList}`,
      'INVALID_SCHEMA',
      400
    );
    this.validationErrors = errors;
  }
}

/**
 * SitemapGenerationError - HTTP 500
 *
 * Thrown when sitemap generation fails.
 *
 * @example
 * try {
 *   const xml = sitemap.generateXml();
 * } catch (error) {
 *   throw new SitemapGenerationError('PRODUCTS', error as Error);
 * }
 */
export class SitemapGenerationError extends BaseError {
  /**
   * Underlying error
   */
  readonly cause?: Error;

  /**
   * Create a SitemapGenerationError
   *
   * @param sitemapType - Type of sitemap being generated
   * @param cause - Underlying error (optional)
   */
  constructor(sitemapType: string, cause?: Error) {
    const message = `Failed to generate ${sitemapType} sitemap${cause ? `: ${cause.message}` : ''}`;
    super(message, 'SITEMAP_GENERATION_ERROR', 500);
    this.cause = cause;
  }
}

/**
 * AuditError - HTTP 500
 *
 * Thrown when SEO audit fails.
 *
 * @example
 * try {
 *   await auditUseCase.execute(...);
 * } catch (error) {
 *   throw new AuditError('PRODUCT', entityId, error as Error);
 * }
 */
export class AuditError extends BaseError {
  /**
   * Underlying error
   */
  readonly cause?: Error;

  /**
   * Create an AuditError
   *
   * @param auditType - Type of audit that failed
   * @param entityId - ID of entity being audited
   * @param cause - Underlying error (optional)
   */
  constructor(auditType: string, entityId: string, cause?: Error) {
    const message = `Failed to audit ${auditType} ${entityId}${cause ? `: ${cause.message}` : ''}`;
    super(message, 'AUDIT_ERROR', 500);
    this.cause = cause;
  }
}

/**
 * DuplicateSlugError - HTTP 409
 *
 * Thrown when trying to create/update metadata with a slug that already exists.
 *
 * @example
 * if (existingMetadata) {
 *   throw new DuplicateSlugError('bec-led-10w', 'prod-456');
 * }
 */
export class DuplicateSlugError extends BaseError {
  /**
   * Create a DuplicateSlugError
   *
   * @param slug - The slug that is duplicated
   * @param existingEntityId - ID of entity that already has this slug
   */
  constructor(slug: string, existingEntityId: string) {
    super(
      `Slug "${slug}" is already used by entity ${existingEntityId}`,
      'DUPLICATE_SLUG',
      409
    );
  }
}

/**
 * InvalidMetaLengthError - HTTP 422
 *
 * Thrown when meta title or description exceeds length constraints.
 *
 * @example
 * if (title.length > 60) {
 *   throw new InvalidMetaLengthError('title', 60, title.length);
 * }
 */
export class InvalidMetaLengthError extends BaseError {
  /**
   * Create an InvalidMetaLengthError
   *
   * @param fieldName - Name of the field ('title' or 'description')
   * @param maxLength - Maximum allowed length
   * @param actualLength - Actual length provided
   */
  constructor(fieldName: string, maxLength: number, actualLength: number) {
    super(
      `Meta ${fieldName} exceeds maximum length of ${maxLength} characters (provided: ${actualLength})`,
      'INVALID_META_LENGTH',
      422
    );
  }
}

/**
 * SeoConfigError - HTTP 500
 *
 * Thrown when SEO module configuration is invalid.
 *
 * @example
 * if (!config.baseUrl) {
 *   throw new SeoConfigError('baseUrl is required');
 * }
 */
export class SeoConfigError extends BaseError {
  /**
   * Create a SeoConfigError
   *
   * @param message - Description of the configuration issue
   */
  constructor(message: string) {
    super(`SEO Configuration Error: ${message}`, 'SEO_CONFIG_ERROR', 500);
  }
}

/**
 * ProductNotFoundError - HTTP 404
 *
 * Thrown when a product cannot be retrieved from the product port.
 *
 * @example
 * const product = await productPort.getProduct(productId);
 * if (!product) {
 *   throw new ProductNotFoundError(productId);
 * }
 */
export class ProductNotFoundError extends BaseError {
  /**
   * Create a ProductNotFoundError
   *
   * @param productId - ID of the product not found
   */
  constructor(productId: string) {
    super(
      `Product with id ${productId} not found`,
      'PRODUCT_NOT_FOUND',
      404
    );
  }
}

/**
 * WooCommerceError - HTTP 503
 *
 * Thrown when WooCommerce integration fails.
 *
 * @example
 * try {
 *   await woocommercePort.updateProductMeta(...);
 * } catch (error) {
 *   throw new WooCommerceError('Update product meta', error as Error);
 * }
 */
export class WooCommerceError extends BaseError {
  /**
   * Underlying error
   */
  readonly cause?: Error;

  /**
   * Create a WooCommerceError
   *
   * @param operation - Name of the operation that failed
   * @param cause - Underlying error (optional)
   */
  constructor(operation: string, cause?: Error) {
    const message = `WooCommerce ${operation} failed${cause ? `: ${cause.message}` : ''}`;
    super(message, 'WOOCOMMERCE_ERROR', 503);
    this.cause = cause;
  }
}
