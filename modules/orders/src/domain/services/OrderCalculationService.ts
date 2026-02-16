/**
 * Order Calculation Service
 * Pure calculation service for order totals and line items
 * No side effects, stateless, deterministic
 */
import { OrderItem } from '../entities/OrderItem';

export interface OrderTotalsResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  shippingCost: number;
  grandTotal: number;
}

export class OrderCalculationService {
  private static readonly TAX_RATE = 0.21; // 19% VAT for Romania

  /**
   * Calculate complete order totals
   */
  static calculateOrderTotals(
    items: OrderItem[],
    discountAmount: number = 0,
    shippingCost: number = 0,
    taxRate: number = this.TAX_RATE
  ): OrderTotalsResult {
    // Validate inputs
    if (!items || items.length === 0) {
      throw new Error('At least one item is required to calculate totals');
    }

    if (discountAmount < 0) {
      throw new Error('Discount amount cannot be negative');
    }

    if (shippingCost < 0) {
      throw new Error('Shipping cost cannot be negative');
    }

    if (taxRate < 0 || taxRate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + this.calculateLineTotal(item.quantity, item.unitPrice),
      0
    );

    // Calculate taxable amount
    const taxableAmount = Math.max(0, subtotal - discountAmount);

    // Calculate tax amount
    const taxAmount = this.roundToTwoDecimals(taxableAmount * taxRate);

    // Calculate grand total
    const grandTotal = this.roundToTwoDecimals(
      subtotal - discountAmount + shippingCost + taxAmount
    );

    return {
      subtotal: this.roundToTwoDecimals(subtotal),
      discountAmount: this.roundToTwoDecimals(discountAmount),
      taxableAmount: this.roundToTwoDecimals(taxableAmount),
      taxAmount,
      shippingCost: this.roundToTwoDecimals(shippingCost),
      grandTotal,
    };
  }

  /**
   * Calculate individual line item total
   */
  static calculateLineTotal(quantity: number, unitPrice: number): number {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    if (unitPrice < 0) {
      throw new Error('Unit price cannot be negative');
    }

    const lineTotal = quantity * unitPrice;
    return this.roundToTwoDecimals(lineTotal);
  }

  /**
   * Calculate tax amount for a given amount
   */
  static calculateTaxAmount(
    amount: number,
    taxRate: number = this.TAX_RATE
  ): number {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (taxRate < 0 || taxRate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }

    return this.roundToTwoDecimals(amount * taxRate);
  }

  /**
   * Calculate discount percentage
   */
  static calculateDiscountPercentage(
    original: number,
    discounted: number
  ): number {
    if (original <= 0) {
      throw new Error('Original amount must be greater than 0');
    }

    if (discounted < 0 || discounted > original) {
      throw new Error('Discounted amount must be between 0 and original amount');
    }

    const percentage = ((original - discounted) / original) * 100;
    return this.roundToTwoDecimals(percentage);
  }

  /**
   * Helper: Round to 2 decimal places (currency)
   */
  private static roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate delivery summary
   */
  static calculateDeliverySummary(items: OrderItem[]): {
    totalQuantity: number;
    deliveredQuantity: number;
    remainingQuantity: number;
    deliveryPercentage: number;
    fullyDelivered: boolean;
    partiallyDelivered: boolean;
  } {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const deliveredQuantity = items.reduce(
      (sum, item) => sum + item.quantityDelivered,
      0
    );
    const remainingQuantity = totalQuantity - deliveredQuantity;
    const deliveryPercentage =
      totalQuantity > 0
        ? this.roundToTwoDecimals((deliveredQuantity / totalQuantity) * 100)
        : 0;
    const fullyDelivered = remainingQuantity === 0;
    const partiallyDelivered = deliveredQuantity > 0 && !fullyDelivered;

    return {
      totalQuantity,
      deliveredQuantity,
      remainingQuantity,
      deliveryPercentage,
      fullyDelivered,
      partiallyDelivered,
    };
  }
}
