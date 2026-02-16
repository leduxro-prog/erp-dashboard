/**
 * CompatibilityRule Domain Entity
 *
 * Represents a compatibility rule between components in the configurator.
 * Rules enforce business constraints like:
 * - Magnetic track requires a power supply
 * - Maximum 8 spots per 2m track
 * - LED strip requires controller per 10m
 * - Power adapter wattage must cover total load
 *
 * @class CompatibilityRule
 */
export class CompatibilityRule {
  /** Unique rule ID */
  public id: string;

  /** Human-readable rule name */
  public name: string;

  /** Rule type determines evaluation logic */
  public ruleType: 'REQUIRES' | 'EXCLUDES' | 'MAX_QUANTITY' | 'MIN_QUANTITY' | 'DISTANCE';

  /** Component type that triggers the rule */
  public sourceComponentType: string;

  /** Component type required/excluded/constrained by rule */
  public targetComponentType?: string;

  /** Rule evaluation condition (JSON) */
  public condition: Record<string, unknown>;

  /** Error message to show user when rule is violated */
  public errorMessage: Record<'ro' | 'en', string>;

  /** Whether this rule is currently active */
  public isActive: boolean;

  /** Rule priority (higher = evaluated first) */
  public priority: number;

  /**
   * Create a new CompatibilityRule
   *
   * @param name - Rule name
   * @param ruleType - Type of rule
   * @param sourceComponentType - Component that triggers rule
   * @param errorMessage - Error message (with locale support)
   */
  constructor(
    name: string,
    ruleType: 'REQUIRES' | 'EXCLUDES' | 'MAX_QUANTITY' | 'MIN_QUANTITY' | 'DISTANCE',
    sourceComponentType: string,
    errorMessage: Record<'ro' | 'en', string>
  ) {
    this.id = this._generateId();
    this.name = name;
    this.ruleType = ruleType;
    this.sourceComponentType = sourceComponentType;
    this.errorMessage = errorMessage;
    this.condition = {};
    this.isActive = true;
    this.priority = 0;
  }

  /**
   * Evaluate rule against a set of configuration items
   *
   * @param items - Items to evaluate
   * @returns true if rule is satisfied
   */
  public evaluate(items: Array<{ componentType: string; quantity: number }>): boolean {
    if (!this.isActive) {
      return true; // Inactive rules always pass
    }

    const sourceItems = items.filter((i) => i.componentType === this.sourceComponentType);

    // If source component not present, rule doesn't apply
    if (sourceItems.length === 0) {
      if (this.ruleType === 'MIN_QUANTITY') {
        return this._evaluateMinQuantity(items);
      }
      return true;
    }

    switch (this.ruleType) {
      case 'REQUIRES':
        return this._evaluateRequires(items);
      case 'EXCLUDES':
        return this._evaluateExcludes(items);
      case 'MAX_QUANTITY':
        return this._evaluateMaxQuantity(items);
      case 'MIN_QUANTITY':
        return this._evaluateMinQuantity(items);
      case 'DISTANCE':
        return this._evaluateDistance(items);
      default:
        return true;
    }
  }

  /**
   * Get violation message in specified locale
   *
   * @param locale - Locale code (ro or en)
   * @returns Error message
   */
  public getViolationMessage(locale: 'ro' | 'en' = 'en'): string {
    return this.errorMessage[locale] || this.errorMessage['en'];
  }

  /**
   * Set rule condition
   *
   * @param condition - Condition object
   */
  public setCondition(condition: Record<string, unknown>): void {
    this.condition = condition;
  }

  /**
   * Evaluate REQUIRES rule
   * Example: TRACK_2M requires POWER_SUPPLY
   *
   * @private
   * @param items - Items to evaluate
   * @returns true if required component is present
   */
  private _evaluateRequires(items: Array<{ componentType: string; quantity: number }>): boolean {
    if (!this.targetComponentType) {
      return true;
    }

    const hasTarget = items.some((i) => i.componentType === this.targetComponentType);
    return hasTarget;
  }

