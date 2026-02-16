/**
 * SeoAuditResult Entity
 *
 * Records results of SEO audits performed on products, categories, or pages.
 * Tracks scores, issues, warnings, recommendations, and execution time.
 *
 * ### Audit Types
 * - FULL: Complete SEO audit (all checks)
 * - PRODUCT: Product-specific audit
 * - CATEGORY: Category-specific audit
 * - TECHNICAL: Technical SEO checks only
 *
 * ### Score Interpretation
 * - 0-30: Poor - Critical issues preventing good rankings
 * - 31-60: Fair - Several issues that should be addressed
 * - 61-80: Good - Some improvements needed
 * - 81-100: Excellent - Well-optimized
 *
 * @example
 * const auditResult = new SeoAuditResult({
 *   id: 'audit-uuid',
 *   auditType: 'PRODUCT',
 *   entityType: 'PRODUCT',
 *   entityId: 'prod-123',
 *   score: 75,
 *   issues: [...],
 *   warnings: [...],
 *   passed: ['has_meta_title', 'has_meta_description'],
 *   recommendations: ['Add more internal links', 'Improve page speed'],
 *   executionTimeMs: 1250,
 * });
 */

import { SeoIssue, SeoEntityType } from './SeoIssue';

/**
 * Supported audit types
 */
export enum AuditType {
  FULL = 'FULL',
  PRODUCT = 'PRODUCT',
  CATEGORY = 'CATEGORY',
  TECHNICAL = 'TECHNICAL',
}

/**
 * Properties for creating SeoAuditResult
 */
export interface SeoAuditResultProps {
  id: string;
  auditType: AuditType;
  entityType?: SeoEntityType;
  entityId?: string;
  score: number;
  issues: SeoIssue[];
  warnings: SeoIssue[];
  passed: string[];
  recommendations: string[];
  executionTimeMs: number;
  createdAt?: Date;
}

/**
 * SeoAuditResult - Entity
 *
 * Records audit results including scores, issues, and recommendations.
 */
export class SeoAuditResult {
  /**
   * Unique identifier for this audit result
   */
  readonly id: string;

  /**
   * Type of audit performed
   */
  readonly auditType: AuditType;

  /**
   * Type of entity audited (optional)
   */
  readonly entityType?: SeoEntityType;

  /**
   * ID of entity audited (optional)
   */
  readonly entityId?: string;

  /**
   * Overall SEO score (0-100)
   */
  readonly score: number;

  /**
   * Critical issues found
   */
  readonly issues: SeoIssue[];

  /**
   * Non-critical warnings
   */
  readonly warnings: SeoIssue[];

  /**
   * List of checks that passed
   */
  readonly passed: string[];

  /**
   * Recommendations for improvement
   */
  readonly recommendations: string[];

  /**
   * Time in milliseconds to execute the audit
   */
  readonly executionTimeMs: number;

  /**
   * Timestamp when audit was performed
   */
  readonly createdAt: Date;

  /**
   * Create a new SeoAuditResult entity
   *
   * @param props - Properties for the audit result
   * @throws {Error} If required properties are missing
   */
  constructor(props: SeoAuditResultProps) {
    if (!props.id) throw new Error('SeoAuditResult id is required');
    if (!props.auditType) throw new Error('SeoAuditResult auditType is required');
    if (props.score < 0 || props.score > 100) throw new Error('Score must be between 0 and 100');
    if (!props.issues) throw new Error('SeoAuditResult issues is required');
    if (!props.warnings) throw new Error('SeoAuditResult warnings is required');
    if (!props.passed) throw new Error('SeoAuditResult passed is required');
    if (!props.recommendations) throw new Error('SeoAuditResult recommendations is required');
    if (props.executionTimeMs < 0) throw new Error('Execution time must be positive');

    this.id = props.id;
    this.auditType = props.auditType;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.score = props.score;
    this.issues = props.issues;
    this.warnings = props.warnings;
    this.passed = props.passed;
    this.recommendations = props.recommendations;
    this.executionTimeMs = props.executionTimeMs;
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Get high-priority issues (CRITICAL and WARNING severity)
   *
   * @returns Array of high-priority issues
   */
  getHighPriorityIssues(): SeoIssue[] {
    return this.issues.filter((issue) => issue.severity !== 'INFO');
  }

  /**
   * Get the audit score
   *
   * @returns Score from 0 to 100
   */
  getScore(): number {
    return this.score;
  }

  /**
   * Check if audit found critical issues
   *
   * @returns True if any critical issues exist
   */
  hasCriticalIssues(): boolean {
    return this.issues.some((issue) => issue.isCritical());
  }

  /**
   * Get human-readable score interpretation
   *
   * @returns Score description (e.g., 'Good', 'Fair', 'Poor')
   */
  getScoreGrade(): string {
    if (this.score >= 81) return 'Excellent';
    if (this.score >= 61) return 'Good';
    if (this.score >= 31) return 'Fair';
    return 'Poor';
  }

  /**
   * Get summary of audit results
   *
   * @returns Human-readable summary
   */
  getSummary(): string {
    const grade = this.getScoreGrade();
    const criticalCount = this.issues.filter((i) => i.isCritical()).length;
    const warningCount = this.warnings.length;
    const passedCount = this.passed.length;

    return (
      `SEO Audit Result: ${grade} (${this.score}/100)\n` +
      `Critical Issues: ${criticalCount}\n` +
      `Warnings: ${warningCount}\n` +
      `Passed Checks: ${passedCount}\n` +
      `Execution Time: ${this.executionTimeMs}ms`
    );
  }

  /**
   * Check if audit is good enough (score >= 70)
   *
   * @returns True if score is 70 or higher
   */
  isGoodScore(): boolean {
    return this.score >= 70;
  }

  /**
   * Check if audit is excellent (score >= 85)
   *
   * @returns True if score is 85 or higher
   */
  isExcellentScore(): boolean {
    return this.score >= 85;
  }

  /**
   * Get count of all issues and warnings
   *
   * @returns Total count
   */
  getTotalIssueCount(): number {
    return this.issues.length + this.warnings.length;
  }

  /**
   * Convert entity to plain object
   *
   * @returns Plain object representation
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      auditType: this.auditType,
      entityType: this.entityType,
      entityId: this.entityId,
      score: this.score,
      scoreGrade: this.getScoreGrade(),
      issues: this.issues.map((i) => i.toJSON()),
      warnings: this.warnings.map((w) => w.toJSON()),
      passed: this.passed,
      recommendations: this.recommendations,
      executionTimeMs: this.executionTimeMs,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
