/**
 * SeoScoreCalculator Service Tests
 *
 * Unit tests for SEO score calculation service.
 * Tests score calculation, grading, and recommendations.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SeoScoreCalculator } from '../../src/domain/services/SeoScoreCalculator';

describe('SeoScoreCalculator Service', () => {
  let calculator: SeoScoreCalculator;

  beforeEach(() => {
    calculator = new SeoScoreCalculator();
  });

  describe('Score Calculation', () => {
    it('should calculate zero for empty metadata', () => {
      const score = calculator.calculate({});
      expect(score).toBe(0);
    });

    it('should give points for meta title', () => {
      const score = calculator.calculate({
        metaTitle: 'Bec LED 10W - Becuri LED | Ledux.ro',
      });

      expect(score).toBeGreaterThan(0);
    });

    it('should give points for meta description', () => {
      const score = calculator.calculate({
        metaDescription: 'Cumpara bec LED de calitate cu pret redus. Livrare rapida.',
      });

      expect(score).toBeGreaterThan(0);
    });

    it('should calculate maximum score for complete metadata', () => {
      const score = calculator.calculate({
        metaTitle: 'Bec LED 10W - Becuri LED | Ledux.ro',
        metaDescription: 'Cumpara bec LED 10W de calitate cu garantie. Livrare rapida in Romania.',
        slug: 'bec-led-10w',
        focusKeyword: 'bec LED',
        canonicalUrl: 'https://ledux.ro/products/bec-led-10w',
        ogTitle: 'Bec LED 10W',
        ogDescription: 'High quality LED bulb',
        ogImage: 'https://ledux.ro/images/bec.jpg',
        structuredDataPresent: true,
      });

      expect(score).toBeGreaterThanOrEqual(90);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should cap score at 100', () => {
      const score = calculator.calculate({
        metaTitle: 'Title Title Title Title Title Title Title Title Title Title',
        metaDescription: 'Desc Desc Desc Desc Desc Desc Desc Desc Desc Desc Desc Desc',
        slug: 'slug-slug-slug',
        focusKeyword: 'slug',
        canonicalUrl: 'https://example.com',
        ogTitle: 'Title',
        ogDescription: 'Description',
        ogImage: 'https://example.com/image.jpg',
        structuredDataPresent: true,
        hasDuplicateTitle: false,
        hasMultipleH1: false,
      });

      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Score Breakdown', () => {
    it('should provide detailed breakdown', () => {
      const breakdown = calculator.getBreakdown({
        metaTitle: 'Bec LED 10W - Becuri LED | Ledux.ro',
        metaDescription: 'Cumpara bec LED 10W cu pret redus. Livrare rapida in toata Romania.',
        slug: 'bec-led-10w',
        focusKeyword: 'bec LED',
      });

      expect(breakdown.metaTitlePresent).toBe(15);
      expect(breakdown.metaDescriptionPresent).toBe(15);
      expect(breakdown.titleLength).toBe(10);
      expect(breakdown.descriptionLength).toBe(10);
      expect(breakdown.focusKeywordInTitle).toBe(10);
      expect(breakdown.focusKeywordInDescription).toBe(5);
      expect(breakdown.total).toBeGreaterThan(0);
    });

    it('should show zero for missing components', () => {
      const breakdown = calculator.getBreakdown({});

      expect(breakdown.metaTitlePresent).toBe(0);
      expect(breakdown.metaDescriptionPresent).toBe(0);
      expect(breakdown.titleLength).toBe(0);
      expect(breakdown.total).toBe(0);
    });

    it('should penalize incorrect lengths', () => {
      const breakdownShortTitle = calculator.getBreakdown({
        metaTitle: 'Short',
      });

      const breakdownLongTitle = calculator.getBreakdown({
        metaTitle: 'This is a very long title that exceeds the maximum allowed length',
      });

      expect(breakdownShortTitle.titleLength).toBe(0);
      expect(breakdownLongTitle.titleLength).toBe(0);
    });
  });

  describe('Grading', () => {
    it('should grade excellent for 85+', () => {
      expect(calculator.getGrade(100)).toBe('Excellent');
      expect(calculator.getGrade(85)).toBe('Excellent');
    });

    it('should grade good for 61-80', () => {
      expect(calculator.getGrade(80)).toBe('Good');
      expect(calculator.getGrade(70)).toBe('Good');
      expect(calculator.getGrade(61)).toBe('Good');
    });

    it('should grade fair for 31-60', () => {
      expect(calculator.getGrade(60)).toBe('Fair');
      expect(calculator.getGrade(45)).toBe('Fair');
      expect(calculator.getGrade(31)).toBe('Fair');
    });

    it('should grade poor for 0-30', () => {
      expect(calculator.getGrade(0)).toBe('Poor');
      expect(calculator.getGrade(15)).toBe('Poor');
      expect(calculator.getGrade(30)).toBe('Poor');
    });
  });

  describe('Pass/Fail Check', () => {
    it('should pass scores 70+', () => {
      expect(calculator.isPassing(100)).toBeTruthy();
      expect(calculator.isPassing(70)).toBeTruthy();
      expect(calculator.isPassing(71)).toBeTruthy();
    });

    it('should fail scores below 70', () => {
      expect(calculator.isPassing(69)).toBeFalsy();
      expect(calculator.isPassing(50)).toBeFalsy();
      expect(calculator.isPassing(0)).toBeFalsy();
    });
  });

  describe('Recommendations', () => {
    it('should recommend adding meta title', () => {
      const recommendations = calculator.getRecommendations({
        metaTitle: '',
      }, 0);

      expect(recommendations.some((r) => r.includes('meta title'))).toBeTruthy();
    });

    it('should recommend fixing title length', () => {
      const tooShort = calculator.getRecommendations({
        metaTitle: 'Short',
      }, 20);

      expect(tooShort.some((r) => r.includes('too short'))).toBeTruthy();

      const tooLong = calculator.getRecommendations({
        metaTitle: 'a'.repeat(70),
      }, 20);

      expect(tooLong.some((r) => r.includes('too long'))).toBeTruthy();
    });

    it('should recommend including focus keyword', () => {
      const recommendations = calculator.getRecommendations({
        metaTitle: 'Some Title',
        metaDescription: 'Some Description',
        slug: 'some-slug',
        focusKeyword: 'bec LED',
      }, 50);

      expect(recommendations.some((r) => r.includes('focus keyword'))).toBeTruthy();
    });

    it('should recommend OpenGraph tags', () => {
      const recommendations = calculator.getRecommendations({
        metaTitle: 'Title',
        metaDescription: 'Desc',
        slug: 'slug',
      }, 50);

      expect(recommendations.some((r) => r.includes('OpenGraph'))).toBeTruthy();
    });

    it('should not duplicate recommendations', () => {
      const recommendations = calculator.getRecommendations({}, 0);

      const uniqueRecommendations = new Set(recommendations);
      expect(uniqueRecommendations.size).toBe(recommendations.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values', () => {
      const score = calculator.calculate({
        metaTitle: undefined,
        metaDescription: null as any,
      });

      expect(score).toBe(0);
    });

    it('should handle whitespace-only values', () => {
      const score = calculator.calculate({
        metaTitle: '   ',
        metaDescription: '\n\t',
      });

      expect(score).toBe(0);
    });

    it('should handle keyword case-insensitive', () => {
      const score1 = calculator.calculate({
        metaTitle: 'Bec LED 10W',
        focusKeyword: 'bec led',
      });

      const score2 = calculator.calculate({
        metaTitle: 'BEC LED 10W',
        focusKeyword: 'Bec LED',
      });

      expect(score1).toBe(score2);
    });
  });
});
