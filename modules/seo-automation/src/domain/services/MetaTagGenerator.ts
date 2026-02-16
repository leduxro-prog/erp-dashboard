/**
 * MetaTagGenerator Service
 *
 * Auto-generates meta titles and descriptions from product data.
 * Uses templates specific to Ledux.ro's brand and market.
 *
 * ### Templates
 *
 * **Title:**
 * - Product: "[Product Name] - [Category] | Ledux.ro"
 * - Category: "[Category Name] cu pret redus | Ledux.ro"
 * - Page: "[Page Title] | Ledux.ro"
 *
 * **Description:**
 * - Product: "Cumpara [Product Name] cu [Feature]. [Benefit]. Livrare rapida in toata Romania."
 * - Category: "Gama completa de [Category]. Pret competitiv. Livrare in 24-48 ore. Garantie."
 * - Page: First 160 characters of content or custom description
 *
 * ### Constraints
 * - Title: max 60 characters
 * - Description: max 160 characters
 *
 * @example
 * const generator = new MetaTagGenerator();
 * const tags = generator.generateForProduct({
 *   name: 'Bec LED 10W Warm White',
 *   category: 'Becuri LED',
 *   price: 25.99,
 * });
 * // Returns: { title: 'Bec LED 10W - Becuri LED | Ledux.ro', description: '...' }
 */

/**
 * Product data for generation
 */
export interface ProductData {
  name: string;
  category?: string;
  description?: string;
  price?: number;
  features?: string[];
  sku?: string;
}

/**
 * Category data for generation
 */
export interface CategoryData {
  name: string;
  description?: string;
  productCount?: number;
}

/**
 * Page data for generation
 */
export interface PageData {
  title: string;
  content?: string;
  description?: string;
}

/**
 * Generated meta tags
 */
export interface GeneratedMetaTags {
  title: string;
  description: string;
  focusKeyword: string;
}

/**
 * MetaTagGenerator - Domain Service
 *
 * Generates SEO-optimized meta tags from entity data.
 */
export class MetaTagGenerator {
  /**
   * Ledux.ro brand suffix for titles
   */
  private readonly brandSuffix = 'Ledux.ro';

  /**
   * Generate meta tags for a product
   *
   * @param product - Product data
   * @returns Generated meta tags (title and description)
   */
  generateForProduct(product: ProductData): GeneratedMetaTags {
    const title = this.generateProductTitle(product);
    const description = this.generateProductDescription(product);
    const focusKeyword = this.extractFocusKeyword(product.name);

    return {
      title: this.truncate(title, 60),
      description: this.truncate(description, 160),
      focusKeyword,
    };
  }

  /**
   * Generate meta tags for a category
   *
   * @param category - Category data
   * @returns Generated meta tags
   */
  generateForCategory(category: CategoryData): GeneratedMetaTags {
    const title = this.generateCategoryTitle(category);
    const description = this.generateCategoryDescription(category);
    const focusKeyword = this.extractFocusKeyword(category.name);

    return {
      title: this.truncate(title, 60),
      description: this.truncate(description, 160),
      focusKeyword,
    };
  }

  /**
   * Generate meta tags for a page
   *
   * @param page - Page data
   * @returns Generated meta tags
   */
  generateForPage(page: PageData): GeneratedMetaTags {
    const title = `${page.title} | ${this.brandSuffix}`;
    const description =
      page.description ||
      (page.content
        ? page.content.substring(0, 160)
        : 'Discover more on Ledux.ro');
    const focusKeyword = this.extractFocusKeyword(page.title);

    return {
      title: this.truncate(title, 60),
      description: this.truncate(description, 160),
      focusKeyword,
    };
  }

  /**
   * Generate product title
   *
   * Template: "[Product Name] - [Category] | Ledux.ro"
   *
   * @param product - Product data
   * @returns Generated title
   *
   * @internal
   */
  private generateProductTitle(product: ProductData): string {
    const category = product.category ? ` - ${product.category}` : '';
    return `${product.name}${category} | ${this.brandSuffix}`;
  }

  /**
   * Generate product description
   *
   * Template: "Cumpara [Product Name]. [Benefit]. Livrare rapida. Garantie."
   *
   * @param product - Product data
   * @returns Generated description
   *
   * @internal
   */
  private generateProductDescription(product: ProductData): string {
    const priceText = product.price ? ` la ${product.price} lei` : '';
    const featureText = product.features?.[0] ? `cu ${product.features[0]}` : 'de calitate';
    const baseDescription = `Cumpara ${product.name} ${featureText}${priceText}. Livrare rapida in toata Romania. Garantie.`;
    return baseDescription;
  }

  /**
   * Generate category title
   *
   * Template: "[Category Name] cu pret redus | Ledux.ro"
   *
   * @param category - Category data
   * @returns Generated title
   *
   * @internal
   */
  private generateCategoryTitle(category: CategoryData): string {
    return `${category.name} cu pret redus | ${this.brandSuffix}`;
  }

  /**
   * Generate category description
   *
   * Template: "Gama completa de [Category]. Pret competitiv. Livrare rapida."
   *
   * @param category - Category data
   * @returns Generated description
   *
   * @internal
   */
  private generateCategoryDescription(category: CategoryData): string {
    const countText = category.productCount
      ? ` cu ${category.productCount} produse`
      : '';
    return `Gama completa de ${category.name}${countText}. Pret competitiv. Livrare in 24-48 ore.`;
  }

  /**
   * Extract focus keyword from text
   *
   * Takes the first 2-3 words as focus keyword.
   *
   * @param text - Text to extract keyword from
   * @returns Focus keyword
   *
   * @internal
   */
  private extractFocusKeyword(text: string): string {
    const words = text.toLowerCase().split(/\s+/);
    return words.slice(0, Math.min(3, words.length)).join(' ');
  }

  /**
   * Truncate text to maximum length
   *
   * Adds ellipsis if truncated.
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   *
   * @internal
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Validate generated tags meet constraints
   *
   * @param tags - Generated tags to validate
   * @returns Array of validation errors (empty if valid)
   */
  validate(tags: GeneratedMetaTags): string[] {
    const errors: string[] = [];

    if (!tags.title || tags.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (tags.title.length > 60) {
      errors.push(`Title exceeds 60 characters (${tags.title.length})`);
    }

    if (!tags.description || tags.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (tags.description.length > 160) {
      errors.push(`Description exceeds 160 characters (${tags.description.length})`);
    }

    if (!tags.focusKeyword || tags.focusKeyword.trim().length === 0) {
      errors.push('Focus keyword is required');
    }

    return errors;
  }
}
