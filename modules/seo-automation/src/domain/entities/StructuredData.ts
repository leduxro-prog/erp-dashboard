/**
 * StructuredData Entity
 *
 * Manages JSON-LD structured data (schema.org) for products, categories, and pages.
 * Validates against schema.org specifications and provides conversion to JSON-LD format.
 *
 * ### Supported Schema Types
 * - Product: e-commerce product with price, availability, reviews
 * - Organization: company/business entity
 * - BreadcrumbList: navigation breadcrumbs
 * - FAQPage: frequently asked questions
 * - WebPage: generic web page
 * - LocalBusiness: physical business location
 * - AggregateRating: combined rating and review count
 *
 * ### Validation
 * - Checks for required properties per schema type
 * - Validates property types and formats
 * - Tracks validation errors
 *
 * @example
 * const structuredData = new StructuredData({
 *   id: 'sd-uuid',
 *   entityType: 'PRODUCT',
 *   entityId: 'prod-123',
 *   schemaType: 'Product',
 *   jsonLd: {
 *     '@context': 'https://schema.org/',
 *     '@type': 'Product',
 *     name: 'Bec LED 10W',
 *     price: '25.99'
 *   }
 * });
 *
 * structuredData.validate();
 * const isValid = structuredData.isValid;
 */

import { SeoEntityType } from './SeoIssue';

/**
 * Supported schema.org schema types
 */
export enum SchemaType {
  PRODUCT = 'Product',
  ORGANIZATION = 'Organization',
  BREADCRUMB_LIST = 'BreadcrumbList',
  FAQ_PAGE = 'FAQPage',
  WEB_PAGE = 'WebPage',
  LOCAL_BUSINESS = 'LocalBusiness',
  AGGREGATE_RATING = 'AggregateRating',
}

/**
 * Properties for creating StructuredData
 */
export interface StructuredDataProps {
  id: string;
  entityType: SeoEntityType;
  entityId: string;
  schemaType: SchemaType;
  jsonLd: Record<string, unknown>;
  validationErrors?: string[];
  isValid?: boolean;
  lastValidatedAt?: Date;
  createdAt?: Date;
}

/**
 * StructuredData - Entity
 *
 * Manages JSON-LD structured data for search engine understanding.
 * Validates against schema.org specifications.
 */
export class StructuredData {
  /**
   * Unique identifier for this structured data
   */
  readonly id: string;

  /**
   * Type of entity (PRODUCT, CATEGORY, or PAGE)
   */
  readonly entityType: SeoEntityType;

  /**
   * ID of the entity this structured data describes
   */
  readonly entityId: string;

  /**
   * Schema type (e.g., 'Product', 'Organization')
   */
  schemaType: SchemaType;

  /**
   * JSON-LD object
   */
  jsonLd: Record<string, unknown>;

  /**
   * Validation errors found in the structured data
   */
  validationErrors: string[] = [];

  /**
   * Whether this structured data is valid
   */
  isValid: boolean = false;

