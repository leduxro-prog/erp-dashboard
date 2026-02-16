/**
 * Sitemap Entity
 *
 * Represents an XML sitemap for search engines.
 * Supports product, category, page, and index sitemaps.
 *
 * ### Sitemap Types
 * - PRODUCTS: Contains all product URLs
 * - CATEGORIES: Contains all category URLs
 * - PAGES: Contains static page URLs
 * - INDEX: Master sitemap index pointing to other sitemaps
 *
 * ### Change Frequency
 * - ALWAYS: Content changes every time accessed
 * - HOURLY: Content changes hourly
 * - DAILY: Content changes daily (default for products)
 * - WEEKLY: Content changes weekly
 * - MONTHLY: Content changes monthly
 * - YEARLY: Content changes yearly
 * - NEVER: Content will not change
 *
 * ### Priority
 * - 0.0 to 1.0, where 1.0 is highest priority
 * - Default: 0.5
 * - Products: 0.8
 * - Categories: 0.7
 * - Pages: 0.6
 *
 * @example
 * const sitemap = new Sitemap({
 *   id: 'sitemap-uuid',
 *   type: 'PRODUCTS',
 *   url: 'https://ledux.ro/sitemap-products.xml',
 *   changefreq: 'DAILY',
 *   priority: 0.8,
 * });
 *
 * sitemap.addEntry('https://ledux.ro/product/bec-led-10w', new Date(), 0.8);
 * const xml = sitemap.generateXml();
 */

/**
 * Supported sitemap types
 */
export enum SitemapType {
  PRODUCTS = 'PRODUCTS',
  CATEGORIES = 'CATEGORIES',
  PAGES = 'PAGES',
  INDEX = 'INDEX',
}

/**
 * Change frequency values
 */
export enum ChangeFrequency {
  ALWAYS = 'always',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  NEVER = 'never',
}

/**
 * Single sitemap entry
 */
export interface SitemapEntry {
  url: string;
  lastmod: Date;
  priority: number;
}

/**
 * Properties for creating a Sitemap
 */
export interface SitemapProps {
  id: string;
  type: SitemapType;
  url: string;
  lastmod?: Date;
  changefreq?: ChangeFrequency;
  priority?: number;
  entries?: SitemapEntry[];
  generatedAt?: Date;
  fileSize?: number;
}

/**
 * Sitemap - Entity
 *
 * Manages XML sitemaps for search engine indexing.
 * Generates valid XML and tracks file size and generation time.
 */
export class Sitemap {
  /**
   * Unique identifier for this sitemap
   */
  readonly id: string;

  /**
   * Type of sitemap (PRODUCTS, CATEGORIES, PAGES, or INDEX)
   */
  readonly type: SitemapType;

  /**
   * Public URL where sitemap is accessible
   */
  url: string;

  /**
   * Last modification date for the sitemap itself
   */
  lastmod: Date;

  /**
   * Suggested change frequency for search engines
   */
  changefreq: ChangeFrequency;

  /**
   * Priority hint for this sitemap (0.0-1.0)
   */
  priority: number;

  /**
   * Individual entries in the sitemap
   */
  entries: SitemapEntry[] = [];

  /**
   * Timestamp when sitemap was generated
   */
  generatedAt: Date;

  /**
   * File size in bytes
   */
  fileSize: number = 0;

  /**
   * Create a new Sitemap entity
   *
   * @param props - Properties for the sitemap
   * @throws {Error} If required properties are missing
   */
  constructor(props: SitemapProps) {
    if (!props.id) throw new Error('Sitemap id is required');
    if (!props.type) throw new Error('Sitemap type is required');
    if (!props.url) throw new Error('Sitemap url is required');

    this.id = props.id;
    this.type = props.type;
    this.url = props.url;
    this.lastmod = props.lastmod ?? new Date();
    this.changefreq = props.changefreq ?? ChangeFrequency.DAILY;
    this.priority = props.priority ?? 0.5;
    this.entries = props.entries ?? [];
    this.generatedAt = props.generatedAt ?? new Date();
    this.fileSize = props.fileSize ?? 0;

    this.validatePriority();
  }

