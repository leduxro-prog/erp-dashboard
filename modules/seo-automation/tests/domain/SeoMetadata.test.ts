/**
 * SeoMetadata Entity Tests
 *
 * Unit tests for SeoMetadata domain entity.
 * Tests validation, score calculation, and utility methods.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SeoMetadata } from '../../src/domain/entities/SeoMetadata';

describe('SeoMetadata Entity', () => {
  let metadata: SeoMetadata;

  beforeEach(() => {
    metadata = new SeoMetadata({
      id: 'meta-test-1',
      entityType: 'PRODUCT',
      entityId: 'prod-123',
      locale: 'ro',
      metaTitle: 'Bec LED 10W - Becuri LED | Ledux.ro',
      metaDescription: 'Cumpara bec LED 10W cu pret redus. Livrare rapida in toata Romania.',
      slug: 'bec-led-10w',
      focusKeyword: 'bec LED',
      secondaryKeywords: ['becuri', 'LED'],
    });
  });

  describe('Constructor', () => {
    it('should create valid metadata', () => {
      expect(metadata.id).toBe('meta-test-1');
      expect(metadata.entityType).toBe('PRODUCT');
      expect(metadata.entityId).toBe('prod-123');
      expect(metadata.locale).toBe('ro');
      expect(metadata.metaTitle).toBe('Bec LED 10W - Becuri LED | Ledux.ro');
    });

    it('should throw error when required fields are missing', () => {
      expect(() => {
        new SeoMetadata({
          id: '',
          entityType: 'PRODUCT',
          entityId: 'prod-123',
          locale: 'ro',
          metaTitle: 'Title',
          metaDescription: 'Description',
          slug: 'slug',
        });
      }).toThrow('SeoMetadata id is required');
    });

    it('should set timestamps', () => {
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
      expect(metadata.createdAt).toBeInstanceOf(Date);
    });

    it('should initialize secondary keywords as empty array if not provided', () => {
      const meta = new SeoMetadata({
        id: 'test',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        locale: 'ro',
        metaTitle: 'Title',
        metaDescription: 'Description',
        slug: 'slug',
      });

      expect(meta.secondaryKeywords).toEqual([]);
    });
  });

  describe('Validation', () => {
    it('should validate valid metadata', () => {
      const errors = metadata.validate();
      expect(errors).toEqual([]);
    });

    it('should report missing meta title', () => {
      metadata.metaTitle = '';
      const errors = metadata.validate();
      expect(errors).toContain('Meta title is required');
    });

    it('should report meta title exceeding max length', () => {
      metadata.metaTitle = 'a'.repeat(61);
      const errors = metadata.validate();
      expect(errors.some((e) => e.includes('exceeds 60 characters'))).toBeTruthy();
    });

    it('should report meta description exceeding max length', () => {
      metadata.metaDescription = 'a'.repeat(161);
      const errors = metadata.validate();
      expect(errors.some((e) => e.includes('exceeds 160 characters'))).toBeTruthy();
    });

    it('should report invalid slug format', () => {
      metadata.slug = 'Invalid Slug!';
      const errors = metadata.validate();
      expect(errors.some((e) => e.includes('lowercase letters, numbers, and hyphens'))).toBeTruthy();
    });

    it('should report invalid locale', () => {
      const invalidLocaleMetadata = new SeoMetadata({
        id: 'meta-invalid-locale',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        locale: 'fr' as any,
        metaTitle: 'Title',
        metaDescription: 'Description',
        slug: 'slug',
      });

      const errors = invalidLocaleMetadata.validate();
      expect(errors).toContain('Locale must be "ro" or "en"');
    });
  });

  describe('Score Calculation', () => {
    it('should calculate maximum score for complete metadata', () => {
      metadata.focusKeyword = 'bec LED';
      metadata.canonicalUrl = 'https://ledux.ro/products/bec-led-10w';
      metadata.ogTitle = 'Bec LED 10W';
      metadata.ogDescription = 'High quality LED bulb';
      metadata.ogImage = 'https://ledux.ro/images/bec-led-10w.jpg';

      const score = metadata.calculateScore();
      expect(score).toBeGreaterThanOrEqual(60);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give points for meta title presence', () => {
      const metaWithoutTitle = new SeoMetadata({
        id: 'test',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        locale: 'ro',
        metaTitle: '   ',
        metaDescription: metadata.metaDescription,
        slug: metadata.slug,
      });

      const scoreWithTitle = metadata.calculateScore();
      const scoreWithoutTitle = metaWithoutTitle.calculateScore();

      expect(scoreWithTitle).toBeGreaterThan(scoreWithoutTitle);
    });

    it('should give points for focus keyword in title', () => {
      const metaWithKeyword = new SeoMetadata({
        id: 'test1',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        locale: 'ro',
        metaTitle: 'Bec LED 10W - Best Option',
        metaDescription: 'Description',
        slug: 'slug',
        focusKeyword: 'Bec LED',
      });

      const metaWithoutKeyword = new SeoMetadata({
        id: 'test2',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        locale: 'ro',
        metaTitle: 'Best Lighting Product 10W',
        metaDescription: 'Description',
        slug: 'slug',
        focusKeyword: 'Bec LED',
      });

      const scoreWith = metaWithKeyword.calculateScore();
      const scoreWithout = metaWithoutKeyword.calculateScore();

      expect(scoreWith).toBeGreaterThan(scoreWithout);
    });
  });

  describe('Slug Generation', () => {
    it('should generate slug from title', () => {
      const slug = SeoMetadata.generateSlug('Bec LED 10W');
      expect(slug).toBe('bec-led-10w');
    });

    it('should handle Romanian diacritics', () => {
      const slug = SeoMetadata.generateSlug('Ștrangulator Țapă');
      expect(slug).toBe('strangulator-tapa');
    });

    it('should convert to lowercase', () => {
      const slug = SeoMetadata.generateSlug('Bec LED 10W Warm White');
      expect(slug).toBe('bec-led-10w-warm-white');
    });

    it('should remove special characters', () => {
      const slug = SeoMetadata.generateSlug('Bec LED (10W) - Best!');
      expect(slug).toBe('bec-led-10w-best');
    });
  });

  describe('Title/Description Truncation', () => {
    it('should truncate title to max length', () => {
      const longTitle = 'This is a very long title that exceeds the maximum allowed length';
      const truncated = SeoMetadata.truncateTitle(longTitle, 60);

      expect(truncated.length).toBeLessThanOrEqual(60);
      expect(truncated.endsWith('...')).toBeTruthy();
    });

    it('should not truncate short title', () => {
      const shortTitle = 'Short Title';
      const truncated = SeoMetadata.truncateTitle(shortTitle, 60);

      expect(truncated).toBe(shortTitle);
    });

    it('should truncate description to max length', () => {
      const longDesc = 'a'.repeat(180);
      const truncated = SeoMetadata.truncateDescription(longDesc, 160);

      expect(truncated.length).toBeLessThanOrEqual(160);
      expect(truncated.endsWith('...')).toBeTruthy();
    });
  });

  describe('Publication Status', () => {
    it('should report not published when lastPublishedAt is null', () => {
      metadata.lastPublishedAt = undefined;
      expect(metadata.isPublished()).toBeFalsy();
    });

    it('should report published when lastPublishedAt is set', () => {
      metadata.lastPublishedAt = new Date();
      expect(metadata.isPublished()).toBeTruthy();
    });
  });

  describe('Update Check', () => {
    it('should indicate needs update when no audit', () => {
      metadata.lastAuditedAt = undefined;
      expect(metadata.needsUpdate()).toBeTruthy();
    });

    it('should indicate needs update when audit is old', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
      metadata.lastAuditedAt = thirtyDaysAgo;

      expect(metadata.needsUpdate()).toBeTruthy();
    });

    it('should indicate needs update when score is low', () => {
      metadata.lastAuditedAt = new Date();
      metadata.seoScore = 65;

      expect(metadata.needsUpdate()).toBeTruthy();
    });

    it('should not indicate needs update when recent and good score', () => {
      metadata.lastAuditedAt = new Date();
      metadata.seoScore = 75;

      expect(metadata.needsUpdate()).toBeFalsy();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to JSON', () => {
      const json = metadata.toJSON();

      expect(json.id).toBe(metadata.id);
      expect(json.entityType).toBe(metadata.entityType);
      expect(json.metaTitle).toBe(metadata.metaTitle);
      expect(typeof json.createdAt).toBe('string');
    });

    it('should serialize secondary keywords', () => {
      metadata.secondaryKeywords = ['keyword1', 'keyword2'];
      const json = metadata.toJSON();

      expect(json.secondaryKeywords).toEqual(['keyword1', 'keyword2']);
    });
  });
});