  /**
   * Timestamp of last validation
   */
  lastValidatedAt?: Date;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Create a new StructuredData entity
   *
   * @param props - Properties for structured data
   * @throws {Error} If required properties are missing
   */
  constructor(props: StructuredDataProps) {
    if (!props.id) throw new Error('StructuredData id is required');
    if (!props.entityType) throw new Error('StructuredData entityType is required');
    if (!props.entityId) throw new Error('StructuredData entityId is required');
    if (!props.schemaType) throw new Error('StructuredData schemaType is required');
    if (!props.jsonLd) throw new Error('StructuredData jsonLd is required');

    this.id = props.id;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.schemaType = props.schemaType;
    this.jsonLd = props.jsonLd;
    this.validationErrors = props.validationErrors ?? [];
    this.isValid = props.isValid ?? false;
    this.lastValidatedAt = props.lastValidatedAt;
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Validate structured data against schema.org specifications
   *
   * @returns Array of validation errors (empty if valid)
   */
  validate(): string[] {
    this.validationErrors = [];

    // Check @context
    if (!this.jsonLd['@context']) {
      this.validationErrors.push('@context is required');
    } else if (this.jsonLd['@context'] !== 'https://schema.org/') {
      this.validationErrors.push('@context must be "https://schema.org/"');
    }

    // Check @type
    if (!this.jsonLd['@type']) {
      this.validationErrors.push('@type is required');
    } else if (this.jsonLd['@type'] !== this.schemaType) {
      this.validationErrors.push(`@type must match schemaType "${this.schemaType}"`);
    }

    // Validate by schema type
    switch (this.schemaType) {
      case SchemaType.PRODUCT:
        this.validateProduct();
        break;
      case SchemaType.ORGANIZATION:
        this.validateOrganization();
        break;
      case SchemaType.BREADCRUMB_LIST:
        this.validateBreadcrumbList();
        break;
      case SchemaType.FAQ_PAGE:
        this.validateFAQPage();
        break;
      case SchemaType.WEB_PAGE:
        this.validateWebPage();
        break;
      case SchemaType.LOCAL_BUSINESS:
        this.validateLocalBusiness();
        break;
      case SchemaType.AGGREGATE_RATING:
        this.validateAggregateRating();
        break;
    }

    this.isValid = this.validationErrors.length === 0;
    this.lastValidatedAt = new Date();

    return this.validationErrors;
  }

  /**
   * Validate Product schema
   *
   * @internal
   */
  private validateProduct(): void {
    const required = ['name'];
    for (const field of required) {
      if (!this.jsonLd[field]) {
        this.validationErrors.push(`Product requires "${field}" property`);
      }
    }

    // Optional but recommended
    if (!this.jsonLd['description']) {
      this.validationErrors.push('Product should include "description" property');
    }
  }

  /**
   * Validate Organization schema
   *
   * @internal
   */
  private validateOrganization(): void {
    const required = ['name', 'url'];
    for (const field of required) {
      if (!this.jsonLd[field]) {
        this.validationErrors.push(`Organization requires "${field}" property`);
      }
    }
  }

  /**
   * Validate BreadcrumbList schema
   *
   * @internal
   */
  private validateBreadcrumbList(): void {
    if (!this.jsonLd['itemListElement']) {
      this.validationErrors.push('BreadcrumbList requires "itemListElement" property');
    }
  }

  /**
   * Validate FAQPage schema
   *
   * @internal
   */
  private validateFAQPage(): void {
    if (!this.jsonLd['mainEntity']) {
      this.validationErrors.push('FAQPage requires "mainEntity" property');
    }
  }

  /**
   * Validate WebPage schema
   *
   * @internal
   */
  private validateWebPage(): void {
    // Basic validation
    if (!this.jsonLd['name']) {
      this.validationErrors.push('WebPage should include "name" property');
    }
  }

  /**
   * Validate LocalBusiness schema
   *
   * @internal
   */
  private validateLocalBusiness(): void {
    const required = ['name', 'address'];
    for (const field of required) {
      if (!this.jsonLd[field]) {
        this.validationErrors.push(`LocalBusiness requires "${field}" property`);
      }
    }
  }

  /**
   * Validate AggregateRating schema
   *
   * @internal
   */
  private validateAggregateRating(): void {
    const required = ['ratingValue', 'ratingCount'];
    for (const field of required) {
      if (!this.jsonLd[field]) {
        this.validationErrors.push(`AggregateRating requires "${field}" property`);
      }
    }
  }

  /**
   * Convert to JSON-LD format
   *
   * Returns a properly formatted JSON-LD string.
   *
   * @returns JSON-LD string
   */
  toJsonLd(): string {
    return JSON.stringify(this.jsonLd, null, 2);
  }

  /**
   * Get the schema type
   *
   * @returns Schema type string
   */
  getSchemaType(): string {
    return this.schemaType;
  }

  /**
   * Add a property to the JSON-LD object
   *
   * @param key - Property name
   * @param value - Property value
   */
  addProperty(key: string, value: unknown): void {
    this.jsonLd[key] = value;
  }

  /**
   * Remove a property from the JSON-LD object
   *
   * @param key - Property name to remove
   * @returns True if property was removed
   */
  removeProperty(key: string): boolean {
    if (key in this.jsonLd) {
      delete this.jsonLd[key];
      return true;
    }
    return false;
  }

  /**
   * Merge with another StructuredData object
   *
   * Combines properties from both objects, with other taking precedence.
   *
   * @param other - Other StructuredData to merge
   * @throws {Error} If schema types don't match
   */
  merge(other: StructuredData): void {
    if (this.schemaType !== other.schemaType) {
      throw new Error(`Cannot merge different schema types: ${this.schemaType} vs ${other.schemaType}`);
    }

    this.jsonLd = {
      ...this.jsonLd,
      ...other.jsonLd,
    };
  }

  /**
   * Convert entity to plain object
   *
   * @returns Plain object representation
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      schemaType: this.schemaType,
      jsonLd: this.jsonLd,
      validationErrors: this.validationErrors,
      isValid: this.isValid,
      lastValidatedAt: this.lastValidatedAt?.toISOString(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
