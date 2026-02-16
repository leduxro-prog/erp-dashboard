/**
 * SeoIssue Value Object
 *
 * Represents a single SEO issue found during audit or validation.
 * Immutable value object with type-safe severity and issue types.
 *
 * ### Issue Types
 * - MISSING_META_TITLE: Product missing meta title tag
 * - MISSING_META_DESC: Product missing meta description
 * - TITLE_TOO_LONG: Meta title exceeds 60 characters
 * - DESC_TOO_LONG: Meta description exceeds 160 characters
 * - MISSING_ALT_TEXT: Images missing alt text
 * - DUPLICATE_TITLE: Same meta title used for multiple products
 * - MISSING_H1: Page missing H1 tag
 * - MULTIPLE_H1: Page has more than one H1 tag
 * - MISSING_CANONICAL: Page missing canonical URL
 * - BROKEN_LINK: Link returns 4xx or 5xx
 * - SLOW_PAGE: Page load time > 3 seconds
 * - MISSING_STRUCTURED_DATA: JSON-LD schema missing
 * - KEYWORD_STUFFING: Excessive keyword repetition
 * - THIN_CONTENT: Content below 300 words (products) or 500 words (pages)
 * - MISSING_SITEMAP_ENTRY: Entity not in sitemap
 *
 * ### Severity Levels
 * - CRITICAL: Must fix immediately, affects rankings
 * - WARNING: Should fix soon, may impact rankings
 * - INFO: Nice to have, minor impact
 *
 * @example
 * const issue = new SeoIssue({
 *   type: 'MISSING_META_TITLE',
 *   severity: 'CRITICAL',
 *   message: 'Product is missing meta title',
 *   entityType: 'PRODUCT',
 *   entityId: '12345',
 *   recommendation: 'Add meta title up to 60 characters',
 *   autoFixable: true
 * });
 */

/**
 * Enumeration of all possible SEO issue types
 */
export enum SeoIssueType {
  MISSING_META_TITLE = 'MISSING_META_TITLE',
  MISSING_META_DESC = 'MISSING_META_DESC',
  TITLE_TOO_LONG = 'TITLE_TOO_LONG',
  DESC_TOO_LONG = 'DESC_TOO_LONG',
  MISSING_ALT_TEXT = 'MISSING_ALT_TEXT',
  DUPLICATE_TITLE = 'DUPLICATE_TITLE',
  MISSING_H1 = 'MISSING_H1',
  MULTIPLE_H1 = 'MULTIPLE_H1',
  MISSING_CANONICAL = 'MISSING_CANONICAL',
  BROKEN_LINK = 'BROKEN_LINK',
  SLOW_PAGE = 'SLOW_PAGE',
  MISSING_STRUCTURED_DATA = 'MISSING_STRUCTURED_DATA',
  KEYWORD_STUFFING = 'KEYWORD_STUFFING',
  THIN_CONTENT = 'THIN_CONTENT',
  MISSING_SITEMAP_ENTRY = 'MISSING_SITEMAP_ENTRY',
}

/**
 * Enumeration of issue severity levels
 */
export enum SeoIssueSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

/**
 * Enumeration of entity types that can have SEO issues
 */
export enum SeoEntityType {
  PRODUCT = 'PRODUCT',
  CATEGORY = 'CATEGORY',
  PAGE = 'PAGE',
}

/**
 * Properties required to create a SeoIssue
 */
export interface SeoIssueProps {
  type: SeoIssueType;
  severity: SeoIssueSeverity;
  message: string;
  entityType?: SeoEntityType;
  entityId?: string;
  recommendation?: string;
  autoFixable?: boolean;
}

/**
 * SeoIssue - Value Object
 *
 * Immutable representation of a single SEO issue.
 * No identity, equality based on all properties.
 */
export class SeoIssue {
  /**
   * The type of SEO issue
   */
  readonly type: SeoIssueType;

  /**
   * Severity level of the issue
   */
  readonly severity: SeoIssueSeverity;

  /**
   * Human-readable description of the issue
   */
  readonly message: string;

  /**
   * Type of entity that has the issue (optional)
   */
  readonly entityType?: SeoEntityType;

  /**
   * ID of the entity that has the issue (optional)
   */
  readonly entityId?: string;

  /**
   * Recommended action to fix the issue (optional)
   */
  readonly recommendation?: string;

  /**
   * Whether this issue can be auto-fixed (optional)
   */
  readonly autoFixable?: boolean;

  /**
   * Create a new SeoIssue value object
   *
   * @param props - Properties for the issue
   * @throws {Error} If required properties are missing
   */
  constructor(props: SeoIssueProps) {
    if (!props.type) {
      throw new Error('SeoIssue type is required');
    }
    if (!props.severity) {
      throw new Error('SeoIssue severity is required');
    }
    if (!props.message) {
      throw new Error('SeoIssue message is required');
    }

    this.type = props.type;
    this.severity = props.severity;
    this.message = props.message;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.recommendation = props.recommendation;
    this.autoFixable = props.autoFixable ?? false;
  }

  /**
   * Check if this issue is critical
   *
   * @returns True if severity is CRITICAL
   */
  isCritical(): boolean {
    return this.severity === SeoIssueSeverity.CRITICAL;
  }

  /**
   * Check if this issue is a warning
   *
   * @returns True if severity is WARNING
   */
  isWarning(): boolean {
    return this.severity === SeoIssueSeverity.WARNING;
  }

  /**
   * Check if this issue is informational
   *
   * @returns True if severity is INFO
   */
  isInfo(): boolean {
    return this.severity === SeoIssueSeverity.INFO;
  }

  /**
   * Compare equality with another SeoIssue
   * Value objects are equal if all properties match
   *
   * @param other - Other SeoIssue to compare
   * @returns True if all properties are equal
   */
  equals(other: SeoIssue): boolean {
    return (
      this.type === other.type &&
      this.severity === other.severity &&
      this.message === other.message &&
      this.entityType === other.entityType &&
      this.entityId === other.entityId &&
      this.recommendation === other.recommendation &&
      this.autoFixable === other.autoFixable
    );
  }

  /**
   * Convert to plain object representation
   *
   * @returns Plain object with all properties
   */
  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      severity: this.severity,
      message: this.message,
      entityType: this.entityType,
      entityId: this.entityId,
      recommendation: this.recommendation,
      autoFixable: this.autoFixable,
    };
  }
}
