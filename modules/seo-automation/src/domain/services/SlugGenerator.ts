/**
 * SlugGenerator Service
 *
 * Generates URL-safe slugs from text with support for Romanian diacritics.
 * Ensures slugs are unique and SEO-friendly.
 *
 * ### Transformation Steps
 * 1. Remove/replace Romanian diacritics (ă→a, î→i, ț→t, ș→s)
 * 2. Convert to lowercase
 * 3. Replace spaces and underscores with hyphens
 * 4. Remove special characters (keep only a-z, 0-9, hyphens)
 * 5. Remove consecutive hyphens
 * 6. Trim leading/trailing hyphens
 *
 * ### Examples
 * - "Bec LED 10W" → "bec-led-10w"
 * - "Bec cu Alimentare Duală" → "bec-cu-alimentare-duala"
 * - "Ștrangulator Țapă" → "strangulator-tapa"
 *
 * @example
 * const generator = new SlugGenerator();
 * const slug = generator.generate('Bec LED 10W Warm White');
 * // Returns: 'bec-led-10w-warm-white'
 */

/**
 * SlugGenerator - Domain Service
 *
 * Generates URL-safe slugs from text.
 */
export class SlugGenerator {
  /**
   * Romanian diacritics mapping
   */
  private readonly diacriticsMap: Record<string, string> = {
    ă: 'a',
    â: 'a',
    î: 'i',
    ț: 't',
    ș: 's',
    Ă: 'a',
    Â: 'a',
    Î: 'i',
    Ț: 't',
    Ș: 's',
  };

  /**
   * Generate a URL-safe slug from text
   *
   * @param text - Text to convert to slug
   * @returns URL-safe slug
   * @throws {Error} If text is empty
   */
  generate(text: string): string {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required to generate slug');
    }

    let slug = text;

    // Step 1: Remove Romanian diacritics
    slug = this.removeDiacritics(slug);

    // Step 2: Convert to lowercase
    slug = slug.toLowerCase();

    // Step 3: Replace spaces and underscores with hyphens
    slug = slug.replace(/[\s_]+/g, '-');

    // Step 4: Remove special characters (keep only a-z, 0-9, hyphens)
    slug = slug.replace(/[^a-z0-9\-]/g, '');

    // Step 5: Remove consecutive hyphens
    slug = slug.replace(/\-+/g, '-');

    // Step 6: Trim leading/trailing hyphens
    slug = slug.replace(/^\-+|\-+$/g, '');

    return slug;
  }

  /**
   * Generate a slug with numeric suffix for uniqueness
   *
   * Useful for ensuring uniqueness in collections.
   *
   * @param text - Text to convert
   * @param existingSlugs - Array of existing slugs to check against
   * @returns Unique slug (original or with numeric suffix)
   */
  generateUnique(text: string, existingSlugs: string[]): string {
    let slug = this.generate(text);

    if (!existingSlugs.includes(slug)) {
      return slug;
    }

    let counter = 2;
    while (existingSlugs.includes(`${slug}-${counter}`)) {
      counter++;
    }

    return `${slug}-${counter}`;
  }

  /**
   * Remove Romanian diacritics from text
   *
   * @param text - Text to process
   * @returns Text without diacritics
   *
   * @internal
   */
  private removeDiacritics(text: string): string {
    let result = text;

    for (const [diacritic, replacement] of Object.entries(this.diacriticsMap)) {
      result = result.replace(new RegExp(diacritic, 'g'), replacement);
    }

    return result;
  }

  /**
   * Check if a text would generate a valid slug
   *
   * @param text - Text to validate
   * @returns True if text can be converted to valid slug
   */
  isValid(text: string): boolean {
    try {
      const slug = this.generate(text);
      return slug.length > 0 && /^[a-z0-9\-]+$/.test(slug);
    } catch {
      return false;
    }
  }

  /**
   * Validate a slug format
   *
   * Checks if slug matches expected format: lowercase, numbers, hyphens only.
   *
   * @param slug - Slug to validate
   * @returns True if slug is valid format
   */
  isValidFormat(slug: string): boolean {
    return (
      slug.length > 0 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
      !slug.startsWith('-') &&
      !slug.endsWith('-')
    );
  }

  /**
   * Get suggested slug from text
   *
   * Returns slug with validation info.
   *
   * @param text - Text to convert
   * @returns Object with slug and validity info
   */
  suggest(text: string): { slug: string; isValid: boolean; length: number } {
    const slug = this.generate(text);
    return {
      slug,
      isValid: this.isValidFormat(slug),
      length: slug.length,
    };
  }
}
