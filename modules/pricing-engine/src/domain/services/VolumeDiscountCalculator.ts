export class VolumeDiscountCalculator {
  // Quantity-based discounts
  calculateVolumeDiscount(quantity: number): number {
    if (quantity >= 100) {
      return 8; // 8% for 100+ units
    }
    if (quantity >= 50) {
      return 5; // 5% for 50-99 units
    }
    if (quantity >= 10) {
      return 2; // 2% for 10-49 units
    }
    return 0; // No discount for less than 10 units
  }

  // Value-based discounts (in RON currency)
  calculateVolumeDiscountByValue(totalValue: number): number {
    if (totalValue >= 30000) {
      return 10; // 10% for 30000+ RON
    }
    if (totalValue >= 15000) {
      return 6; // 6% for 15000-29999 RON
    }
    if (totalValue >= 5000) {
      return 3; // 3% for 5000-14999 RON
    }
    return 0; // No discount below 5000 RON
  }

  // Get the higher of quantity or value-based discount
  getApplicableDiscount(quantity: number, totalValue: number): number {
    const quantityDiscount = this.calculateVolumeDiscount(quantity);
    const valueDiscount = this.calculateVolumeDiscountByValue(totalValue);
    return Math.max(quantityDiscount, valueDiscount);
  }
}
