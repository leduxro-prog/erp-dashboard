/**
 * SeoMetadata Entity
 *
 * Core domain entity representing SEO metadata for a product, category, or page.
 * Encapsulates meta titles, descriptions, structured data, and OpenGraph tags.
 *
 * ### Constraints
 * - metaTitle: max 60 characters
 * - metaDescription: max 160 characters
 * - slug: must be URL-safe and unique per entity type
 * - seoScore: 0-100, calculated based on completeness
 * - locales supported: 'ro', 'en'
 *
 * ### Lifecycle
 * - Created when new product/category is added
 * - Updated when product details change
 * - Audited periodically to recalculate score and issues
 *
 * @example
 * const metadata = new SeoMetadata({
 *   id: 'meta-uuid',
 *   entityType: 'PRODUCT',
 *   entityId: 'prod-123',
 *   locale: 'ro',
 *   metaTitle: 'Bec LED 10W - Ledux.ro',
 *   metaDescription: 'Bec LED de calitate superioara cu garanție de 2 ani',
 *   slug: 'bec-led-10w',
 *   focusKeyword: 'bec LED',
 * });
 *
 * metadata.validate();
 * const score = metadata.calculateScore();
 */

import { SeoIssue, SeoIssueType, SeoIssueSeverity, SeoEntityType } from './SeoIssue';

/**
 * Supported locale codes
 */
export type SeoLocale = 'ro' | 'en';

/**
 * Entity type that can have SEO metadata
 */
export type MetadataEntityType = 'PRODUCT' | 'CATEGORY' | 'PAGE';

/**
 * Properties for creating or updating SeoMetadata
 */
export interface SeoMetadataProps {
  id: string;
  entityType: MetadataEntityType;
  entityId: string;
  locale: SeoLocale;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  seoScore?: number;
  issues?: SeoIssue[];
  lastAuditedAt?: Date;
  lastPublishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * SeoMetadata - Entity
 *
 * Manages SEO metadata for products, categories, and pages.
 * Validates constraints and calculates SEO score.
 */
export class SeoMetadata {
  /**
   * Unique identifier for this metadata record
   */
  readonly id: string;

  /**
   * Type of entity (PRODUCT, CATEGORY, or PAGE)
   */
  readonly entityType: MetadataEntityType;

  /**
   * ID of the entity this metadata describes
   */
  readonly entityId: string;

  /**
   * Language locale (ro or en)
   */
  readonly locale: SeoLocale;

  /**
   * Meta title tag (max 60 chars)
   */
  metaTitle: string;

  /**
   * Meta description tag (max 160 chars)
   */
  metaDescription: string;

  /**
   * URL-safe slug for the entity
   */
  slug: string;

  /**
   * Canonical URL to avoid duplicate content issues
   */
  canonicalUrl?: string;

  /**
   * OpenGraph title for social sharing
   */
  ogTitle?: string;

  /**
   * OpenGraph description for social sharing
   */
  ogDescription?: string;

  /**
   * OpenGraph image URL for social sharing
   */
  ogImage?: string;

  /**
   * Twitter Card title
   */
  twitterTitle?: string;

  /**
   * Twitter Card description
   */
  twitterDescription?: string;

  /**
   * Primary keyword to target
   */
  focusKeyword?: string;

  /**
   * Secondary keywords to target
   */
  secondaryKeywords: string[];

  /**
   * SEO score (0-100)
   */
  seoScore: number = 0;

  /**
   * List of issues found in this metadata
   */
  issues: SeoIssue[] = [];

  /**
   * Timestamp of last SEO audit
   */
  lastAuditedAt?: Date;

  /**
   * Timestamp of last publish to WooCommerce
   */
  lastPublishedAt?: Date;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last update timestamp
   */
  updatedAt: Date;

  /**
   * Create a new SeoMetadata entity
   *
   * @param props - Properties for the metadata
   * @throws {Error} If required properties are missing
   */
  constructor(props: SeoMetadataProps) {
    if (!props.id) throw new Error('SeoMetadata id is required');
    if (!props.entityType) throw new Error('SeoMetadata entityType is required');
    if (!props.entityId) throw new Error('SeoMetadata entityId is required');
    if (!props.locale) throw new Error('SeoMetadata locale is required');
    if (!props.metaTitle) throw new Error('SeoMetadata metaTitle is required');
    if (!props.metaDescription) throw new Error('SeoMetadata metaDescription is required');
    if (!props.slug) throw new Error('SeoMetadata slug is required');

    this.id = props.id;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.locale = props.locale;
    this.metaTitle = props.metaTitle;
    this.metaDescription = props.metaDescription;
    this.slug = props.slug;
    this.canonicalUrl = props.canonicalUrl;
    this.ogTitle = props.ogTitle;
    this.ogDescription = props.ogDescription;
    this.ogImage = props.ogImage;
    this.twitterTitle = props.twitterTitle;
    this.twitterDescription = props.twitterDescription;
    this.focusKeyword = props.focusKeyword;
    this.secondaryKeywords = props.secondaryKeywords ?? [];
    this.seoScore = props.seoScore ?? 0;
    this.issues = props.issues ?? [];
    this.lastAuditedAt = props.lastAuditedAt;
    this.lastPublishedAt = props.lastPublishedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Validate SEO metadata constraints
   *
   * @throws {Error} If validation fails
   * @returns Array of validation errors (empty if valid)
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.metaTitle || this.metaTitle.trim().length === 0) {
      errors.push('Meta title is required');
    }

    if (!this.metaDescription || this.metaDescription.trim().length === 0) {
      errors.push('Meta description is required');
    }

    if (this.metaTitle.length > 60) {
      errors.push(`Meta title exceeds 60 characters (${this.metaTitle.length} chars)`);
    }