  /**
   * Evaluate EXCLUDES rule
   * Example: Cannot use two incompatible connectors
   *
   * @private
   * @param items - Items to evaluate
   * @returns true if excluded component is not present
   */
  private _evaluateExcludes(items: Array<{ componentType: string; quantity: number }>): boolean {
    if (!this.targetComponentType) {
      return true;
    }

    const hasTarget = items.some((i) => i.componentType === this.targetComponentType);
    return !hasTarget;
  }

  /**
   * Evaluate MAX_QUANTITY rule
   * Example: Maximum 8 spots per 2m track
   *
   * @private
   * @param items - Items to evaluate
   * @returns true if quantity is within limit
   */
  private _evaluateMaxQuantity(
    items: Array<{ componentType: string; quantity: number }>
  ): boolean {
    const maxQty = (this.condition.maxQuantity as number) ?? 0;
    if (maxQty <= 0) {
      return true;
    }

    const sourceItems = items.filter((i) => i.componentType === this.sourceComponentType);
    const totalQty = sourceItems.reduce((sum, item) => sum + item.quantity, 0);

    return totalQty <= maxQty;
  }

  /**
   * Evaluate MIN_QUANTITY rule
   * Example: At least 1 power supply required
   *
   * @private
   * @param items - Items to evaluate
   * @returns true if quantity meets minimum
   */
  private _evaluateMinQuantity(
    items: Array<{ componentType: string; quantity: number }>
  ): boolean {
    const minQty = (this.condition.minQuantity as number) ?? 1;
    if (minQty <= 0) {
      return true;
    }

    const sourceItems = items.filter((i) => i.componentType === this.sourceComponentType);
    const totalQty = sourceItems.reduce((sum, item) => sum + item.quantity, 0);

    return totalQty >= minQty;
  }

  /**
   * Evaluate DISTANCE rule
   * Example: Controller needed for every 10m of LED strip
   *
   * @private
   * @param items - Items to evaluate
   * @returns true if distance constraint is satisfied
   */
  private _evaluateDistance(
    items: Array<{ componentType: string; quantity: number }>
  ): boolean {
    const distancePerUnit = (this.condition.distancePerUnit as number) ?? 10;
    const requiredPer = (this.condition.requiredPer as number) ?? 1;

    if (!this.targetComponentType || distancePerUnit <= 0) {
      return true;
    }

    const sourceItems = items.filter((i) => i.componentType === this.sourceComponentType);
    const targetItems = items.filter((i) => i.componentType === this.targetComponentType);

    const totalDistance = sourceItems.reduce((sum, item) => {
      return sum + this._normalizeDistanceQuantity(item.componentType, item.quantity, distancePerUnit);
    }, 0);
    const totalControllers = targetItems.reduce((sum, item) => sum + item.quantity, 0);

    const requiredControllers = Math.ceil(totalDistance / distancePerUnit);

    return totalControllers >= requiredControllers * requiredPer;
  }

  private _normalizeDistanceQuantity(
    componentType: string,
    quantity: number,
    distancePerUnit: number
  ): number {
    const unitMatch = componentType.match(/_(\d+)M$/i);
    if (!unitMatch) {
      return quantity;
    }

    const unitLength = Number(unitMatch[1]);
    if (!Number.isFinite(unitLength) || unitLength <= 0) {
      return quantity;
    }

    // Backward-compatible support:
    // - legacy payloads may send quantity as meters
    // - newer payloads may send quantity as unit count (e.g. 3 x LED_STRIP_5M)
    if (quantity <= distancePerUnit) {
      return quantity * unitLength;
    }

    return quantity;
  }

  /**
   * Generate unique rule ID
   *
   * @private
   * @returns UUID-like ID
   */
  private _generateId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
