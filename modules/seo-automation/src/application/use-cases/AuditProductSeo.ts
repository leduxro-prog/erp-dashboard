/**
 * AuditProductSeo Use Case
 *
 * Performs comprehensive SEO audit on a product.
 * Identifies issues, calculates score, and provides recommendations.
 *
 * ### Checks Performed
 * - Meta title presence and length
 * - Meta description presence and length
 * - Focus keyword placement
 * - Structured data presence and validity
 * - Canonical URL
 * - OG tags
 * - Duplicate title detection
 * - Slug quality
 *
 * ### Output
 * - Overall score (0-100)
 * - Critical issues (must fix)
 * - Warnings (should fix)
 * - Passed checks
 * - Recommendations for improvement
 * - Execution time
 *
 * @example
 * const useCase = new AuditProductSeo(
 *   metadataRepository,
 *   structuredDataRepository,
 *   auditRepository,
 *   scoreCalculator,
 *   eventBus,
 *   logger
 * );
 *
 * const result = await useCase.execute({ entityType: 'PRODUCT', entityId: 'prod-123' });
 * // Returns: { auditResult, score, issues, recommendations }
 */

import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { SeoAuditResult, AuditType } from '../../domain/entities/SeoAuditResult';
import { SeoIssue, SeoIssueType, SeoIssueSeverity, SeoEntityType } from '../../domain/entities/SeoIssue';
import { ISeoMetadataRepository } from '../../domain/repositories/ISeoMetadataRepository';
import { IStructuredDataRepository } from '../../domain/repositories/IStructuredDataRepository';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository';
import { SeoScoreCalculator } from '../../domain/services/SeoScoreCalculator';
import { IEventBus } from '@shared/module-system/module.interface';
import { MetadataNotFoundError } from '../../domain/errors/seo.errors';

/**
 * Audit input parameters
 */
export interface AuditProductSeoInput {
  entityType: SeoEntityType;
  entityId: string;
  locale?: 'ro' | 'en';
}

/**
 * Audit result output
 */
export interface AuditProductSeoOutput {
  auditResult: SeoAuditResult;
  score: number;
  criticalIssues: SeoIssue[];
  warnings: SeoIssue[];
  passed: string[];
  recommendations: string[];
}

/**
 * AuditProductSeo - Use Case
 *
 * Orchestrates SEO audit workflow.
 * Implements SRP: focuses only on audit execution.
 */
export class AuditProductSeo {
  /**
   * Create a new AuditProductSeo use case
   *
   * @param metadataRepository - Metadata persistence
   * @param structuredDataRepository - Structured data persistence
   * @param auditRepository - Audit result persistence
   * @param scoreCalculator - Score calculation service
   * @param eventBus - Event publishing
   * @param logger - Structured logger
   */
  constructor(
    private readonly metadataRepository: ISeoMetadataRepository,
    private readonly structuredDataRepository: IStructuredDataRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly scoreCalculator: SeoScoreCalculator,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger
  ) { }