    if (this.metaDescription.length > 160) {
      errors.push(`Meta description exceeds 160 characters (${this.metaDescription.length} chars)`);
    }

    if (!this.slug || this.slug.trim().length === 0) {
      errors.push('Slug is required');
    }

    if (!/^[a-z0-9\-]+$/.test(this.slug)) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (this.locale !== 'ro' && this.locale !== 'en') {
      errors.push('Locale must be "ro" or "en"');
    }

    return errors;
  }

  /**
   * Calculate SEO score based on metadata completeness and quality
   *
   * Scoring breakdown:
   * - Meta title present: +15
   * - Meta description present: +15
   * - Correct lengths: +10 each
   * - Focus keyword in title: +10
   * - Focus keyword in description: +5
   * - Slug contains keyword: +5
   * - Structured data present: +10
   * - No duplicate title: +10
   * - Canonical URL set: +5
   * - OG tags set: +5
   *
   * @returns SEO score from 0 to 100
   */
  calculateScore(): number {
    let score = 0;

    // Meta title (15 points)
    if (this.metaTitle && this.metaTitle.trim().length > 0) {
      score += 15;
    }

    // Meta description (15 points)
    if (this.metaDescription && this.metaDescription.trim().length > 0) {
      score += 15;
    }

    // Title length (10 points)
    if (this.metaTitle && this.metaTitle.length >= 30 && this.metaTitle.length <= 60) {
      score += 10;
    }

    // Description length (10 points)
    if (
      this.metaDescription &&
      this.metaDescription.length >= 120 &&
      this.metaDescription.length <= 160
    ) {
      score += 10;
    }

    // Focus keyword in title (10 points)
    if (this.focusKeyword && this.metaTitle.toLowerCase().includes(this.focusKeyword.toLowerCase())) {
      score += 10;
    }

    // Focus keyword in description (5 points)
    if (
      this.focusKeyword &&
      this.metaDescription.toLowerCase().includes(this.focusKeyword.toLowerCase())
    ) {
      score += 5;
    }

    // Slug contains keyword (5 points)
    if (this.focusKeyword && this.slug.toLowerCase().includes(this.focusKeyword.toLowerCase())) {
      score += 5;
    }

    // Canonical URL (5 points)
    if (this.canonicalUrl) {
      score += 5;
    }

    // OG tags (5 points)
    if (this.ogTitle && this.ogDescription && this.ogImage) {
      score += 5;
    }

    this.seoScore = Math.min(score, 100);
    return this.seoScore;
  }

  /**
   * Get all issues with this metadata
   *
   * @returns Array of SeoIssue objects
   */
  getIssues(): SeoIssue[] {
    return this.issues;
  }

  /**
   * Generate a URL-safe slug from a title
   *
   * Removes diacritics, special characters, and converts to lowercase.
   *
   * @param title - Title to convert to slug
   * @returns URL-safe slug
   */
  static generateSlug(title: string): string {
    // Remove diacritics (Romanian)
    let slug = title
      .replace(/ă/g, 'a')
      .replace(/â/g, 'a')
      .replace(/î/g, 'i')
      .replace(/ț/g, 't')
      .replace(/ș/g, 's')
      .replace(/Ă/g, 'a')
      .replace(/Â/g, 'a')
      .replace(/Î/g, 'i')
      .replace(/Ț/g, 't')
      .replace(/Ș/g, 's');

    // Convert to lowercase
    slug = slug.toLowerCase();

    // Replace spaces and underscores with hyphens
    slug = slug.replace(/[\s_]+/g, '-');

    // Remove special characters
    slug = slug.replace(/[^a-z0-9\-]/g, '');

    // Remove consecutive hyphens
    slug = slug.replace(/\-+/g, '-');

    // Remove leading/trailing hyphens
    slug = slug.replace(/^\-+|\-+$/g, '');

    return slug;
  }

  /**
   * Truncate meta title to maximum length
   *
   * @param title - Title to truncate
   * @param max - Maximum length (default: 60)
   * @returns Truncated title
   */
  static truncateTitle(title: string, max: number = 60): string {
    if (title.length <= max) {
      return title;
    }
    return title.substring(0, max - 3) + '...';
  }

  /**
   * Truncate meta description to maximum length
   *
   * @param description - Description to truncate
   * @param max - Maximum length (default: 160)
   * @returns Truncated description
   */
  static truncateDescription(description: string, max: number = 160): string {
    if (description.length <= max) {
      return description;
    }
    return description.substring(0, max - 3) + '...';
  }

  /**
   * Check if metadata has been published to WooCommerce
   *
   * @returns True if lastPublishedAt is set
   */
  isPublished(): boolean {
    return this.lastPublishedAt !== undefined && this.lastPublishedAt !== null;
  }

  /**
   * Check if metadata needs update
   *
   * Considers age of last audit and changes to entity.
   *
   * @returns True if metadata is older than 30 days or score is below 70
   */
  needsUpdate(): boolean {
    if (!this.lastAuditedAt) {
      return true;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.lastAuditedAt < thirtyDaysAgo || this.seoScore < 70;
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
      locale: this.locale,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      slug: this.slug,
      canonicalUrl: this.canonicalUrl,
      ogTitle: this.ogTitle,
      ogDescription: this.ogDescription,
      ogImage: this.ogImage,
      twitterTitle: this.twitterTitle,
      twitterDescription: this.twitterDescription,
      focusKeyword: this.focusKeyword,
      secondaryKeywords: this.secondaryKeywords,
      seoScore: this.seoScore,
      issues: this.issues.map((i) => i.toJSON()),
      lastAuditedAt: this.lastAuditedAt?.toISOString(),
      lastPublishedAt: this.lastPublishedAt?.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
