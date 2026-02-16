/**
 * ICategoryPort Interface
 *
 * Port for accessing category data from external sources.
 * Abstracts category data retrieval.
 *
 * @interface ICategoryPort
 */

/**
 * Category data structure
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  slug?: string;
  image?: string;
  productCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * ICategoryPort - Adapter Port
 *
 * Abstracts category data access.
 */
export interface ICategoryPort {
  /**
   * Get a single category by ID
   *
   * @param categoryId - ID of the category
   * @returns Category or null if not found
   * @throws {Error} If retrieval fails
   */
  getCategory(categoryId: string): Promise<Category | null>;

  /**
   * Get all categories
   *
   * @returns List of all categories
   * @throws {Error} If retrieval fails
   */
  getAllCategories(): Promise<Category[]>;

  /**
   * Get child categories
   *
   * @param parentId - Parent category ID
   * @returns List of child categories
   * @throws {Error} If retrieval fails
   */
  getChildCategories(parentId: string): Promise<Category[]>;

  /**
   * Get category by slug
   *
   * @param slug - Category slug
   * @returns Category or null if not found
   * @throws {Error} If retrieval fails
   */
  getCategoryBySlug(slug: string): Promise<Category | null>;
}
