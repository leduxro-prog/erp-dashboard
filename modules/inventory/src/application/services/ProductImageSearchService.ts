import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { createModuleLogger } from '@shared/utils/logger';

export interface ImageSearchResult {
  sku: string;
  imageUrl: string | null;
  localPath: string | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

export interface ImageSearchCandidate {
  url: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

export class ProductImageSearchService {
  private logger = createModuleLogger('ProductImageSearchService');
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  private readonly UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'products');

  constructor() {
    fs.mkdirSync(this.UPLOADS_DIR, { recursive: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: Search + download for a single product
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search for product images online and download the best match to disk.
   * Returns the local path (e.g. /uploads/products/123-abc.jpg) or null.
   */
  async searchAndDownload(
    productId: number,
    sku: string,
    productName?: string,
  ): Promise<ImageSearchResult> {
    const cleanSku = sku.trim();
    this.logger.info(`Searching image for product ${productId}, SKU: ${cleanSku}`);

    // Build multiple search queries (most specific first)
    const queries = this.buildSearchQueries(cleanSku, productName);

    for (const query of queries) {
      try {
        const candidates = await this.searchGoogleImages(query);

        for (const candidate of candidates.slice(0, 3)) {
          // Validate the image URL
          const isValid = await this.validateImageUrl(candidate.url);
          if (!isValid) continue;

          // Download to disk
          const localPath = await this.downloadImage(candidate.url, productId, cleanSku);
          if (localPath) {
            this.logger.info(`Found image for SKU ${cleanSku}: ${localPath}`);
            return {
              sku: cleanSku,
              imageUrl: localPath, // local path like /uploads/products/123-abc.jpg
              localPath,
              source: candidate.source,
              confidence: candidate.confidence,
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Search query "${query}" failed: ${err}`);
      }
    }

    return {
      sku: cleanSku,
      imageUrl: null,
      localPath: null,
      source: 'none',
      confidence: 'low',
      error: 'Nu s-a gasit nicio imagine potrivita',
    };
  }

  /**
   * Search for product image candidates (URLs only, no download).
   * Returns up to `maxResults` candidates for preview in frontend.
   */
  async searchCandidates(
    sku: string,
    productName?: string,
    maxResults = 6,
  ): Promise<ImageSearchCandidate[]> {
    const cleanSku = sku.trim();
    const queries = this.buildSearchQueries(cleanSku, productName);
    const allCandidates: ImageSearchCandidate[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      if (allCandidates.length >= maxResults) break;
      try {
        const candidates = await this.searchGoogleImages(query);
        for (const c of candidates) {
          if (!seenUrls.has(c.url) && allCandidates.length < maxResults) {
            seenUrls.add(c.url);
            allCandidates.push(c);
          }
        }
      } catch {
        // Continue with next query
      }
      // Small delay between queries to avoid rate limiting
      if (allCandidates.length < maxResults) {
        await this.delay(500);
      }
    }

    return allCandidates;
  }

  /**
   * Download an external image URL to local disk for a specific product.
   * Used when user picks a candidate from search results.
   */
  async downloadExternalImage(
    imageUrl: string,
    productId: number,
    sku: string,
  ): Promise<string | null> {
    return this.downloadImage(imageUrl, productId, sku);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: Batch search (existing functionality, upgraded)
  // ─────────────────────────────────────────────────────────────────────────

  async searchProductImagesBatch(
    products: Array<{ sku: string; name?: string }>,
    options?: { maxConcurrent?: number; delayMs?: number },
  ): Promise<ImageSearchResult[]> {
    const maxConcurrent = options?.maxConcurrent || 2;
    const delayMs = options?.delayMs || 3000;

    const results: ImageSearchResult[] = [];
    const queue = [...products];

    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrent);

      const batchResults = await Promise.all(
        batch.map((p) => this.searchProductImage(p.sku, p.name)),
      );

      results.push(...batchResults);

      if (queue.length > 0) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  /**
   * Legacy: search without download (for backwards compat with batch endpoint).
   */
  async searchProductImage(sku: string, productName?: string): Promise<ImageSearchResult> {
    const cleanSku = sku.trim();
    const queries = this.buildSearchQueries(cleanSku, productName);

    for (const query of queries) {
      try {
        const candidates = await this.searchGoogleImages(query);
        if (candidates.length > 0) {
          const candidate = candidates[0];
          const isValid = await this.validateImageUrl(candidate.url);
          if (isValid) {
            return {
              sku: cleanSku,
              imageUrl: candidate.url,
              localPath: null,
              source: candidate.source,
              confidence: candidate.confidence,
            };
          }
        }
      } catch {
        // Continue with next query
      }
    }

    return {
      sku: cleanSku,
      imageUrl: null,
      localPath: null,
      source: 'none',
      confidence: 'low',
      error: 'No suitable image found',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build search queries from SKU and product name. Most specific first.
   */
  private buildSearchQueries(sku: string, productName?: string): string[] {
    const queries: string[] = [];

    // 1. SKU exact
    queries.push(`"${sku}" product`);

    // 2. SKU + name if available
    if (productName) {
      // Extract brand/model from name (first 4 words max to avoid noise)
      const nameShort = productName.split(/\s+/).slice(0, 4).join(' ');
      queries.push(`${sku} ${nameShort}`);
    }

    // 3. SKU alone for LED products
    queries.push(`${sku} LED`);

    // 4. Full product name search
    if (productName && productName.length > 3) {
      const nameShort = productName.split(/\s+/).slice(0, 5).join(' ');
      queries.push(`${nameShort} product image`);
    }

    return queries;
  }

  /**
   * Search Google Images and extract valid image URLs.
   */
  private async searchGoogleImages(query: string): Promise<ImageSearchCandidate[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch&safe=active`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const candidates: ImageSearchCandidate[] = [];
    const seenUrls = new Set<string>();

    // Extract image URLs from script tags (Google stores hi-res URLs in JSON)
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const scriptContent = $(script).html() || '';

      // Match high-quality image URLs
      const imageUrlMatches = scriptContent.match(/https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp)/gi);

      if (imageUrlMatches) {
        for (const imgUrl of imageUrlMatches) {
          // Clean up escaped characters
          const cleanUrl = imgUrl.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');

          if (
            !seenUrls.has(cleanUrl) &&
            !cleanUrl.includes('google.com') &&
            !cleanUrl.includes('gstatic.com') &&
            !cleanUrl.includes('googleusercontent.com') &&
            !cleanUrl.includes('googleapis.com') &&
            !cleanUrl.includes('logo') &&
            !cleanUrl.includes('icon') &&
            !cleanUrl.includes('favicon') &&
            !cleanUrl.includes('placeholder') &&
            cleanUrl.length < 500 &&
            cleanUrl.length > 20
          ) {
            seenUrls.add(cleanUrl);
            candidates.push({
              url: cleanUrl,
              source: 'google-images',
              confidence: candidates.length < 2 ? 'high' : 'medium',
            });
          }

          if (candidates.length >= 10) break;
        }
      }

      if (candidates.length >= 10) break;
    }

    return candidates;
  }

  /**
   * Validate that an image URL is accessible and actually returns an image.
   */
  async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 8000,
        maxRedirects: 3,
        headers: { 'User-Agent': this.USER_AGENT },
      });

      const contentType = response.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) return false;

      // Check minimum file size (avoid tiny placeholder images)
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      if (contentLength > 0 && contentLength < 2000) return false; // <2KB likely icon/placeholder

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download an image from URL to the local uploads/products directory.
   * Returns the relative URL path (e.g. /uploads/products/123-abc.jpg) or null.
   */
  private async downloadImage(
    imageUrl: string,
    productId: number,
    sku: string,
  ): Promise<string | null> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 3,
        headers: { 'User-Agent': this.USER_AGENT },
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
      });

      const contentType = response.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        this.logger.warn(`Downloaded content is not an image: ${contentType}`);
        return null;
      }

      // Determine file extension from content-type
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
      };
      const ext = extMap[contentType] || '.jpg';

      // Validate minimum file size (at least 3KB for a real product image)
      const buffer = Buffer.from(response.data);
      if (buffer.length < 3000) {
        this.logger.warn(`Image too small (${buffer.length} bytes), likely placeholder`);
        return null;
      }

      // Build filename: productId-sku-timestamp.ext
      const safeSku = sku.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
      const timestamp = Date.now().toString(36);
      const filename = `${productId}-${safeSku}-${timestamp}${ext}`;
      const filePath = path.join(this.UPLOADS_DIR, filename);

      fs.writeFileSync(filePath, buffer);

      const localUrl = `/uploads/products/${filename}`;
      this.logger.info(
        `Downloaded image for product ${productId}: ${localUrl} (${(buffer.length / 1024).toFixed(0)} KB)`,
      );

      return localUrl;
    } catch (err) {
      this.logger.warn(`Failed to download image from ${imageUrl}: ${err}`);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
