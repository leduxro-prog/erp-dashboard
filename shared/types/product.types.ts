/**
 * Product catalog types
 */

import { BaseEntity, Language, Currency } from './common.types';

/**
 * Product category
 */
export interface Category extends BaseEntity {
  /** Category code/slug */
  code: string;
  /** Parent category ID (for nested categories) */
  parentId?: number | null;
  /** Display order */
  sortOrder: number;
  /** Whether category is active */
  isActive: boolean;
  /** Category image URL */
  imageUrl?: string | null;
  /** SEO meta description */
  metaDescription?: string | null;
  /** SEO meta keywords */
  metaKeywords?: string | null;
}

/**
 * Translated category name and description
 */
export interface CategoryTranslation extends BaseEntity {
  categoryId: number;
  language: Language;
  /** Category name */
  name: string;
  /** Category description */
  description?: string | null;
  /** SEO slug for URL */
  slug: string;
}

/**
 * Main product entity
 */
export interface Product extends BaseEntity {
  /** Product SKU (Stock Keeping Unit) */
  sku: string;
  /** Product barcode/EAN */
  barcode?: string | null;
  /** Primary category ID */
  categoryId: number;
  /** Whether product is active */
  isActive: boolean;
  /** Whether product is featured */
  isFeatured: boolean;
  /** Whether product is new */
  isNew: boolean;
  /** Product type (simple, configurable, etc.) */
  type: string;
  /** Base price in RON (without VAT) */
  basePrice: number;
  /** Wholesale/supplier cost price */
  costPrice: number;
  /** Currency (always RON) */
  currency: Currency;
  /** VAT rate applied (19% in Romania) */
  vatRate: number;
  /** Weight in kg */
  weight?: number | null;
  /** Dimensions (JSON: {length, width, height}) */
  dimensions?: Record<string, number> | null;
  /** Whether product requires special handling */
  requiresSpecialHandling: boolean;
  /** Stock keeping unit type */
  stockUnit: string;
  /** Minimum order quantity */
  minimumOrderQuantity: number;
  /** Maximum order quantity (null = unlimited) */
  maximumOrderQuantity?: number | null;
  /** Lead time in days */
  leadTimeDays: number;
  /** Whether product is discontinued */
  isDiscontinued: boolean;
  /** Discontinuation date */
  discontinuedAt?: Date | null;
  /** Replacement product SKU */
  replacementSku?: string | null;
  /** View count */
  viewCount: number;
  /** Total units sold */
  unitsSold: number;
  /** Average rating */
  averageRating?: number | null;
  /** Number of reviews */
  reviewCount: number;
  /** Product metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Translated product information
 */
export interface ProductTranslation extends BaseEntity {
  productId: number;
  language: Language;
  /** Product name */
  name: string;
  /** Product description */
  description?: string | null;
  /** Short description */
  shortDescription?: string | null;
  /** SEO slug for URL */
  slug: string;
  /** SEO meta title */
  metaTitle?: string | null;
  /** SEO meta description */
  metaDescription?: string | null;
  /** SEO meta keywords */
  metaKeywords?: string | null;
  /** Specifications in JSON format */
  specifications?: Record<string, unknown> | null;
}

/**
 * Product image
 */
export interface ProductImage extends BaseEntity {
  productId: number;
  /** Image URL */
  url: string;
  /** Alt text for accessibility */
  altText?: string | null;
  /** Image title */
  title?: string | null;
  /** Whether this is the primary/featured image */
  isPrimary: boolean;
  /** Sort order */
  sortOrder: number;
  /** Image type (thumbnail, full, etc.) */
  imageType?: string | null;
}

/**
 * Product attribute (e.g., color, size, etc.)
 */
export interface ProductAttribute extends BaseEntity {
  productId: number;
  /** Attribute name */
  name: string;
  /** Attribute value */
  value: string;
  /** Display order */
  sortOrder: number;
}

/**
 * Product variant (for configurable products)
 */
export interface ProductVariant extends BaseEntity {
  productId: number;
  /** Variant SKU */
  sku: string;
  /** Variant price adjustment */
  priceAdjustment: number;
  /** Variant cost adjustment */
  costAdjustment: number;
  /** Barcode for variant */
  barcode?: string | null;
  /** Whether variant is active */
  isActive: boolean;
  /** Stock quantity for variant */
  stockQuantity: number;
  /** Attributes JSON (color, size, etc.) */
  attributes?: Record<string, string> | null;
  /** Image URL specific to variant */
  imageUrl?: string | null;
}

/**
 * Product relationship (related products, cross-sells, upsells)
 */
export interface ProductRelation extends BaseEntity {
  /** Source product ID */
  productId: number;
  /** Related product ID */
  relatedProductId: number;
  /** Relation type (related, upsell, cross-sell) */
  relationType: 'related' | 'upsell' | 'cross-sell';
  /** Display order */
  sortOrder: number;
}

/**
 * Product review
 */
export interface ProductReview extends BaseEntity {
  productId: number;
  customerId?: number | null;
  /** Review title */
  title: string;
  /** Review content */
  content: string;
  /** Rating (1-5) */
  rating: number;
  /** Whether review is verified purchase */
  isVerifiedPurchase: boolean;
  /** Whether review is approved */
  isApproved: boolean;
  /** Review helpful count */
  helpfulCount: number;
}

/**
 * DTO for creating/updating a product
 */
export interface CreateProductDTO {
  sku: string;
  barcode?: string;
  categoryId: number;
  type: string;
  basePrice: number;
  costPrice: number;
  weight?: number;
  dimensions?: Record<string, number>;
  requiresSpecialHandling?: boolean;
  stockUnit?: string;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  leadTimeDays?: number;
  translations: {
    language: Language;
    name: string;
    description?: string;
    shortDescription?: string;
  }[];
  images?: {
    url: string;
    altText?: string;
    isPrimary?: boolean;
  }[];
}

/**
 * DTO for updating a product
 */
export interface UpdateProductDTO {
  sku?: string;
  barcode?: string;
  categoryId?: number;
  basePrice?: number;
  costPrice?: number;
  weight?: number;
  dimensions?: Record<string, number>;
  requiresSpecialHandling?: boolean;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  leadTimeDays?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  isDiscontinued?: boolean;
  discontinuedAt?: Date;
  replacementSku?: string;
  translations?: {
    language: Language;
    name: string;
    description?: string;
    shortDescription?: string;
  }[];
}

/**
 * Product search filters
 */
export interface ProductFilters {
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  rating?: number;
  inStock?: boolean;
}

/**
 * Product with computed fields for API responses
 */
export interface ProductWithDetails extends Product {
  translations: ProductTranslation[];
  images: ProductImage[];
  category?: Category;
  vatIncludedPrice?: number;
  discountedPrice?: number;
  stockLevel?: number;
  supplier?: {
    id: number;
    name: string;
    sku: string;
  };
}
