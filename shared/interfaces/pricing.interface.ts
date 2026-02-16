import {
  PriceResult,
  DiscountResult,
  PromotionalPrice,
  CartItem,
} from '../types';

/**
 * Pricing information for tiered pricing structure.
 * Defines quantity-based pricing tiers for a product.
 * Used for volume discounting and bulk pricing scenarios.
 *
 * @example
 * {
 *   productId: 123,
 *   tiers: [
 *     { minQuantity: 1, maxQuantity: 9, price: 100 },
 *     { minQuantity: 10, maxQuantity: 49, price: 90 },
 *     { minQuantity: 50, maxQuantity: null, price: 80 },
 *   ],
 *   currency: 'RON',
 *   lastUpdated: '2025-02-07T10:30:00Z'
 * }
 */
export interface TierPricingInfo {
  /** Product identifier */
  productId: number;
  /** Array of price tiers sorted by minQuantity ascending */
  tiers: {
    /** Minimum quantity to qualify for this tier (inclusive) */
    minQuantity: number;
    /** Maximum quantity for this tier (inclusive), null = unlimited */
    maxQuantity: number | null;
    /** Unit price at this tier */
    price: number;
  }[];
  /** Currency code (e.g., 'RON', 'EUR') */
  currency: string;
  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Order price calculation result with itemized breakdown.
 * Provides complete pricing information including taxes and all discount types.
 *
 * @example
 * {
 *   subtotal: 5000,
 *   discounts: [
 *     { type: 'volume', amount: 250, description: 'Volume discount for 50+ items' },
 *     { type: 'promotional', amount: 100, description: 'Q1 2025 promotion' }
 *   ],
 *   taxes: 889.5,
 *   total: 5539.5,
 *   itemCount: 60,
 *   currency: 'RON'
 * }
 */
export interface OrderPriceCalculation {
  /** Sum of all line items before discounts and taxes */
  subtotal: number;
  /** Array of all applied discounts with breakdown */
  discounts: {
    /** Type of discount applied */
    type: 'volume' | 'promotional' | 'custom';
    /** Discount amount in base currency */
    amount: number;
    /** Human-readable discount description */
    description: string;
  }[];
  /** Total taxes calculated on subtotal after discounts */
  taxes: number;
  /** Final total: subtotal - discounts + taxes */
  total: number;
  /** Total number of items in order */
  itemCount: number;
  /** Currency code */
  currency: string;
}

/**
 * Pricing service interface for calculating prices and applying discounts.
 * Handles all price-related business logic including volume discounts,
 * tier-based pricing, promotions, and tax calculations.
 *
 * @example
 * const service = container.get(IPricingService);
 * const price = await service.calculatePrice(productId, customerId);
 * const total = await service.calculateOrderTotal(cartItems, customerId);
 */
export interface IPricingService {
  /**
   * Calculate price for a product with optional customer-specific pricing.
   * Applies customer tier, volume discounts, and active promotions.
   *
   * @param productId - Product ID to calculate price for
   * @param customerId - Optional customer ID for customer-specific pricing rules
   * @returns Price result with base and effective price after all discounts
   * @throws {NotFoundError} If product not found
   */
  calculatePrice(productId: number, customerId?: number): Promise<PriceResult>;

  /**
   * Get list price for a product (base price, no discounts).
   *
   * @param productId - Product ID
   * @returns List price in base currency
   * @throws {NotFoundError} If product not found
   */
  getListPrice(productId: number): Promise<number>;

  /**
   * Apply volume discount to cart items.
   * Calculates appropriate volume discount tier for given quantities.
   *
   * @param items - Array of cart items with quantities
   * @returns Discount result with applied discounts per item
   * @throws {ValidationError} If items array is empty or invalid
   */
  applyVolumeDiscount(items: CartItem[]): Promise<DiscountResult>;

  /**
   * Get active promotional prices for a product.
   * Returns all current promotions matching the product's active date range.
   *
   * @param productId - Product ID
   * @returns Array of active promotional prices (empty if no promotions)
   * @throws {NotFoundError} If product not found
   */
  getActivePromotions(productId: number): Promise<PromotionalPrice[]>;

  /**
   * Calculate complete order total with all discounts and taxes.
   * Applies volume discounts, customer tier discounts, promotions, and taxes.
   * Primary method for order pricing.
   *
   * @param items - Array of cart items to calculate total for
   * @param customerId - Optional customer ID for customer-specific pricing
   * @returns Complete order price calculation with itemized breakdown
   * @throws {ValidationError} If items array is empty
   * @throws {NotFoundError} If any product not found
   */
  calculateOrderTotal(
    items: CartItem[],
    customerId?: number,
  ): Promise<OrderPriceCalculation>;

  /**
   * Get tiered pricing information for a product.
   * Returns quantity-based pricing tiers for volume discount structure.
   *
   * @param productId - Product ID
   * @returns Tiered pricing information with all quantity ranges
   * @throws {NotFoundError} If product not found
   */
  getTierPricing(productId: number): Promise<TierPricingInfo>;
}