  /**
   * Validate priority is within acceptable range
   *
   * @throws {Error} If priority is not between 0.0 and 1.0
   */
  private validatePriority(): void {
    if (this.priority < 0.0 || this.priority > 1.0) {
      throw new Error('Priority must be between 0.0 and 1.0');
    }
  }

  /**
   * Add an entry to the sitemap
   *
   * @param url - URL of the entry
   * @param lastmod - Last modification date
   * @param priority - Priority (0.0-1.0)
   * @throws {Error} If URL is invalid or priority is out of range
   */
  addEntry(url: string, lastmod: Date, priority: number): void {
    if (!url || !url.startsWith('http')) {
      throw new Error('Invalid URL');
    }

    if (priority < 0.0 || priority > 1.0) {
      throw new Error('Priority must be between 0.0 and 1.0');
    }

    // Avoid duplicates
    const existingIndex = this.entries.findIndex((e) => e.url === url);
    if (existingIndex >= 0) {
      this.entries[existingIndex] = { url, lastmod, priority };
    } else {
      this.entries.push({ url, lastmod, priority });
    }

    this.lastmod = new Date();
  }

  /**
   * Remove an entry from the sitemap
   *
   * @param url - URL of the entry to remove
   * @returns True if entry was removed, false if not found
   */
  removeEntry(url: string): boolean {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.url !== url);
    const removed = this.entries.length < initialLength;

    if (removed) {
      this.lastmod = new Date();
    }

    return removed;
  }

  /**
   * Generate XML sitemap content
   *
   * Creates valid XML according to sitemap.org protocol.
   * For INDEX type, includes sitemap entries.
   * For other types, includes URL entries.
   *
   * @returns XML string
   */
  generateXml(): string {
    const lines: string[] = [];

    // XML declaration
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');

    if (this.type === SitemapType.INDEX) {
      // Sitemap index format
      lines.push('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      for (const entry of this.entries) {
        lines.push('  <sitemap>');
        lines.push(`    <loc>${this.escapeXml(entry.url)}</loc>`);
        lines.push(`    <lastmod>${entry.lastmod.toISOString().split('T')[0]}</lastmod>`);
        lines.push('  </sitemap>');
      }

      lines.push('</sitemapindex>');
    } else {
      // Standard sitemap format
      lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      for (const entry of this.entries) {
        lines.push('  <url>');
        lines.push(`    <loc>${this.escapeXml(entry.url)}</loc>`);
        lines.push(`    <lastmod>${entry.lastmod.toISOString().split('T')[0]}</lastmod>`);
        lines.push(`    <changefreq>${this.changefreq}</changefreq>`);
        lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
        lines.push('  </url>');
      }

      lines.push('</urlset>');
    }

    const xml = lines.join('\n');
    this.fileSize = Buffer.byteLength(xml, 'utf8');
    return xml;
  }

  /**
   * Escape special XML characters
   *
   * @param text - Text to escape
   * @returns Escaped text safe for XML
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Check if sitemap is stale (not regenerated in 24 hours)
   *
   * @returns True if sitemap is older than 24 hours
   */
  isStale(): boolean {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    return this.generatedAt < twentyFourHoursAgo;
  }

  /**
   * Get count of entries in sitemap
   *
   * @returns Number of entries
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Get average priority across all entries
   *
   * @returns Average priority (0.0-1.0)
   */
  getAveragePriority(): number {
    if (this.entries.length === 0) return this.priority;
    const sum = this.entries.reduce((acc, e) => acc + e.priority, 0);
    return sum / this.entries.length;
  }

  /**
   * Convert entity to plain object
   *
   * @returns Plain object representation
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      url: this.url,
      lastmod: this.lastmod.toISOString(),
      changefreq: this.changefreq,
      priority: this.priority,
      entryCount: this.entries.length,
      generatedAt: this.generatedAt.toISOString(),
      fileSize: this.fileSize,
    };
  }
}
