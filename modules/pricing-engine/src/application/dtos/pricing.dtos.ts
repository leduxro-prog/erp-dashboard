/**
 * Data Transfer Objects for Pricing Use Cases
 * These are flat, serializable types with no methods
 */

/**
 * Result of a single product price calculation
 */
export interface PriceCalculationResult {
  productId: number;
  quantity: number;
  basePrice: number;
  tierDiscount: number;
  tierDiscountPercentage: number;
  promotionalDiscount: number;
  promotionalPrice: number;
  volumeDiscount: number;
  volumeDiscountPercentage: number;
  totalDiscount: number;
  totalDiscountPercentage: number;
  finalPrice: number;
  currency: string;
  breakdownDetails: {
    appliedTierLevel?: string;
    appliedPromotion?: {
      promotionId: number;
      validFrom: Date;
      validUntil: Date;
      reason: string;
    };
    appliedVolumeDiscount?: {
      minQuantity: number;
      maxQuantity: number;
      discountPercentage: number;
    };
  };
}

/**
 * Single line item in an order
 */
export interface LineItemResult {
  productId: number;
  quantity: number;
  basePrice: number;
  tierDiscountAmount: number;
  promotionalDiscountAmount: number;
  volumeDiscountAmount: number;
  totalDiscountAmount: number;
  subtotalAfterDiscount: number;
  currency: string;
}

/**
 * Complete order pricing breakdown
 */
export interface OrderPricingResult {
  lineItems: LineItemResult[];
  subtotal: number;
  tierDiscount: number;
  volumeDiscount: number;
  promotionalDiscount: number;
  totalDiscount: number;
  discountPercentage: number;
  subtotalAfterDiscounts: number;
  taxRate: number; // 0.21 for Romania
  taxAmount: number;
  grandTotal: number;
  currency: string;
}

/**
 * DTO for creating a new promotion
 */
export interface CreatePromotionDTO {
  productId: number;
  promotionalPrice: number;
  validFrom: Date;
  validUntil: Date;
  reason: string;
}

/**
 * DTO for customer tier information
 */
export interface CustomerTierDTO {
  customerId: number;
  level: string;
  name: string;
  discountPercentage: number;
}

/**
 * DTO for tier-specific pricing display
 */
export interface TierPricingDTO {
  productId: number;
  basePrice: number;
  tiers: Array<{
    level: string;
    name: string;
    discountPercentage: number;
    price: number;
  }>;
  currency: string;
}
