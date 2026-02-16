/**
 * Promotion Entity - Value Object for temporary promotional pricing
 *
 * Represents a time-limited promotional discount on a product.
 * Promotions can override normal pricing when active.
 */
export class Promotion {
  private readonly _id: string;
  private readonly _productId: number;
  private readonly _promotionalPrice: number;
  private readonly _originalPrice: number;
  private readonly _validFrom: Date;
  private readonly _validUntil: Date;
  private readonly _reason: string;
  private readonly _isActive: boolean;

  private static readonly PRICE_PRECISION = 0.01;

  /**
   * Creates a Promotion entity with validation
   *
   * @param id - Unique promotion identifier
   * @param productId - The product this promotion applies to
   * @param promotionalPrice - The discounted price (must be < originalPrice)
   * @param originalPrice - The original price before promotion
   * @param validFrom - Start date of promotion
   * @param validUntil - End date of promotion (must be > validFrom)
   * @param reason - Description of the promotion
   * @param isActive - Whether the promotion is enabled
   *
   * @throws Error if prices or dates are invalid
   */
  constructor(
    id: string,
    productId: number,
    promotionalPrice: number,
    originalPrice: number,
    validFrom: Date,
    validUntil: Date,
    reason: string,
    isActive: boolean = true,
  ) {
    this.validatePrices(promotionalPrice, originalPrice);
    this.validateDates(validFrom, validUntil);

    this._id = id;
    this._productId = productId;
    this._promotionalPrice = this.roundToPrecision(promotionalPrice);
    this._originalPrice = this.roundToPrecision(originalPrice);
    this._validFrom = validFrom;
    this._validUntil = validUntil;
    this._reason = reason;
    this._isActive = isActive;
  }

  /**
   * Gets the promotion ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the product ID
   */
  get productId(): number {
    return this._productId;
  }

  /**
   * Gets the promotional (discounted) price
   */
  get promotionalPrice(): number {
    return this._promotionalPrice;
  }

  /**
   * Gets the original price before promotion
   */
  get originalPrice(): number {
    return this._originalPrice;
  }

  /**
   * Gets the promotion start date
   */
  get validFrom(): Date {
    return this._validFrom;
  }

  /**
   * Gets the promotion end date
   */
  get validUntil(): Date {
    return this._validUntil;
  }

  /**
   * Gets the promotion reason/description
   */
  get reason(): string {
    return this._reason;
  }

  /**
   * Gets the active flag
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Determines if the promotion is currently active
   *
   * A promotion is active if:
   * - isActive flag is true
   * - Current date is >= validFrom AND <= validUntil
   *
   * @param currentDate - The date to check against (defaults to now)
   * @returns true if promotion is currently active, false otherwise
   */
  isCurrentlyActive(currentDate: Date = new Date()): boolean {
    if (!this._isActive) {
      return false;
    }

    return currentDate >= this._validFrom && currentDate <= this._validUntil;
  }

  /**
   * Calculates the discount percentage this promotion provides
   *
   * Formula: discountPercentage = ((originalPrice - promotionalPrice) / originalPrice) * 100
   *
   * @returns The discount percentage
   */
  getDiscountPercentage(): number {
    const discountAmount = this._originalPrice - this._promotionalPrice;
    const discountPercentage = (discountAmount / this._originalPrice) * 100;
    return this.roundToPrecision(discountPercentage);
  }

  /**
   * Calculates the discount amount in currency units
   *
   * @returns The discount amount
   */
  getDiscountAmount(): number {
    const discountAmount = this._originalPrice - this._promotionalPrice;
    return this.roundToPrecision(discountAmount);
  }

  /**
   * Gets a human-readable description of the promotion
   *
   * @returns A formatted string describing the promotion
   */
  getDescription(): string {
    const discountPercent = this.getDiscountPercentage().toFixed(2);
    const discountAmount = this.getDiscountAmount().toFixed(2);
    const fromDate = this._validFrom.toLocaleDateString('en-US');
    const toDate = this._validUntil.toLocaleDateString('en-US');

    return `${this._reason}: ${discountPercent}% off (${discountAmount} RON), valid ${fromDate} - ${toDate}`;
  }

  /**
   * Validates that promotional price is less than original price
   *
   * @private
   * @throws Error if promotionalPrice >= originalPrice
   */
  private validatePrices(promotionalPrice: number, originalPrice: number): void {
    if (promotionalPrice >= originalPrice) {
      throw new Error(
        `Promotion: promotionalPrice (${promotionalPrice}) must be less than originalPrice (${originalPrice})`,
      );
    }
  }

  /**
   * Validates that date range is valid
   *
   * @private
   * @throws Error if validUntil <= validFrom
   */
  private validateDates(validFrom: Date, validUntil: Date): void {
    if (validUntil <= validFrom) {
      throw new Error(
        `Promotion: validUntil must be after validFrom (from: ${validFrom.toISOString()}, until: ${validUntil.toISOString()})`,
      );
    }
  }

  /**
   * Rounds a number to 2 decimal places for currency precision
   *
   * @private
   */
  private roundToPrecision(value: number): number {
    return Math.round(value / Promotion.PRICE_PRECISION) * Promotion.PRICE_PRECISION;
  }
}
