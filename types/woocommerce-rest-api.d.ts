/**
 * Type definitions for @woocommerce/woocommerce-rest-api
 *
 * This module provides type safety for the WooCommerce REST API client
 */

declare module '@woocommerce/woocommerce-rest-api' {
  export interface WooCommerceConfig {
    url: string;
    consumerKey: string;
    consumerSecret: string;
    version: string;
    queryStringAuth?: boolean;
    encoding?: string;
    timeout?: number;
  }

  export interface WooCommerceResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  }

  export default class WooCommerceRestApi {
    constructor(config: WooCommerceConfig);

    /**
     * GET request to WooCommerce API
     */
    get<T = any>(endpoint: string, params?: Record<string, any>): Promise<WooCommerceResponse<T>>;

    /**
     * POST request to WooCommerce API
     */
    post<T = any>(endpoint: string, data: Record<string, any>): Promise<WooCommerceResponse<T>>;

    /**
     * PUT request to WooCommerce API
     */
    put<T = any>(endpoint: string, data: Record<string, any>): Promise<WooCommerceResponse<T>>;

    /**
     * DELETE request to WooCommerce API
     */
    delete<T = any>(endpoint: string, params?: Record<string, any>): Promise<WooCommerceResponse<T>>;

    /**
     * OPTIONS request to WooCommerce API
     */
    options<T = any>(endpoint: string): Promise<WooCommerceResponse<T>>;
  }
}
