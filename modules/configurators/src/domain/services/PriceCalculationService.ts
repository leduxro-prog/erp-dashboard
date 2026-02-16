import { ConfigurationItem } from '../entities/ConfiguratorSession';

/**
 * Price Calculation Service
 *
 * Domain service for calculating configuration prices with volume discounts
 * and customer tier discounts.
 *
 * Pricing formula:
 * 1. Calculate component subtotals: quantity × unit_price
 * 2. Apply volume discounts (based on component quantities)
 * 3. Apply customer tier discount (from pricing module)
 * 4. Final total = (subtotal × (1 - volume_discount%)) × (1 - tier_discount%)
 *
 * @class PriceCalculationService
 */
export class PriceCalculationService {
  /**
   * Create a new PriceCalculationService
   */
  constructor() {}

  /**
   * Calculate configuration price with all discounts
   *
   * @param items - Configuration items with pricing
   * @param volumeDiscountPercent - Volume discount percentage (0-100)
   * @param tierDiscountPercent - Customer tier discount (0-100)
   * @returns Price breakdown
   */
  public calculate(
    items: ConfigurationItem[],
    volumeDiscountPercent: number = 0,
    tierDiscountPercent: number = 0
  ): {
    subtotal: number;
    volumeDiscount: number;
    tierDiscount: number;
    total: number;
    breakdown: Array<{
      itemId: string;
      componentType: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      discount: number;
      finalPrice: number;
    }>;
  } {
    // Validate discounts
    const validVolume = Math.max(0, Math.min(100, volumeDiscountPercent));
    const validTier = Math.max(0, Math.min(100, tierDiscountPercent));

    // Calculate component-level breakdown
    const breakdown = items.map((item) => {
      const itemSubtotal = item.subtotal;
      const itemVolumeDiscount = itemSubtotal * (validVolume / 100);
      const afterVolume = itemSubtotal - itemVolumeDiscount;
      const itemTierDiscount = afterVolume * (validTier / 100);
      const finalPrice = afterVolume - itemTierDiscount;

      return {
        itemId: item.id,
        componentType: item.componentType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: this._round(itemSubtotal),
        discount: this._round(itemVolumeDiscount + itemTierDiscount),
        finalPrice: this._round(finalPrice),
      };
    });

    // Calculate totals
    const subtotal = this._round(breakdown.reduce((sum, b) => sum + b.subtotal, 0));
    const totalDiscount = this._round(breakdown.reduce((sum, b) => sum + b.discount, 0));
    const total = this._round(breakdown.reduce((sum, b) => sum + b.finalPrice, 0));

    // Calculate discount amounts
    const volumeDiscount = this._round(subtotal * (validVolume / 100));
    const tierDiscount = this._round((subtotal - volumeDiscount) * (validTier / 100));

    return {
      subtotal,
      volumeDiscount,
      tierDiscount,
      total,
      breakdown,
    };
  }

  /**
   * Calculate volume discount percentage based on total quantity
   *
   * Volume tiers (example):
   * - 1-10 items: 0%
   * - 11-25 items: 5%
   * - 26-50 items: 10%
   * - 51+ items: 15%
   *
   * @param totalQuantity - Total quantity across all items
   * @returns Discount percentage
   */
  public calculateVolumeDiscount(totalQuantity: number): number {
    if (totalQuantity <= 10) {
      return 0;
    }
    if (totalQuantity <= 25) {
      return 5;
    }
    if (totalQuantity <= 50) {
      return 10;
    }
    return 15;
  }

  /**
   * Round price to 2 decimal places
   *
   * @private
   * @param value - Value to round
   * @returns Rounded value
   */
  private _round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