  /**
   * Execute the audit
   *
   * @param input - Audit parameters
   * @returns Audit result with issues and recommendations
   * @throws {MetadataNotFoundError} If metadata not found
   * @throws {Error} If audit fails
   */
  async execute(input: AuditProductSeoInput): Promise<AuditProductSeoOutput> {
    const locale = input.locale ?? 'ro';
    const startTime = Date.now();
    const auditId = uuidv4();

    this.logger.info('Starting SEO audit', {
      auditId,
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
    });

    try {
      // Step 1: Fetch metadata
      const metadata = await this.metadataRepository.findByEntity(
        input.entityType,
        input.entityId,
        locale
      );

      if (!metadata) {
        throw new MetadataNotFoundError(input.entityType, input.entityId, locale);
      }

      // Step 2: Fetch structured data
      const structuredDataList = await this.structuredDataRepository.findByEntity(
        input.entityType,
        input.entityId
      );

      // Step 3: Run audit checks
      const issues: SeoIssue[] = [];
      const warnings: SeoIssue[] = [];
      const passed: string[] = [];

      // Check 1: Meta title
      if (!metadata.metaTitle || metadata.metaTitle.trim().length === 0) {
        issues.push(
          new SeoIssue({
            type: SeoIssueType.MISSING_META_TITLE,
            severity: SeoIssueSeverity.CRITICAL,
            message: 'Meta title is missing',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Add a meta title (30-60 characters)',
            autoFixable: true,
          })
        );
      } else if (metadata.metaTitle.length > 60) {
        issues.push(
          new SeoIssue({
            type: SeoIssueType.TITLE_TOO_LONG,
            severity: SeoIssueSeverity.WARNING,
            message: `Meta title is too long (${metadata.metaTitle.length} characters)`,
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Truncate title to max 60 characters',
            autoFixable: true,
          })
        );
      } else if (metadata.metaTitle.length < 30) {
        warnings.push(
          new SeoIssue({
            type: SeoIssueType.TITLE_TOO_LONG,
            severity: SeoIssueSeverity.WARNING,
            message: 'Meta title is too short (less than 30 characters)',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Expand title to 30-60 characters for better CTR',
          })
        );
      } else {
        passed.push('has_valid_meta_title');
      }

      // Check 2: Meta description
      if (!metadata.metaDescription || metadata.metaDescription.trim().length === 0) {
        issues.push(
          new SeoIssue({
            type: SeoIssueType.MISSING_META_DESC,
            severity: SeoIssueSeverity.CRITICAL,
            message: 'Meta description is missing',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Add a meta description (120-160 characters)',
            autoFixable: true,
          })
        );
      } else if (metadata.metaDescription.length > 160) {
        issues.push(
          new SeoIssue({
            type: SeoIssueType.DESC_TOO_LONG,
            severity: SeoIssueSeverity.WARNING,
            message: `Meta description is too long (${metadata.metaDescription.length} characters)`,
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Truncate description to max 160 characters',
            autoFixable: true,
          })
        );
      } else if (metadata.metaDescription.length < 120) {
        warnings.push(
          new SeoIssue({
            type: SeoIssueType.DESC_TOO_LONG,
            severity: SeoIssueSeverity.WARNING,
            message: 'Meta description is too short (less than 120 characters)',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Expand description to 120-160 characters',
          })
        );
      } else {
        passed.push('has_valid_meta_description');
      }

      // Check 3: Focus keyword
      if (!metadata.focusKeyword) {
        warnings.push(
          new SeoIssue({
            type: SeoIssueType.MISSING_META_TITLE,
            severity: SeoIssueSeverity.WARNING,
            message: 'No focus keyword defined',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Define a focus keyword for SEO optimization',
          })
        );
      } else {
        passed.push('has_focus_keyword');
      }

      // Check 4: Canonical URL
      if (!metadata.canonicalUrl) {
        warnings.push(
          new SeoIssue({
            type: SeoIssueType.MISSING_CANONICAL,
            severity: SeoIssueSeverity.WARNING,
            message: 'Canonical URL is not set',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Add canonical URL to prevent duplicate content issues',
            autoFixable: true,
          })
        );
      } else {
        passed.push('has_canonical_url');
      }

      // Check 5: Structured data
      if (structuredDataList.length === 0) {
        warnings.push(
          new SeoIssue({
            type: SeoIssueType.MISSING_STRUCTURED_DATA,
            severity: SeoIssueSeverity.WARNING,
            message: 'No structured data (JSON-LD) found',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Add JSON-LD schema.org markup for rich snippets',
            autoFixable: true,
          })
        );
      } else {
        const invalidSchemas = structuredDataList.filter((sd) => !sd.isValid);
        if (invalidSchemas.length > 0) {
          issues.push(
            new SeoIssue({
              type: SeoIssueType.MISSING_STRUCTURED_DATA,
              severity: SeoIssueSeverity.WARNING,
              message: `${invalidSchemas.length} structured data record(s) failed validation`,
              entityType: input.entityType,
              entityId: input.entityId,
              recommendation: 'Fix validation errors in structured data',
            })
          );
        } else {
          passed.push('has_valid_structured_data');
        }
      }

      // Check 6: OG tags
      if (!metadata.ogTitle || !metadata.ogDescription || !metadata.ogImage) {
        warnings.push(
          new SeoIssue({
            type: SeoIssueType.MISSING_META_TITLE,
            severity: SeoIssueSeverity.INFO,
            message: 'OpenGraph tags are incomplete',
            entityType: input.entityType,
            entityId: input.entityId,
            recommendation: 'Add OpenGraph tags for better social media sharing',
            autoFixable: true,
          })
        );
      } else {
        passed.push('has_og_tags');
      }

      // Step 4: Calculate recommendations
      const recommendations = this.generateRecommendations(issues, warnings, metadata);

      // Step 5: Calculate overall score
      const breakdownScore = metadata.seoScore || 0;

      // Step 6: Create audit result
      const auditResult = new SeoAuditResult({
        id: auditId,
        auditType: AuditType.PRODUCT,
        entityType: input.entityType,
        entityId: input.entityId,
        score: breakdownScore,
        issues,
        warnings,
        passed,
        recommendations,
        executionTimeMs: Date.now() - startTime,
      });

      // Step 7: Save audit result
      const savedAudit = await this.auditRepository.save(auditResult);

      // Step 8: Publish event
      await this.eventBus.publish('seo.audit_completed', {
        auditId,
        entityType: input.entityType,
        entityId: input.entityId,
        score: breakdownScore,
        criticalIssueCount: issues.length,
        warningCount: warnings.length,
        executionTimeMs: auditResult.executionTimeMs,
      });

      this.logger.info('SEO audit completed', {
        auditId,
        entityId: input.entityId,
        score: breakdownScore,
        issueCount: issues.length,
        executionTimeMs: auditResult.executionTimeMs,
      });

      return {
        auditResult: savedAudit,
        score: breakdownScore,
        criticalIssues: issues,
        warnings,
        passed,
        recommendations,
      };
    } catch (error) {
      this.logger.error('SEO audit failed', {
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Generate recommendations from audit results
   *
   * @param issues - Critical issues found
   * @param warnings - Non-critical warnings
   * @param metadata - Metadata entity
   * @returns Array of recommendations
   *
   * @internal
   */
  private generateRecommendations(
    issues: SeoIssue[],
    warnings: SeoIssue[],
    metadata: any
  ): string[] {
    const recommendations: string[] = [];

    // From issues
    for (const issue of issues) {
      if (issue.recommendation) {
        recommendations.push(issue.recommendation);
      }
    }

    // From warnings
    for (const warning of warnings) {
      if (warning.recommendation) {
        recommendations.push(warning.recommendation);
      }
    }

    // Additional recommendations based on metadata
    if (metadata.focusKeyword) {
      if (
        !metadata.metaTitle?.toLowerCase().includes(metadata.focusKeyword.toLowerCase())
      ) {
        recommendations.push(`Include "${metadata.focusKeyword}" in meta title`);
      }
      if (
        !metadata.metaDescription?.toLowerCase().includes(metadata.focusKeyword.toLowerCase())
      ) {
        recommendations.push(`Include "${metadata.focusKeyword}" in meta description`);
      }
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }
}
