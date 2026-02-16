import axios from 'axios';
import * as cheerio from 'cheerio';
import { createModuleLogger } from '@shared/utils/logger';

interface ImageSearchResult {
  sku: string;
  imageUrl: string | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

export class ProductImageSearchService {
  private logger = createModuleLogger('ProductImageSearchService');
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Search for product image using Google Images
   */
  async searchProductImage(sku: string, productName?: string): Promise<ImageSearchResult> {
    try {
      // Clean SKU for search
      const cleanSku = sku.trim();
      const searchQuery = productName
        ? `${cleanSku} ${productName} product image`
        : `${cleanSku} product image`;

      this.logger.info(`Searching image for SKU: ${cleanSku}`);

      // Try multiple search strategies
      const strategies = [
        () => this.searchGoogleImages(searchQuery),
        () => this.searchGoogleImages(`${cleanSku} LED`),
        () => this.searchGoogleImages(`${cleanSku} produs`),
      ];

      for (const strategy of strategies) {
        const imageUrl = await strategy();
        if (imageUrl) {
          return {
            sku: cleanSku,
            imageUrl,
            source: 'google-images',
            confidence: 'high',
          };
        }
      }

      return {
        sku: cleanSku,
        imageUrl: null,
        source: 'none',
        confidence: 'low',
        error: 'No suitable image found',
      };
    } catch (error) {
      this.logger.error(`Error searching image for SKU ${sku}:`, error);
      return {
        sku,
        imageUrl: null,
        source: 'error',
        confidence: 'low',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search Google Images and extract first valid image URL
   */
  private async searchGoogleImages(query: string): Promise<string | null> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch&safe=active`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Extract image URLs from Google Images search results
      // Google Images stores image data in JSON within script tags
      const scripts = $('script').toArray();

      for (const script of scripts) {
        const scriptContent = $(script).html() || '';

        // Look for image URLs in the script content
        const imageUrlMatches = scriptContent.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi);

        if (imageUrlMatches && imageUrlMatches.length > 0) {
          // Filter out small icons and Google's own images
          const validUrls = imageUrlMatches.filter(url =>
            !url.includes('google.com') &&
            !url.includes('gstatic.com') &&
            !url.includes('googleusercontent.com') &&
            !url.includes('logo') &&
            !url.includes('icon') &&
            url.length < 500 // Avoid data URLs
          );

          if (validUrls.length > 0) {
            // Return first valid URL
            return validUrls[0];
          }
        }
      }

      // Fallback: try to find img tags with src
      const images = $('img').toArray();
      for (const img of images) {
        const src = $(img).attr('src');
        if (src && src.startsWith('http') && !src.includes('google.com')) {
          return src;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error fetching Google Images for query "${query}":`, error);
      return null;
    }
  }

  /**
   * Batch search for multiple products
   */
  async searchProductImagesBatch(
    products: Array<{ sku: string; name?: string }>,
    options?: { maxConcurrent?: number; delayMs?: number }
  ): Promise<ImageSearchResult[]> {
    const maxConcurrent = options?.maxConcurrent || 3;
    const delayMs = options?.delayMs || 2000; // Delay between requests to avoid rate limiting

    const results: ImageSearchResult[] = [];
    const queue = [...products];

    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrent);

      const batchResults = await Promise.all(
        batch.map(p => this.searchProductImage(p.sku, p.name))
      );

      results.push(...batchResults);

      // Delay between batches to be respectful to Google
      if (queue.length > 0) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  /**
   * Validate if image URL is accessible and is a valid image
   */
  async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 3,
      });

      const contentType = response.headers['content-type'] || '';
      return contentType.startsWith('image/');
    } catch (error) {
      this.logger.warn(`Image URL validation failed for ${url}:`, error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
