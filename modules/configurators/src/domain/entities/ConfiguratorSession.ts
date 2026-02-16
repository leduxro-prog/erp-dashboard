import { v4 as uuidv4 } from 'uuid';

/**
 * ConfiguratorSession Domain Entity
 *
 * Represents an active product configuration session where a customer
 * builds a custom product setup (Magnetic Track System or LED Strip System).
 *
 * Session lifecycle:
 * - ACTIVE: Currently being configured (24-hour TTL)
 * - COMPLETED: Customer completed configuration and converted to quote/order
 * - EXPIRED: 24-hour TTL exceeded without completion
 * - ABANDONED: Customer explicitly abandoned the session
 *
 * @class ConfiguratorSession
 */
export class ConfiguratorSession {
  /** Unique session identifier (UUID) */
  public readonly id: string;

  /** Configurator type: MAGNETIC_TRACK or LED_STRIP */
  public type: 'MAGNETIC_TRACK' | 'LED_STRIP';

  /** Customer ID (optional for guest sessions) */
  public customerId?: number;

  /** Unique token for session URL sharing */
  public sessionToken: string;

  /** Current session status */
  public status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';

  /** Configuration items in the session */
  public items: Map<string, ConfigurationItem>;

  /** Total calculated price in RON */
  public totalPrice: number;

  /** Timestamp when configuration was last validated */
  public validatedAt?: Date;

  /** Session expiry timestamp (24 hours from creation) */
  public expiresAt: Date;

  /** Session creation timestamp */
  public createdAt: Date;

  /** Last update timestamp */
  public updatedAt: Date;

  /**
   * Create a new ConfiguratorSession
   *
   * @param type - Configurator type
   * @param customerId - Optional customer ID
   */
  constructor(type: 'MAGNETIC_TRACK' | 'LED_STRIP', customerId?: number) {
    this.id = uuidv4();
    this.type = type;
    this.customerId = customerId;
    this.sessionToken = this._generateToken();
    this.status = 'ACTIVE';
    this.items = new Map();
    this.totalPrice = 0;
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Add a configuration item to the session
   *
   * @param item - Configuration item to add
   * @throws {Error} If item is invalid
   */
  public addItem(item: ConfigurationItem): void {
    if (!item.id || !item.componentType || item.quantity <= 0) {
      throw new Error('Invalid configuration item');
    }
    this.items.set(item.id, item);
    this.updatedAt = new Date();
  }

  /**
   * Remove a configuration item from the session
   *
   * @param itemId - ID of item to remove
   * @returns true if item was removed, false if not found
   */
  public removeItem(itemId: string): boolean {
    const removed = this.items.delete(itemId);
    if (removed) {
      this.updatedAt = new Date();
    }
    return removed;
  }

  /**
   * Update an existing configuration item
   *
   * @param itemId - ID of item to update
   * @param updates - Partial item updates
   * @throws {Error} If item not found
   */
  public updateItem(itemId: string, updates: Partial<ConfigurationItem>): void {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    if (updates.quantity !== undefined && updates.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    Object.assign(item, updates);
    this.updatedAt = new Date();
  }

  /**
   * Run validation checks on the configuration
   *
   * Checks:
   * - At least one item is present
   * - All items are valid
   * - Session has not expired
   *
   * @returns true if configuration is valid
   */
  public validate(): boolean {
    if (this.isExpired()) {
      throw new Error('Session has expired');
    }

    if (this.items.size === 0) {
      throw new Error('Configuration must contain at least one item');
    }

    for (const item of this.items.values()) {
      if (!item.isValid()) {
        throw new Error(`Item ${item.id} is invalid`);
      }
    }

    this.validatedAt = new Date();
    return true;
  }

  /**
   * Calculate and update total price
   * Should be called after compatibility checks and price retrieval
   *
   * @param volumeDiscountPercent - Optional volume discount percentage (0-100)
   * @param tierDiscountPercent - Optional customer tier discount (0-100)
   */
  public calculateTotal(
    volumeDiscountPercent: number = 0,
    tierDiscountPercent: number = 0
  ): void {
    let subtotal = 0;

    for (const item of this.items.values()) {
      subtotal += item.subtotal;
    }

    // Apply volume discount first, then tier discount
    const afterVolume = subtotal * (1 - volumeDiscountPercent / 100);
    const afterTier = afterVolume * (1 - tierDiscountPercent / 100);

    this.totalPrice = Math.round(afterTier * 100) / 100;
    this.updatedAt = new Date();
  }

  /**
   * Mark configuration as completed
   *
   * @throws {Error} If configuration is invalid
   */
  public complete(): void {
    this.validate();
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  /**
   * Mark configuration as expired
   */
  public expire(): void {
    this.status = 'EXPIRED';
    this.updatedAt = new Date();
  }

  /**
   * Check if session has expired
   *
   * @returns true if current time exceeds expiresAt
   */
  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Convert completed session to quote format
   *
   * @returns Quote representation of configuration
   */
  public toQuote(): {
    configuratorType: string;
    sessionId: string;
    items: ConfigurationItem[];
    totalPrice: number;
    validatedAt: Date | undefined;
  } {
    return {
      configuratorType: this.type,
      sessionId: this.id,
      items: Array.from(this.items.values()),
      totalPrice: this.totalPrice,
      validatedAt: this.validatedAt,
    };
  }

  /**
   * Get all items as an array (ordered by position)
   *
   * @returns Array of configuration items
   */
  public getItems(): ConfigurationItem[] {
    return Array.from(this.items.values()).sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      return posA - posB;
    });
  }

  /**
   * Generate a unique session token for sharing
   *
   * @private
   * @returns UUID token
   */
  private _generateToken(): string {
    return uuidv4();
  }
}

/**
 * ConfigurationItem Domain Entity
 *
 * Represents a single item/component in a configuration session.
 *
 * @class ConfigurationItem
 */
export class ConfigurationItem {
  /** Unique item ID */
  public id: string;

