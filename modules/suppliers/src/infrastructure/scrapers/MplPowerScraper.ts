import { BaseScraper, ScrapedProduct } from './BaseScraper';
import { SupplierCredentials } from '../../domain';
import { MplPowerApiClient, MplProcessedProduct } from '../services/MplPowerApiClient';
import { BnrExchangeRateService } from '../services/BnrExchangeRateService';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('mpl-power-scraper');

/**
 * MplPowerScraper
 *
 * Fetches all products from the MPL Power B2B API (AURA API 2.0).
 * Does NOT use Puppeteer - uses direct HTTP API integration.
 *
 * Flow:
 * 1. Authenticates via form POST to /security/login
 * 2. Fetches BNR EUR/RON exchange rate (+5% margin)
 * 3. Paginates through /api/products (100 per page, ~36 pages)
 * 4. Converts prices from EUR to RON
 * 5. Parses stock status from estimatedQuantity text
 *
 * Returns ScrapedProduct[] for compatibility with the existing sync pipeline.
 * Also stores extended data (mplCategoryId, EAN, etc.) via getProcessedProducts().
 */
export class MplPowerScraper extends BaseScraper {
  private apiClient: MplPowerApiClient;
  private lastProcessedProducts: MplProcessedProduct[] = [];

  constructor(browser?: any) {
    super('mpl-power', browser);
    const bnrService = new BnrExchangeRateService(5);
    this.apiClient = new MplPowerApiClient(bnrService);
  }

  /**
   * Main scraping method called by the sync pipeline.
   * Returns ScrapedProduct[] (simplified format for the existing pipeline).
   */
  async scrapeProducts(credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    return this.retry(async () => {
      try {
        logger.info('Starting MPL Power product fetch via B2B API...');

        // Fetch and process all products via the API client
        this.lastProcessedProducts = await this.apiClient.fetchAndProcessProducts({
          username: credentials.username,
          password: credentials.password,
        });

        // Map to ScrapedProduct format for the existing sync pipeline
        const products: ScrapedProduct[] = this.lastProcessedProducts.map((p) => ({
          supplierSku: p.supplierSku,
          name: p.name,
          price: p.priceRon, // Already converted to RON
          currency: 'RON',
          stockQuantity: p.stockQuantity, // 1 = in stock, 0 = out of stock
        }));

        logger.info(`MPL Power: ${products.length} products fetched and processed`);
        return products;
      } catch (error) {
        throw new Error(
          `MPL Power API fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    });
  }

  /**
   * Get the full processed products (with EAN, EUR prices, category info).
   * Must be called after scrapeProducts().
   * Used for richer import logic (category mapping, manufacturer detection, etc.).
   */
  getProcessedProducts(): MplProcessedProduct[] {
    return this.lastProcessedProducts;
  }

  /**
   * Get the underlying API client for direct access.
   */
  getApiClient(): MplPowerApiClient {
    return this.apiClient;
  }
}
