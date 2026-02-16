/**
 * SeoScoreCalculator Service
 *
 * Calculates SEO score for metadata based on completeness and quality.
 * Pure function service with no dependencies.
 *
 * ### Scoring Breakdown (out of 100)
 * - Meta title present: +15
 * - Meta description present: +15
 * - Title correct length (30-60): +10
 * - Description correct length (120-160): +10
 * - Focus keyword in title: +10
 * - Focus keyword in description: +5
 * - Slug contains keyword: +5
 * - Canonical URL set: +5
 * - OG tags complete (title, desc, image): +5
 * - No duplicate title: +10 (checked separately)
 * - No multiple H1 tags: +10 (checked separately)
 *
 * @example
 * const calculator = new SeoScoreCalculator();
 * const score = calculator.calculate({
 *   metaTitle: 'Bec LED 10W - Ledux.ro',
 *   metaDescription: 'Bec LED eficient cu garanție de 2 ani',
 *   slug: 'bec-led-10w',
 *   focusKeyword: 'bec LED',
 * });
 */

/**
 * Input for score calculation
 */
export interface ScoreCalculationInput {
  metaTitle?: string;
  metaDescription?: string;
  slug?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  hasDuplicateTitle?: boolean;
  hasMultipleH1?: boolean;
  structuredDataPresent?: boolean;
}

/**
 * Score breakdown details
 */
export interface ScoreBreakdown {
  total: number;
  metaTitlePresent: number;
  metaDescriptionPresent: number;
  titleLength: number;
  descriptionLength: number;
  focusKeywordInTitle: number;
  focusKeywordInDescription: number;
  slugContainsKeyword: number;
  canonicalUrl: number;
  ogTags: number;
  structuredData: number;
  noDuplicateTitle: number;
  noMultipleH1: number;
}

/**
 * SeoScoreCalculator - Domain Service
 *
 * Calculates SEO scores for metadata.
 */
export class SeoScoreCalculator {
  /**
   * Calculate SEO score from metadata properties
   *
   * Returns a score from 0 to 100 based on SEO completeness.
   *
   * @param input - Metadata to score
   * @returns SEO score (0-100)
   */
  calculate(input: ScoreCalculationInput): number {
    const breakdown = this.getBreakdown(input);
    return breakdown.total;
  }

  /**
   * Get detailed score breakdown
   *
   * Shows how many points each component contributed.
   *
   * @param input - Metadata to score
   * @returns Score breakdown with all components
   */
  getBreakdown(input: ScoreCalculationInput): ScoreBreakdown {
    let total = 0;

    const metaTitle = input.metaTitle?.trim() ?? '';
    const metaDescription = input.metaDescription?.trim() ?? '';
    const focusKeyword = input.focusKeyword?.trim() ?? '';
    const slug = input.slug?.trim() ?? '';
    const canonical = input.canonicalUrl?.trim() ?? '';
    const ogTitle = input.ogTitle?.trim() ?? '';
    const ogDescription = input.ogDescription?.trim() ?? '';
    const ogImage = input.ogImage?.trim() ?? '';

    const hasAnySeoSignal = Boolean(
      metaTitle ||
        metaDescription ||
        focusKeyword ||
        slug ||
        canonical ||
        ogTitle ||
        ogDescription ||
        ogImage ||
        input.structuredDataPresent ||
        input.hasDuplicateTitle !== undefined ||
        input.hasMultipleH1 !== undefined
    );

    const normalizedKeyword = focusKeyword.toLowerCase();
    const normalizedSlug = slug.toLowerCase();
    const keywordInSlug = normalizedKeyword.replace(/\s+/g, '-');

    // Meta title (15 points)
    const metaTitlePresent = metaTitle.length > 0 ? 15 : 0;
    total += metaTitlePresent;

    // Meta description (15 points)
    const metaDescriptionPresent = metaDescription.length > 0 ? 15 : 0;
    total += metaDescriptionPresent;

    // Title length (10 points) - optimal 30-60 chars
    const titleLength = metaTitle.length >= 30 && metaTitle.length <= 60 ? 10 : 0;
    total += titleLength;

    // Description length (10 points) - practical e-commerce range
    const descriptionLength =
      metaDescription.length >= 50 &&
      metaDescription.length <= 160
        ? 10
        : 0;
    total += descriptionLength;

    // Focus keyword in title (10 points)
    const focusKeywordInTitle =
      normalizedKeyword.length > 0 &&
      metaTitle.toLowerCase().includes(normalizedKeyword)
        ? 10
        : 0;
    total += focusKeywordInTitle;

    // Focus keyword in description (5 points)
    const focusKeywordInDescription =
      normalizedKeyword.length > 0 &&
      metaDescription.toLowerCase().includes(normalizedKeyword)
        ? 5
        : 0;
    total += focusKeywordInDescription;

    // Slug contains keyword (5 points)
    const slugContainsKeyword =
      normalizedKeyword.length > 0 &&
      (normalizedSlug.includes(normalizedKeyword) ||
        (keywordInSlug.length > 0 && normalizedSlug.includes(keywordInSlug)))
        ? 5
        : 0;
    total += slugContainsKeyword;

    // Canonical URL (5 points)
    const canonicalUrl = canonical.length > 0 ? 5 : 0;
    total += canonicalUrl;

    // OG tags (5 points) - all three required
    const ogTags = ogTitle && ogDescription && ogImage ? 5 : 0;
    total += ogTags;

    // Structured data (10 points)
    const structuredData = input.structuredDataPresent ? 10 : 0;
    total += structuredData;

    // No duplicate title (10 points)
    const noDuplicateTitle = input.hasDuplicateTitle
      ? 0
      : (hasAnySeoSignal ? 10 : 0);
    total += noDuplicateTitle;

    // No multiple H1 (10 points)
    const noMultipleH1 = input.hasMultipleH1
      ? 0
      : (hasAnySeoSignal ? 10 : 0);
    total += noMultipleH1;

    return {
      total: Math.min(total, 100),
      metaTitlePresent,
      metaDescriptionPresent,
      titleLength,
      descriptionLength,
      focusKeywordInTitle,
      focusKeywordInDescription,
      slugContainsKeyword,
      canonicalUrl,
      ogTags,
      structuredData,
      noDuplicateTitle,
      noMultipleH1,
    };
  }

