/**
 * CalculateOrderPricing Use Case
 * Calculates the complete order total with all discounts and VAT
 */

import {
  OrderPricingResult,
  LineItemResult,
} from '../dtos/pricing.dtos';
import {
  ProductNotFoundError,
  PricingError,
} from '../errors/pricing.errors';
import { IPriceRepository } from '../ports/IPriceRepository';
import { ITierRepository } from '../ports/ITierRepository';

const VAT_RATE_ROMANIA = 0.21;

/**
 * Item structure for order pricing calculation
 */
export interface OrderItem {
  productId: number;
  quantity: number;
}

/**
 * Use case for calculating the complete order pricing with VAT
 */
export class CalculateOrderPricing {
  constructor(
    private priceRepository: IPriceRepository,
    private tierRepository: ITierRepository
  ) {}

  /**
   * Execute the order pricing calculation
   * @param items - Array of products and quantities
   * @param customerId - Optional customer ID for tier-based discounts
   * @returns Complete order breakdown with VAT and grand total
   * @throws ProductNotFoundError if any product not found
   * @throws PricingError if calculation fails
   */
  async execute(
    items: OrderItem[],
    customerId?: number
  ): Promise<OrderPricingResult> {
    if (!items || items.length === 0) {
      throw new PricingError('Order must contain at least one item');
    }

    // Step 1: Batch-fetch all product prices
    const productIds = [...new Set(items.map((item) => item.productId))];
    const productPrices =
      await this.priceRepository.getProductPricesByIds(productIds);

    const priceMap = new Map(
      productPrices.map((p) => [p.productId, p])
    );

    // Validate all products exist
    for (const productId of productIds) {
      if (!priceMap.has(productId)) {
        throw new ProductNotFoundError(productId);
      }
    }

    // Step 2: Get customer tier if customerId provided
    let customerTierDiscount = 0;
    if (customerId) {
      const customerTier = await this.tierRepository.getCustomerTier(
        customerId
      );
      if (customerTier) {
        customerTierDiscount = customerTier.discountPercentage;
      }
    }

    // Step 3: Get all active promotions for the order products
    const promotionsByProduct = new Map<number, any>();
    for (const productId of productIds) {
      const promotions =
        await this.priceRepository.getActivePromotionsForProduct(productId);
      if (promotions && promotions.length > 0) {
        promotionsByProduct.set(productId, promotions[0]);
      }
    }

    // Step 4: Get volume discount rules for all products
    const volumeDiscountsByProduct = new Map<number, any>();
    for (const item of items) {
      const volumeRule =
        await this.priceRepository.getVolumeDiscountRuleForQuantity(
          item.productId,
          item.quantity
        );
      if (volumeRule) {
        volumeDiscountsByProduct.set(item.productId, volumeRule);
      }
    }

    // Step 5: Calculate each line item
    const lineItems: LineItemResult[] = [];
    let subtotal = 0;
    let totalTierDiscount = 0;
    let totalPromotionalDiscount = 0;
    let totalVolumeDiscount = 0;

    for (const item of items) {
      const productPrice = priceMap.get(item.productId)!;
      const basePrice = productPrice.price;
      const lineSubtotal = basePrice * item.quantity;

      // Calculate tier discount for this line item
      const lineTierDiscount = basePrice * customerTierDiscount * item.quantity;

      // Calculate promotional discount for this line item
      let linePromotionalDiscount = 0;
      const promotion = promotionsByProduct.get(item.productId);
      if (promotion) {
        linePromotionalDiscount = Math.max(
          0,
          (basePrice - promotion.promotionalPrice) * item.quantity
        );
      }

      // Calculate volume discount for this line item
      let lineVolumeDiscount = 0;
      const volumeRule = volumeDiscountsByProduct.get(item.productId);
      if (volumeRule) {
        // Apply volume discount on price after tier discount
        const priceAfterTier = Math.max(
          0,
          basePrice - basePrice * customerTierDiscount
        );
        lineVolumeDiscount = priceAfterTier * volumeRule.discountPercentage * item.quantity;
      }

      const totalLineDiscount =
        lineTierDiscount + linePromotionalDiscount + lineVolumeDiscount;
      const subtotalAfterDiscount = lineSubtotal - totalLineDiscount;

      lineItems.push({
        productId: item.productId,
        quantity: item.quantity,
        basePrice,
        tierDiscountAmount: lineTierDiscount,
        promotionalDiscountAmount: linePromotionalDiscount,
        volumeDiscountAmount: lineVolumeDiscount,
        totalDiscountAmount: totalLineDiscount,
        subtotalAfterDiscount,
        currency: 'RON',
      });

      subtotal += lineSubtotal;
      totalTierDiscount += lineTierDiscount;
      totalPromotionalDiscount += linePromotionalDiscount;
      totalVolumeDiscount += lineVolumeDiscount;
    }

    // Step 6: Apply order-level volume discounts based on total
    // (This is in addition to per-line-item volume discounts)
    let orderLevelVolumeDiscount = 0;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const orderVolumeRule =
      await this.priceRepository.getVolumeDiscountRuleForQuantity(
        -1, // Use -1 to indicate order-level query, or implement separate method
        totalQuantity
      );
    if (orderVolumeRule && orderVolumeRule.minQuantity <= totalQuantity) {
      // Apply to subtotal after item-level discounts
      const subtotalAfterItemDiscounts =
        subtotal - totalTierDiscount - totalPromotionalDiscount;
      orderLevelVolumeDiscount =
        subtotalAfterItemDiscounts * orderVolumeRule.discountPercentage;
    }

    const totalDiscount =
      totalTierDiscount +
      totalPromotionalDiscount +
      totalVolumeDiscount +
      orderLevelVolumeDiscount;
    const subtotalAfterDiscounts = subtotal - totalDiscount;
    const discountPercentage = subtotal > 0 ? totalDiscount / subtotal : 0;

    // Step 7: Calculate VAT (19% for Romania)
    const taxAmount = subtotalAfterDiscounts * VAT_RATE_ROMANIA;
    const grandTotal = subtotalAfterDiscounts + taxAmount;

    return {
      lineItems,
      subtotal,
      tierDiscount: totalTierDiscount,
      volumeDiscount: totalVolumeDiscount + orderLevelVolumeDiscount,
      promotionalDiscount: totalPromotionalDiscount,
      totalDiscount,
      discountPercentage,
      subtotalAfterDiscounts,
      taxRate: VAT_RATE_ROMANIA,
      taxAmount,
      grandTotal,
      currency: 'RON',
    };
  }
}
