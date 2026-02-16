import { Price } from '../entities/Price';
import { InvalidMarginError } from '../errors/InvalidMarginError';

export class PriceCalculator {
  private readonly MIN_MARGIN = 30; // Minimum 30% margin required

  calculateFinalPrice(price: Price, tierDiscount: number = 0, usePromotionalPrice: boolean = false): number {
    const basePrice = usePromotionalPrice ? price.basePrice : price.cost * (1 + price.marginPercentage / 100);
    const priceAfterTierDiscount = basePrice * (1 - tierDiscount / 100);
    return Math.round(priceAfterTierDiscount * 100) / 100; // Round to 2 decimal places
  }

  applyVolumeDiscount(price: number, volumeDiscount: number): number {
    const priceAfterDiscount = price * (1 - volumeDiscount / 100);
    return Math.round(priceAfterDiscount * 100) / 100;
  }

  validateMargin(price: Price): void {
    if (price.marginPercentage < this.MIN_MARGIN) {
      throw new InvalidMarginError(
        `Product margin (${price.marginPercentage}%) must be at least ${this.MIN_MARGIN}%`,
      );
    }
  }
}
