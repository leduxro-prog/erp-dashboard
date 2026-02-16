/**
 * Price Repository Interface (Port)
 * Defines contract for price data access
 */

import { CreatePromotionDTO } from '../dtos/pricing.dtos';

/**
 * Product price representation
 */
export interface ProductPrice {
  productId: number;
  price: number;
  cost?: number;
  currency: string;
  lastUpdated: Date;
}

/**
 * Promotion representation
 */
export interface PromotionRecord {
  id: number;
  productId: number;
  promotionalPrice: number;
  originalPrice: number;
  validFrom: Date;
  validUntil: Date;
  reason: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Volume discount rule representation
 */
export interface VolumeDiscountRule {
  id: number;
  productId: number;
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
}

/**
 * Repository port for price-related data access
 * Implementation-agnostic interface
 */
export interface IPriceRepository {
  /**
   * Get price for a single product
   */
  getProductPrice(productId: number): Promise<ProductPrice | null>;

  /**
   * Get prices for multiple products
   */
  getProductPricesByIds(productIds: number[]): Promise<ProductPrice[]>;

  /**
   * Get active promotions for a specific product
   */
  getActivePromotionsForProduct(productId: number): Promise<PromotionRecord[]>;

  /**
   * Get all active promotions across all products
   */
  getAllActivePromotions(): Promise<PromotionRecord[]>;

  /**
   * Get volume discount rule for a product at a specific quantity
   */
  getVolumeDiscountRuleForQuantity(
    productId: number,
    quantity: number
  ): Promise<VolumeDiscountRule | null>;

  /**
   * Create a new promotion
   */
  createPromotion(data: CreatePromotionDTO): Promise<PromotionRecord>;

  /**
   * Deactivate a promotion
   */
  deactivatePromotion(promotionId: number): Promise<void>;

  /**
   * Expire promotions that have ended before a given date
   */
  expirePromotionsBefore(beforeDate: Date): Promise<number>;

  /**
   * Update a product price
   */
  updateProductPrice(productId: number, newPrice: number): Promise<void>;

  /**
   * Create or update a volume discount rule
   */
  createVolumeDiscountRule(
    productId: number,
    minQuantity: number,
    discountPercentage: number,
    maxQuantity?: number
  ): Promise<VolumeDiscountRule>;

  /**
   * Delete a volume discount rule
   */
  deleteVolumeDiscountRule(ruleId: number): Promise<void>;
}
