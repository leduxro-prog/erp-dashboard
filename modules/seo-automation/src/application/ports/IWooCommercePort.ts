/**
 * IWooCommercePort Interface
 *
 * Port for WooCommerce integration.
 * Handles syncing SEO metadata back to WooCommerce.
 *
 * @interface IWooCommercePort
 */

/**
 * Product meta data to update in WooCommerce
 */
export interface WooCommerceProductMeta {
  productId: number | string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
}

/**
 * IWooCommercePort - Adapter Port
 *
 * Handles WooCommerce integration for SEO metadata.
 */
export interface IWooCommercePort {
  /**
   * Update product SEO metadata in WooCommerce
   *
   * Syncs meta title, description, and other SEO tags to WooCommerce.
   *
   * @param meta - Product metadata to update
   * @returns Promise that resolves when update is complete
   * @throws {Error} If update fails
   */
  updateProductMeta(meta: WooCommerceProductMeta): Promise<void>;

  /**
   * Upload XML sitemap to WooCommerce
   *
   * Registers sitemap location with WooCommerce.
   *
   * @param sitemapUrl - Public URL of the XML sitemap
   * @returns Promise that resolves when upload is complete
   * @throws {Error} If upload fails
   */
  uploadSitemap(sitemapUrl: string): Promise<void>;

  /**
   * Update product canonical URL in WooCommerce
   *
   * @param productId - WooCommerce product ID
   * @param canonicalUrl - Canonical URL to set
   * @returns Promise that resolves when update is complete
   * @throws {Error} If update fails
   */
  updateCanonicalUrl(productId: string | number, canonicalUrl: string): Promise<void>;

  /**
   * Check if WooCommerce connection is working
   *
   * @returns True if connected and authenticated
   * @throws {Error} If connection check fails
   */
  isConnected(): Promise<boolean>;

  /**
   * Get WooCommerce API version
   *
   * @returns API version string
   * @throws {Error} If version check fails
   */
  getApiVersion(): Promise<string>;
}
