import { WooCommerceApiError, RateLimitError, NetworkError } from '../../application/errors/woocommerce.errors';
import { WooCommerceProduct } from '../../application/dtos/woocommerce.dtos';
import { ApiClient } from '@shared/api/api-client';
import { ApiClientFactory } from '@shared/api/api-client-factory';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('woocommerce-api-client');

/**
 * WooCommerce API client configuration.
 *
 * @example
 * {
 *   baseUrl: 'https://mystore.com',
 *   consumerKey: 'ck_...',
 *   consumerSecret: 'cs_...',
 *   timeout: 30000,
 *   maxRetries: 3,
 * }
 */
export interface WooCommerceConfig {
  /** WooCommerce store base URL */
  baseUrl: string;
  /** Consumer key from WooCommerce API settings */
  consumerKey: string;
  /** Consumer secret from WooCommerce API settings */
  consumerSecret: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts on transient errors (default: 3) */
  maxRetries?: number;
}

/**
 * WooCommerce order from REST API.
 * Contains complete order information including line items and addresses.
 */
export interface WooCommerceOrder {
  id: number;
  number: string;
  customer_id: number;
  customer_note?: string;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  shipping_total: string;
  payment_method: string;
  date_paid?: string;
  date_created: string;
  date_modified: string;
  line_items: Array<{
    id: number;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    sku: string;
    price: string;
    name: string;
  }>;
  shipping: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  billing: {
    first_name: string;
    last_name: string;
    company?: string;
    email: string;
    phone: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
}

/**
 * WooCommerce product category from REST API.
 */
export interface WooCommerceCategory {
  /** Category ID */
  id: number;
  /** Category name */
  name: string;
  /** Category URL slug */
  slug: string;
  /** Category description */
  description?: string;
  /** Parent category ID */
  parent?: number;
}

/**
 * WooCommerce API Client adapter for legacy integration.
 *
 * Wraps the centralized ApiClient from the factory to provide
 * backward compatibility while leveraging new resilience patterns.
 *
 * NEW: Use ApiClientFactory.getClient('woocommerce') for direct access
 * to the generic client with all resilience features.
 *
 * @example
 * // Legacy usage (still supported)
 * const client = new WooCommerceApiClient({
 *   baseUrl: 'https://mystore.com',
 *   consumerKey: 'ck_...',
 *   consumerSecret: 'cs_...',
 * });
 *
 * const product = await client.getProduct(123);
 *
 * @example
 * // New recommended usage
 * const client = ApiClientFactory.getClient('woocommerce');
 * const response = await client.get<WooCommerceProduct>('/products/123');
 */
export class WooCommerceApiClient {
  private genericClient: ApiClient;
  private config: WooCommerceConfig;

  /**
   * Create a new WooCommerce API client.
   *
   * @param config - Client configuration
   */
  constructor(config: WooCommerceConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };

    // Get or create the generic client from factory
    ApiClientFactory.initialize();
    this.genericClient = ApiClientFactory.getClient('woocommerce');

    logger.info('WooCommerce API client initialized (factory-backed)', {
      baseUrl: this.config.baseUrl,
    });
  }

  /**
   * Get a product by ID.
   *
   * @param id - Product ID
   * @returns Product data
   * @throws {WooCommerceApiError} If API call fails
   */
  async getProduct(id: number): Promise<WooCommerceProduct> {
    try {
      const response = await this.genericClient.get<WooCommerceProduct>(`/products/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new product.
   *
   * @param data - Product data
   * @returns Created product
   * @throws {WooCommerceApiError} If API call fails
   */
  async createProduct(data: any): Promise<WooCommerceProduct> {
    try {
      const response = await this.genericClient.post<WooCommerceProduct>('/products', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing product.
   *
   * @param id - Product ID
   * @param data - Updated product data
   * @returns Updated product
   * @throws {WooCommerceApiError} If API call fails
   */
  async updateProduct(id: number, data: any): Promise<WooCommerceProduct> {
    try {
      const response = await this.genericClient.put<WooCommerceProduct>(`/products/${id}`, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Batch update multiple products.
   *
   * @param data - Array of product updates
   * @returns Results with created and updated products
   * @throws {WooCommerceApiError} If API call fails
   */
  async batchUpdateProducts(
    data: Array<any>
  ): Promise<{ create: any[]; update: any[] }> {
    try {
      const response = await this.genericClient.post<any>('/products/batch', {
        update: data,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get orders with optional filtering.
   *
   * @param params - Query parameters for filtering/pagination
   * @returns Array of orders
   * @throws {WooCommerceApiError} If API call fails
   */
  async getOrders(params?: any): Promise<WooCommerceOrder[]> {
    try {
      const response = await this.genericClient.get<WooCommerceOrder[]>('/orders', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get product categories.
   *
   * @param params - Query parameters for filtering
   * @returns Array of categories
   * @throws {WooCommerceApiError} If API call fails
   */
  async getCategories(params?: any): Promise<WooCommerceCategory[]> {
    try {
      const response = await this.genericClient.get<WooCommerceCategory[]>('/products/categories', params);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new product category.
   *
   * @param data - Category data
   * @returns Created category
   * @throws {WooCommerceApiError} If API call fails
   */
  async createCategory(data: any): Promise<WooCommerceCategory> {
    try {
      const response = await this.genericClient.post<WooCommerceCategory>('/products/categories', data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing category.
   *
   * @param id - Category ID
   * @param data - Updated category data
   * @returns Updated category
   * @throws {WooCommerceApiError} If API call fails
   */
  async updateCategory(id: number, data: any): Promise<WooCommerceCategory> {
    try {
      const response = await this.genericClient.put<WooCommerceCategory>(
        `/products/categories/${id}`,
        data
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle and normalize API errors to WooCommerceApiError.
   *
   * Maps different error types to appropriate exceptions.
   *
   * @param error - The error to handle
   * @throws {RateLimitError} If rate limited
   * @throws {NetworkError} If network issue
   * @throws {WooCommerceApiError} For other API errors
   *
   * @internal
   */
  private handleError(error: any): Error {
    if (error instanceof WooCommerceApiError || error instanceof RateLimitError || error instanceof NetworkError) {
      return error;
    }

    // Extract details from error
    const status = error?.response?.status || error?.status || 500;
    const message = error instanceof Error ? error.message : String(error);
    const data = error?.response?.data || error?.data;

    // Handle rate limiting (429 Too Many Requests)
    if (status === 429) {
      const retryAfter = parseInt(
        error?.response?.headers?.['retry-after'] as string,
        10
      ) * 1000 || 5000;

      logger.warn('WooCommerce API rate limited', {
        retryAfterMs: retryAfter,
      });

      return new RateLimitError(retryAfter);
    }

    // Handle network errors
    if (!error?.response) {
      logger.error('WooCommerce API network error', {
        message,
      });

      return new NetworkError(`Network error: ${message}`, error);
    }

    // Handle API errors
    logger.error('WooCommerce API error', {
      status,
      message: data?.message || message,
    });

    return new WooCommerceApiError(
      data?.message || `WooCommerce API error: ${message}`,
      status,
      data
    );
  }
}
