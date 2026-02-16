/**
 * IProductPort Interface
 *
 * Port for accessing product data from external sources.
 * Abstracts product data retrieval (WooCommerce, internal database, etc.)
 *
 * @interface IProductPort
 */

/**
 * Product data structure
 */
export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  categoryId?: string;
  sku?: string;
  image?: string;
  shortDescription?: string;
  features?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * IProductPort - Adapter Port
 *
 * Abstracts product data access. Can be implemented by WooCommerce,
 * database, or other product sources.
 */
export interface IProductPort {
  /**
   * Get a single product by ID
   *
   * @param productId - ID of the product
   * @returns Product or null if not found
   * @throws {Error} If retrieval fails
   */
  getProduct(productId: string): Promise<Product | null>;

  /**
   * Get all products with pagination
   *
   * @param pagination - Pagination parameters
   * @returns Paginated list of products
   * @throws {Error} If retrieval fails
   */
  getAllProducts(pagination: PaginationParams): Promise<PaginatedResult<Product>>;

  /**
   * Get products by category
   *
   * @param categoryId - Category ID to filter by
   * @param pagination - Pagination parameters
   * @returns Paginated list of products in category
   * @throws {Error} If retrieval fails
   */
  getProductsByCategory(
    categoryId: string,
    pagination?: PaginationParams
  ): Promise<Product[]>;

  /**
   * Search products by name or SKU
   *
   * @param query - Search query
   * @param pagination - Pagination parameters
   * @returns Paginated search results
   * @throws {Error} If search fails
   */
  searchProducts(query: string, pagination?: PaginationParams): Promise<PaginatedResult<Product>>;
}