  /**
   * Get human-readable score grade
   *
   * @param score - Score from 0 to 100
   * @returns Grade string
   */
  getGrade(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    if (score >= 81) return 'Excellent';
    if (score >= 61) return 'Good';
    if (score >= 31) return 'Fair';
    return 'Poor';
  }

  /**
   * Check if score is passing (70+)
   *
   * @param score - Score from 0 to 100
   * @returns True if score >= 70
   */
  isPassing(score: number): boolean {
    return score >= 70;
  }

  /**
   * Get recommendations for improving score
   *
   * @param input - Metadata to analyze
   * @param currentScore - Current SEO score
   * @returns Array of actionable recommendations
   */
  getRecommendations(input: ScoreCalculationInput, currentScore: number): string[] {
    const recommendations: string[] = [];

    if (!input.metaTitle || input.metaTitle.trim().length === 0) {
      recommendations.push('Add a meta title (recommended: 30-60 characters)');
    } else if (input.metaTitle.length < 30) {
      recommendations.push('Meta title is too short (recommended: 30-60 characters)');
    } else if (input.metaTitle.length > 60) {
      recommendations.push('Meta title is too long (max: 60 characters)');
    }

    if (!input.metaDescription || input.metaDescription.trim().length === 0) {
      recommendations.push('Add a meta description (recommended: 120-160 characters)');
    } else if (input.metaDescription.length < 120) {
      recommendations.push('Meta description is too short (recommended: 120-160 characters)');
    } else if (input.metaDescription.length > 160) {
      recommendations.push('Meta description is too long (max: 160 characters)');
    }

    if (input.focusKeyword) {
      if (!input.metaTitle?.toLowerCase().includes(input.focusKeyword.toLowerCase())) {
        recommendations.push(
          `Include focus keyword "${input.focusKeyword}" in meta title`
        );
      }

      if (!input.metaDescription?.toLowerCase().includes(input.focusKeyword.toLowerCase())) {
        recommendations.push(
          `Include focus keyword "${input.focusKeyword}" in meta description`
        );
      }

      if (!input.slug?.toLowerCase().includes(input.focusKeyword.toLowerCase())) {
        recommendations.push(
          `Include focus keyword "${input.focusKeyword}" in URL slug`
        );
      }
    }

    if (!input.canonicalUrl) {
      recommendations.push('Add canonical URL to avoid duplicate content issues');
    }

    if (!input.ogTitle || !input.ogDescription || !input.ogImage) {
      recommendations.push('Add OpenGraph tags for better social media sharing');
    }

    if (!input.structuredDataPresent) {
      recommendations.push('Add JSON-LD structured data (schema.org)');
    }

    if (input.hasDuplicateTitle) {
      recommendations.push('Avoid duplicate meta titles across products');
    }

    if (input.hasMultipleH1) {
      recommendations.push('Ensure page has exactly one H1 tag');
    }

    return recommendations;
  }
}