  /** Session ID this item belongs to */
  public sessionId: string;

  /** Product ID for this component */
  public productId: number;

  /** Component type (TRACK_2M, SPOT_LED, CONNECTOR_L, LED_STRIP_5M, etc.) */
  public componentType: string;

  /** Quantity of this component */
  public quantity: number;

  /** Unit price in RON */
  public unitPrice: number;

  /** Total price (quantity * unitPrice) */
  public subtotal: number;

  /** Position/order in the configuration */
  public position?: number;

  /** Component-specific properties (JSON) */
  public properties: Record<string, unknown>;

  /** Whether compatibility has been checked for this item */
  public compatibilityChecked: boolean;

  /** Creation timestamp */
  public createdAt: Date;

  /** Last update timestamp */
  public updatedAt: Date;

  /**
   * Create a new ConfigurationItem
   *
   * @param sessionId - Parent session ID
   * @param productId - Product ID
   * @param componentType - Component type
   * @param quantity - Quantity (default: 1)
   * @param unitPrice - Unit price (default: 0)
   */
  constructor(
    sessionId: string,
    productId: number,
    componentType: string,
    quantity: number = 1,
    unitPrice: number = 0
  ) {
    this.id = uuidv4();
    this.sessionId = sessionId;
    this.productId = productId;
    this.componentType = componentType;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.subtotal = this._calculateSubtotal();
    this.properties = {};
    this.compatibilityChecked = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Update quantity and recalculate subtotal
   *
   * @param quantity - New quantity
   * @throws {Error} If quantity is invalid
   */
  public updateQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    this.quantity = quantity;
    this.subtotal = this._calculateSubtotal();
    this.updatedAt = new Date();
  }

  /**
   * Calculate subtotal from quantity and unit price
   *
   * @returns Calculated subtotal
   */
  public calculateSubtotal(): number {
    return this._calculateSubtotal();
  }

  /**
   * Check if this item is compatible with another item
   *
   * @param other - Other configuration item
   * @returns true if compatible
   */
  public isCompatibleWith(other: ConfigurationItem): boolean {
    // Override with actual compatibility logic in compatibility engine
    return true;
  }

  /**
   * Validate the item
   *
   * @returns true if item is valid
   */
  public isValid(): boolean {
    return (
      this.productId > 0 &&
      this.quantity > 0 &&
      this.unitPrice >= 0 &&
      this.componentType.length > 0
    );
  }

  /**
   * Private helper to calculate subtotal
   *
   * @private
   * @returns Subtotal (rounded to 2 decimal places)
   */
  private _calculateSubtotal(): number {
    return Math.round(this.quantity * this.unitPrice * 100) / 100;
  }
}
