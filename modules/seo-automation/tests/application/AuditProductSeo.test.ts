/**
 * AuditProductSeo Use Case Tests
 * Tests SEO auditing with issue detection
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuditProductSeo, AuditProductSeoInput } from '../../src/application/use-cases/AuditProductSeo';
import { SeoEntityType } from '../../src/domain/entities/SeoIssue';
import { MetadataNotFoundError } from '../../src/domain/errors/seo.errors';

describe('AuditProductSeo Use Case', () => {
  let useCase: AuditProductSeo;
  let mockMetadataRepository: any;
  let mockStructuredDataRepository: any;
  let mockAuditRepository: any;
  let mockScoreCalculator: any;
  let mockEventBus: any;
  let mockLogger: any;

  beforeEach(() => {
    mockMetadataRepository = { findByEntity: jest.fn() };
    mockStructuredDataRepository = { findByEntity: jest.fn() };
    mockAuditRepository = { save: jest.fn() };
    mockScoreCalculator = jest.fn();
    mockEventBus = { publish: jest.fn() };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    useCase = new AuditProductSeo(
      mockMetadataRepository,
      mockStructuredDataRepository,
      mockAuditRepository,
      mockScoreCalculator,
      mockEventBus,
      mockLogger
    );
  });

  describe('Happy Path - Audit Execution', () => {
    it('should audit product with valid metadata', async () => {
      const metadata = {
        metaTitle: 'LED Light 50W High Efficiency Bulb | Ledux',
        metaDescription:
          'High quality LED light with 50W power, extended durability, low consumption, and stable brightness for residential and commercial lighting projects.',
        focusKeyword: 'LED light',
        canonicalUrl: 'https://ledux.ro/products/led-light-50w',
        ogTitle: 'LED Light 50W',
        ogDescription: 'LED light description',
        ogImage: 'https://example.com/image.jpg',
        seoScore: 85,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-001',
        locale: 'ro',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([
        { isValid: true, validate: () => {} },
      ]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-001',
        score: 85,
        issues: [],
        warnings: [],
        passed: [
          'has_valid_meta_title',
          'has_valid_meta_description',
          'has_focus_keyword',
          'has_canonical_url',
          'has_valid_structured_data',
          'has_og_tags',
        ],
      });

      const result = await useCase.execute(input);

      expect(result.score).toBe(85);
      expect(result.criticalIssues).toHaveLength(0);
      expect(result.passed).toContain('has_valid_meta_title');
      expect(mockEventBus.publish).toHaveBeenCalledWith('seo.audit_completed', expect.any(Object));
    });

    it('should detect missing meta title', async () => {
      const metadata = {
        metaTitle: '',
        metaDescription: 'Valid description',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 40,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-002',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-002',
        score: 40,
        issues: [{ type: 'MISSING_META_TITLE', severity: 'CRITICAL' }],
        warnings: [],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should detect missing meta description', async () => {
      const metadata = {
        metaTitle: 'Valid Title',
        metaDescription: '',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 45,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-003',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-003',
        score: 45,
        issues: [{ type: 'MISSING_META_DESC', severity: 'CRITICAL' }],
        warnings: [],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should detect meta title too long', async () => {
      const metadata = {
        metaTitle: 'This is a very long meta title that exceeds 60 characters limit',
        metaDescription: 'Valid description',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 60,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-004',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-004',
        score: 60,
        issues: [{ type: 'TITLE_TOO_LONG', severity: 'WARNING' }],
        warnings: [],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should detect meta title too short', async () => {
      const metadata = {
        metaTitle: 'Short',
        metaDescription: 'Valid description that is long enough',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 55,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-005',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-005',
        score: 55,
        issues: [],
        warnings: [{ type: 'TITLE_TOO_SHORT', severity: 'WARNING' }],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect meta description too short', async () => {
      const metadata = {
        metaTitle: 'Valid Title',
        metaDescription: 'Short desc',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 50,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-006',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-006',
        score: 50,
        issues: [],
        warnings: [{ type: 'DESC_TOO_SHORT', severity: 'WARNING' }],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect meta description too long', async () => {
      const metadata = {
        metaTitle: 'Title',
        metaDescription: 'a'.repeat(170),
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 55,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-007',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-007',
        score: 55,
        issues: [{ type: 'DESC_TOO_LONG', severity: 'WARNING' }],
        warnings: [],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should detect missing focus keyword', async () => {
      const metadata = {
        metaTitle: 'Valid Title',
        metaDescription: 'Valid description that is long enough for the requirements',
        focusKeyword: null,
        canonicalUrl: 'https://example.com',
        seoScore: 65,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-008',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-008',
        score: 65,
        issues: [],
        warnings: [{ type: 'MISSING_FOCUS_KEYWORD', severity: 'WARNING' }],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect missing canonical URL', async () => {
      const metadata = {
        metaTitle: 'Valid Title',
        metaDescription: 'Valid description',
        focusKeyword: 'keyword',
        canonicalUrl: null,
        seoScore: 70,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-009',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-009',
        score: 70,
        issues: [],
        warnings: [{ type: 'MISSING_CANONICAL', severity: 'WARNING' }],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect missing structured data', async () => {
      const metadata = {
        metaTitle: 'Valid Title',
        metaDescription: 'Valid description',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 60,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-010',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-010',
        score: 60,
        issues: [],
        warnings: [{ type: 'MISSING_STRUCTURED_DATA', severity: 'WARNING' }],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect incomplete OpenGraph tags', async () => {
      const metadata = {
        metaTitle: 'Valid Title',
        metaDescription: 'Valid description',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        ogTitle: 'Title',
        ogDescription: null,
        ogImage: null,
        seoScore: 70,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-011',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-011',
        score: 70,
        issues: [],
        warnings: [{ type: 'INCOMPLETE_OG_TAGS', severity: 'INFO' }],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Error Cases', () => {
    it('should throw MetadataNotFoundError when metadata missing', async () => {
      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-missing',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(MetadataNotFoundError);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for focus keyword in title', async () => {
      const metadata = {
        metaTitle: 'Product Title',
        metaDescription: 'Valid description with keyword included',
        focusKeyword: 'LED light',
        canonicalUrl: 'https://example.com',
        ogTitle: 'Title',
        ogDescription: 'Desc',
        ogImage: 'img',
        seoScore: 75,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-012',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-012',
        score: 75,
        issues: [],
        warnings: [],
        passed: [],
        recommendations: ['Include "LED light" in meta title'],
      });

      const result = await useCase.execute(input);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Event Publishing', () => {
    it('should publish seo.audit_completed event', async () => {
      const metadata = {
        metaTitle: 'Title',
        metaDescription: 'Description',
        focusKeyword: 'keyword',
        canonicalUrl: 'https://example.com',
        seoScore: 80,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-013',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-013',
        score: 80,
        issues: [],
        warnings: [],
        passed: [],
        executionTimeMs: 100,
      });

      await useCase.execute(input);

      expect(mockEventBus.publish).toHaveBeenCalledWith('seo.audit_completed', expect.any(Object));
    });
  });

  describe('Locale Support', () => {
    it('should support Romanian locale', async () => {
      const metadata = {
        metaTitle: 'Titlu',
        metaDescription: 'Descriere',
        focusKeyword: 'cuvânt',
        seoScore: 75,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-ro',
        locale: 'ro',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-ro',
        score: 75,
      });

      const result = await useCase.execute(input);

      expect(result.score).toBeDefined();
      expect(mockMetadataRepository.findByEntity).toHaveBeenCalledWith(
        SeoEntityType.PRODUCT,
        'prod-ro',
        'ro'
      );
    });

    it('should support English locale', async () => {
      const metadata = {
        metaTitle: 'Title',
        metaDescription: 'Description',
        focusKeyword: 'keyword',
        seoScore: 80,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-en',
        locale: 'en',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-en',
        score: 80,
      });

      const result = await useCase.execute(input);

      expect(result.score).toBeDefined();
      expect(mockMetadataRepository.findByEntity).toHaveBeenCalledWith(
        SeoEntityType.PRODUCT,
        'prod-en',
        'en'
      );
    });

    it('should default to Romanian locale', async () => {
      const metadata = {
        metaTitle: 'Title',
        metaDescription: 'Desc',
        focusKeyword: 'key',
        seoScore: 70,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-default',
        // No locale specified
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-default',
        score: 70,
      });

      const result = await useCase.execute(input);

      expect(mockMetadataRepository.findByEntity).toHaveBeenCalledWith(
        SeoEntityType.PRODUCT,
        'prod-default',
        'ro'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle metadata with zero score', async () => {
      const metadata = {
        metaTitle: '',
        metaDescription: '',
        focusKeyword: null,
        canonicalUrl: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        seoScore: 0,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-zero',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-zero',
        score: 0,
        issues: [],
        warnings: [],
        passed: [],
      });

      const result = await useCase.execute(input);

      expect(result.score).toBe(0);
    });

    it('should handle perfect metadata with score 100', async () => {
      const metadata = {
        metaTitle: 'Perfect SEO Title | Ledux',
        metaDescription:
          'Perfect description with all required information and optimal keyword placement for SEO.',
        focusKeyword: 'SEO',
        canonicalUrl: 'https://example.com/page',
        ogTitle: 'Perfect SEO Title',
        ogDescription: 'Perfect description',
        ogImage: 'https://example.com/image.jpg',
        seoScore: 100,
        validate: () => [],
      };

      const input: AuditProductSeoInput = {
        entityType: SeoEntityType.PRODUCT,
        entityId: 'prod-perfect',
      };

      mockMetadataRepository.findByEntity.mockResolvedValue(metadata);
      mockStructuredDataRepository.findByEntity.mockResolvedValue([
        { isValid: true, validate: () => {} },
      ]);
      mockAuditRepository.save.mockResolvedValue({
        id: 'audit-perfect',
        score: 100,
        issues: [],
        warnings: [],
        passed: [
          'has_valid_meta_title',
          'has_valid_meta_description',
          'has_focus_keyword',
          'has_canonical_url',
          'has_valid_structured_data',
          'has_og_tags',
        ],
      });

      const result = await useCase.execute(input);

      expect(result.score).toBe(100);
      expect(result.criticalIssues).toHaveLength(0);
    });
  });
});
