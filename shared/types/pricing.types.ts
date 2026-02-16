/**
 * Pricing and discount management types
 */

import { BaseEntity, Currency } from './common.types';

/**
 * Price rule for dynamic pricing
 */
export interface PriceRule extends BaseEntity {
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string | null;
  /** Whether rule is active */
  isActive: boolean;
  /** Rule type (customer_tier, volume, promotional, seasonal) */
  ruleType: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Rule conditions JSON */
  conditions?: Record<string, unknown> | null;
  /** Applied discount percentage */
  discountPercentage: number;
  /** Applied discount amount (fixed) */
  discountAmount: number;
  /** Start date for rule */
  startDate: Date;
  /** End date for rule */
  endDate: Date;
  /** Customer IDs this rule applies to (comma-separated) */
  applicableCustomers?: string | null;
  /** Product IDs this rule applies to (comma-separated) */
  applicableProducts?: string | null;
  /** Category IDs this rule applies to (comma-separated) */
  applicableCategories?: string | null;
  /** Minimum order amount to trigger rule */
  minimumOrderAmount: number;
  /** Minimum quantity to trigger rule */
  minimumQuantity: number;
  /** Maximum discount amount per order */
  maxDiscountAmount?: number | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Volume-based discount tiers
 */
export interface VolumeDiscount extends BaseEntity {
  /** Product ID (null = all products) */
  productId?: number | null;
  /** Category ID (null = all categories) */
  categoryId?: number | null;
  /** Customer type (B2B, B2C, or null = all) */
  customerType?: string | null;
  /** Minimum quantity for discount tier */
  minQuantity: number;
  /** Maximum quantity for discount tier */
  maxQuantity?: number | null;
  /** Discount percentage */
  discountPercentage: number;
  /** Fixed discount amount */
  discountAmount: number;
  /** Whether discount is active */
  isActive: boolean;
  /** Valid from date */
  validFrom: Date;
  /** Valid until date */
  validUntil: Date;
}

/**
 * Promotional pricing
 */
export interface PromotionalPrice extends BaseEntity {
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Promotion name */
  promotionName: string;
  /** Promotional price (without VAT) */
  promotionalPrice: number;
  /** Regular price (before promotion) */
  regularPrice: number;
  /** Discount percentage */
  discountPercentage: number;
  /** Promotion start date */
  startDate: Date;
  /** Promotion end date */
  endDate: Date;
  /** Whether promotion is active */
  isActive: boolean;
  /** Minimum quantity for promotion */
  minimumQuantity: number;
  /** Maximum units to sell at promotional price */
  maxUnitsToSell?: number | null;
  /** Units sold at promotional price */
  unitsSold: number;
  /** Featured in banner/homepage */
  featured: boolean;
  /** Promotion conditions/notes */
  conditions?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Customer-specific pricing
 */
export interface CustomerPrice extends BaseEntity {
  /** Customer ID */
  customerId: number;
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Custom price for this customer */
  customPrice: number;
  /** Discount percentage vs base price */
  discountPercentage: number;
  /** Valid from date */
  validFrom: Date;
  /** Valid until date */
  validUntil?: Date | null;
  /** Whether price is active */
  isActive: boolean;
  /** Minimum order quantity for this price */
  minimumQuantity: number;
  /** Reason for custom price */
  reason?: string | null;
  /** Created by user ID */
  createdByUserId: number;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Price result with all applicable discounts
 */
export interface PriceResult {
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Base price (without VAT) */
  basePrice: number;
  /** Regular/list price */
  regularPrice: number;
  /** Applied discounts */
  discounts: DiscountResult[];
  /** Total discount amount */
  totalDiscountAmount: number;
  /** Total discount percentage */
  totalDiscountPercentage: number;
  /** Final price before VAT */
  finalPrice: number;
  /** VAT rate (19%) */
  vatRate: number;
  /** VAT amount */
  vat: number;
  /** Final price with VAT */
  finalPriceWithVat: number;
  /** Currency */
  currency: Currency;
  /** Applicable quantity for discount */
  quantity: number;
  /** Metadata about applied rules */
  appliedRules: Array<{
    ruleId: number;
    ruleName: string;
    discountPercentage: number;
    discountAmount: number;
  }>;
}

/**
 * Discount result details
 */
export interface DiscountResult {
  /** Discount type */
  type: 'volume' | 'promotional' | 'customer' | 'rule' | 'manual';
  /** Discount percentage */
  percentage: number;
  /** Discount amount */
  amount: number;
  /** Discount description/reason */
  reason?: string;
  /** Priority/order */
  priority: number;
}

/**
 * Shopping cart item with pricing
 */
export interface CartItem {
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Product name */
  productName: string;
  /** Quantity */
  quantity: number;
  /** Unit price (base) */
  unitPrice: number;
  /** Applied discount percentage */
  discountPercentage: number;
  /** Applied discount amount */
  discountAmount: number;
  /** Final unit price after discount */
  finalUnitPrice: number;
  /** VAT rate */
  vatRate: number;
  /** VAT per unit */
  vatPerUnit: number;
  /** Unit price with VAT */
  unitPriceWithVat: number;
  /** Line subtotal (without VAT) */
  subtotal: number;
  /** Line VAT */
  lineVat: number;
  /** Line total (with VAT) */
  lineTotal: number;
  /** Currency */
  currency: Currency;
  /** Configuration (if applicable) */
  configuration?: Record<string, unknown>;
  /** Product metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cart summary
 */
export interface CartSummary {
  /** Number of items */
  itemCount: number;
  /** Items list */
  items: CartItem[];
  /** Subtotal before discounts/VAT */
  subtotal: number;
  /** Total discount amount */
  totalDiscount: number;
  /** Total discount percentage */
  discountPercentage: number;
  /** Subtotal after discount */
  subtotalAfterDiscount: number;
  /** Total VAT */
  totalVat: number;
  /** Shipping cost */
  shippingCost: number;
  /** Grand total (including VAT and shipping) */
  grandTotal: number;
  /** Currency */
  currency: Currency;
  /** Applied coupon/promotion codes */
  appliedPromotions?: string[];
}

/**
 * Coupon/Promotional code
 */
export interface PromotionalCode extends BaseEntity {
  /** Coupon code */
  code: string;
  /** Coupon description */
  description?: string | null;
  /** Discount percentage */
  discountPercentage: number;
  /** Fixed discount amount */
  discountAmount: number;
  /** Maximum times code can be used */
  maxUses?: number | null;
  /** Number of times used */
  usedCount: number;
  /** Valid from date */
  validFrom: Date;
  /** Valid until date */
  validUntil: Date;
  /** Minimum order amount to use */
  minimumOrderAmount: number;
  /** Customer types (B2B, B2C, or null = all) */
  applicableCustomerTypes?: string | null;
  /** Product IDs (null = all) */
  applicableProductIds?: string | null;
  /** Whether code is active */
  isActive: boolean;
  /** One-time use per customer */
  oneTimePerCustomer: boolean;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * DTO for calculating price
 */
export interface CalculatePriceDTO {
  productId: number;
  quantity: number;
  customerId?: number;
  applyPromotionalCode?: string;
}

/**
 * DTO for price rule creation
 */
export interface CreatePriceRuleDTO {
  name: string;
  description?: string;
  ruleType: string;
  priority: number;
  discountPercentage: number;
  discountAmount: number;
  startDate: Date;
  endDate: Date;
  applicableCustomers?: string;
  applicableProducts?: string;
  applicableCategories?: string;
  minimumOrderAmount?: number;
  minimumQuantity?: number;
  maxDiscountAmount?: number;
}

/**
 * DTO for volume discount
 */
export interface CreateVolumeDiscountDTO {
  productId?: number;
  categoryId?: number;
  customerType?: string;
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
  discountAmount?: number;
  validFrom: Date;
  validUntil: Date;
}
