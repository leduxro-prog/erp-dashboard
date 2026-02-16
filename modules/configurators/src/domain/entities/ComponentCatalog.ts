/**
 * ComponentCatalog Domain Entity
 *
 * Represents an available component that can be added to a configurator session.
 * Maintains pricing, specifications, availability constraints, and metadata
 * for components used in Magnetic Track and LED Strip configurations.
 *
 * @class ComponentCatalog
 */
export class ComponentCatalog {
  /** Unique catalog entry ID */
  public id: string;

  /** Configurator type this component belongs to */
  public configuratorType: 'MAGNETIC_TRACK' | 'LED_STRIP';

  /** Component type (e.g., TRACK_2M, SPOT_LED, LED_STRIP_5M) */
  public componentType: string;

  /** Human-readable component name */
  public name: string;

  /** Product SKU */
  public sku: string;

  /** Base unit price in RON */
  public basePrice: number;

  /** Component specifications (JSON) */
  public specifications: Record<string, unknown>;

  /** Maximum quantity allowed per configuration */
  public maxPerConfig: number;

  /** Whether component is available for new configurations */
  public isActive: boolean;

  /** Display sort order in UI */
  public sortOrder: number;

  /** Creation timestamp */
  public createdAt: Date;

  /** Last update timestamp */
  public updatedAt: Date;

  /**
   * Create a new ComponentCatalog entry
   *
   * @param configuratorType - Type of configurator
   * @param componentType - Component type identifier
   * @param name - Display name
   * @param sku - Product SKU
   * @param basePrice - Base price in RON
   */
  constructor(
    configuratorType: 'MAGNETIC_TRACK' | 'LED_STRIP',
    componentType: string,
    name: string,
    sku: string,
    basePrice: number
  ) {
    this.id = this._generateId();
    this.configuratorType = configuratorType;
    this.componentType = componentType;
    this.name = name;
    this.sku = sku;
    this.basePrice = basePrice;
    this.specifications = {};
    this.maxPerConfig = 999; // Default unlimited
    this.isActive = true;
    this.sortOrder = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Check if component is available for a specific configurator type
   *
   * @param configuratorType - Type to check
   * @returns true if available
   */
  public isAvailableForConfig(configuratorType: 'MAGNETIC_TRACK' | 'LED_STRIP'): boolean {
    return this.isActive && this.configuratorType === configuratorType;
  }

  /**
   * Get price for specified quantity (with volume pricing support)
   *
   * @param quantity - Quantity to price
   * @returns Price in RON
   */
  public getPrice(quantity: number): number {
    if (quantity <= 0) {
      return 0;
    }

    // Volume pricing can be added here
    // For now, linear pricing based on basePrice
    return Math.round(this.basePrice * quantity * 100) / 100;
  }

  /**
   * Set component specifications
   *
   * @param specs - Specification object
   */
  public setSpecifications(specs: Record<string, unknown>): void {
    this.specifications = specs;
    this.updatedAt = new Date();
  }

  /**
   * Update component pricing
   *
   * @param newPrice - New price in RON
   * @throws {Error} If price is negative
   */
  public updatePrice(newPrice: number): void {
    if (newPrice < 0) {
      throw new Error('Price cannot be negative');
    }
    this.basePrice = newPrice;
    this.updatedAt = new Date();
  }

  /**
   * Set component as active or inactive
   *
   * @param active - Active status
   */
  public setActive(active: boolean): void {
    this.isActive = active;
    this.updatedAt = new Date();
  }

  /**
   * Set maximum quantity allowed per configuration
   *
   * @param max - Maximum quantity
   * @throws {Error} If max is not positive
   */
  public setMaxPerConfig(max: number): void {
    if (max <= 0) {
      throw new Error('Max per config must be positive');
    }
    this.maxPerConfig = max;
    this.updatedAt = new Date();
  }

  /**
   * Generate unique catalog ID
   *
   * @private
   * @returns ID string
   */
  private _generateId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
