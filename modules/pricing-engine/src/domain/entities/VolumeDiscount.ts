/**
 * VolumeDiscount Entity - Value Object for volume-based discount rules
 *
 * Represents a discount rule that applies based on quantity ordered or total value.
 * Multiple rules can be defined and the highest applicable discount will be used.
 */
export class VolumeDiscount {
  private readonly _minQuantity: number;
  private readonly _maxQuantity: number | null;
  private readonly _minTotalValue: number | null;
  private readonly _maxTotalValue: number | null;
  private readonly _discountPercentage: number;

  private static readonly DISCOUNT_PRECISION = 0.01;

  /**
   * Creates a VolumeDiscount rule with validation
   *
   * @param minQuantity - Minimum quantity to trigger this discount (must be > 0)
   * @param discountPercentage - Discount percentage (0-100)
   * @param maxQuantity - Optional maximum quantity for this rule
   * @param minTotalValue - Optional minimum total value to trigger discount
   * @param maxTotalValue - Optional maximum total value for this rule
   *
   * @throws Error if parameters are invalid
   */
  constructor(
    minQuantity: number,
    discountPercentage: number,
    maxQuantity: number | null = null,
    minTotalValue: number | null = null,
    maxTotalValue: number | null = null,
  ) {
    this.validateMinQuantity(minQuantity);
    this.validateDiscountPercentage(discountPercentage);
    this.validateQuantityRange(minQuantity, maxQuantity);
    this.validateValueRange(minTotalValue, maxTotalValue);

    this._minQuantity = minQuantity;
    this._maxQuantity = maxQuantity;
    this._minTotalValue = minTotalValue;
    this._maxTotalValue = maxTotalValue;
    this._discountPercentage = this.roundToPrecision(discountPercentage);
  }

  /**
   * Gets the minimum quantity
   */
  get minQuantity(): number {
    return this._minQuantity;
  }

  /**
   * Gets the maximum quantity (null if unlimited)
   */
  get maxQuantity(): number | null {
    return this._maxQuantity;
  }

  /**
   * Gets the minimum total value (null if no minimum)
   */
  get minTotalValue(): number | null {
    return this._minTotalValue;
  }

  /**
   * Gets the maximum total value (null if unlimited)
   */
  get maxTotalValue(): number | null {
    return this._maxTotalValue;
  }

  /**
   * Gets the discount percentage
   */
  get discountPercentage(): number {
    return this._discountPercentage;
  }

  /**
   * Determines if this discount rule is applicable for the given quantity and total value
   *
   * A rule is applicable if:
   * - Quantity is >= minQuantity AND <= maxQuantity (if set)
   * - Total value is >= minTotalValue (if set) AND <= maxTotalValue (if set)
   *
   * @param quantity - The ordered quantity
   * @param totalValue - The total order value (before discount)
   * @returns true if this rule applies, false otherwise
   */
  isApplicable(quantity: number, totalValue: number): boolean {
    // Check quantity constraints
    if (quantity < this._minQuantity) {
      return false;
    }

    if (this._maxQuantity !== null && quantity > this._maxQuantity) {
      return false;
    }

    // Check value constraints
    if (this._minTotalValue !== null && totalValue < this._minTotalValue) {
      return false;
    }

    if (this._maxTotalValue !== null && totalValue > this._maxTotalValue) {
      return false;
    }

    return true;
  }

  /**
   * Calculates the discount amount for the given subtotal
   *
   * Formula: discountAmount = subtotal * (discountPercentage / 100)
   *
   * @param subtotal - The subtotal before discount
   * @returns The discount amount
   */
  calculateDiscount(subtotal: number): number {
    const discount = subtotal * (this._discountPercentage / 100);
    return this.roundToPrecision(discount);
  }

  /**
   * Calculates the price after applying the discount
   *
   * @param subtotal - The subtotal before discount
   * @returns The price after discount
   */
  calculateDiscountedPrice(subtotal: number): number {
    return this.roundToPrecision(subtotal - this.calculateDiscount(subtotal));
  }

  /**
   * Gets a human-readable description of this rule
   *
   * @returns A string describing the discount rule
   */
  getDescription(): string {
    const parts: string[] = [];

    if (this._maxQuantity !== null) {
      parts.push(`${this._minQuantity}-${this._maxQuantity} units`);
    } else {
      parts.push(`${this._minQuantity}+ units`);
    }

    if (this._minTotalValue !== null) {
      if (this._maxTotalValue !== null) {
        parts.push(`${this._minTotalValue}-${this._maxTotalValue} RON`);
      } else {
        parts.push(`${this._minTotalValue}+ RON`);
      }
    }

    return `${parts.join(' OR ')} = ${this._discountPercentage}% discount`;
  }

  /**
   * Validates that minQuantity is positive
   *
   * @private
   * @throws Error if minQuantity <= 0
   */
  private validateMinQuantity(minQuantity: number): void {
    if (minQuantity <= 0) {
      throw new Error('VolumeDiscount: minQuantity must be greater than 0');
    }
  }

  /**
   * Validates that discount percentage is valid (0-100)
   *
   * @private
   * @throws Error if discountPercentage is outside valid range
   */
  private validateDiscountPercentage(discountPercentage: number): void {
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new Error(
        `VolumeDiscount: discountPercentage must be between 0 and 100 (got ${discountPercentage})`,
      );
    }
  }

  /**
   * Validates that quantity range is valid
   *
   * @private
   * @throws Error if maxQuantity < minQuantity
   */
  private validateQuantityRange(minQuantity: number, maxQuantity: number | null): void {
    if (maxQuantity !== null && maxQuantity < minQuantity) {
      throw new Error(
        `VolumeDiscount: maxQuantity (${maxQuantity}) cannot be less than minQuantity (${minQuantity})`,
      );
    }
  }

  /**
   * Validates that value range is valid
   *
   * @private
   * @throws Error if maxTotalValue < minTotalValue
   */
  private validateValueRange(minTotalValue: number | null, maxTotalValue: number | null): void {
    if (
      minTotalValue !== null &&
      maxTotalValue !== null &&
      maxTotalValue < minTotalValue
    ) {
      throw new Error(
        `VolumeDiscount: maxTotalValue (${maxTotalValue}) cannot be less than minTotalValue (${minTotalValue})`,
      );
    }
  }

  /**
   * Rounds a number to 2 decimal places for currency precision
   *
   * @private
   */
  private roundToPrecision(value: number): number {
    return Math.round(value / VolumeDiscount.DISCOUNT_PRECISION) * VolumeDiscount.DISCOUNT_PRECISION;
  }
}
