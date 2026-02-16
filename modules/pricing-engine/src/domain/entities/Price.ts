export class Price {
  id: number;
  sku: string;
  basePrice: number;
  cost: number;
  marginPercentage: number;
  categoryId: number | null;

  constructor(
    id: number,
    sku: string,
    basePrice: number,
    cost: number,
    marginPercentage: number,
    categoryId: number | null = null,
  ) {
    this.id = id;
    this.sku = sku;
    this.basePrice = basePrice;
    this.cost = cost;
    this.marginPercentage = marginPercentage;
    this.categoryId = categoryId;
  }

  calculateFinalPrice(tierDiscount: number = 0): number {
    const priceAfterMargin = this.cost * (1 + this.marginPercentage / 100);
    const priceAfterTierDiscount = priceAfterMargin * (1 - tierDiscount / 100);
    return Math.round(priceAfterTierDiscount * 100) / 100; // Round to 2 decimal places
  }
}
