import { ConfigurationItem } from '../entities/ConfiguratorSession';
import { CompatibilityRule } from '../entities/CompatibilityRule';

/**
 * Compatibility Engine Service
 *
 * Domain service that evaluates all compatibility rules against a configuration.
 * Checks constraints like:
 * - Magnetic track requires power supply
 * - Maximum 8 spots per 2m track
 * - L/T/X connectors need matching track types
 * - LED strip requires controller per 10m
 * - Power adapter wattage must cover total load
 *
 * @class CompatibilityEngine
 */
export class CompatibilityEngine {
  /**
   * Create a new CompatibilityEngine
   */
  constructor() {}

  /**
   * Evaluate all rules against current configuration
   *
   * @param items - Configuration items to validate
   * @param rules - Compatibility rules to apply
   * @returns Validation result with violations and suggestions
   */
  public evaluate(
    items: ConfigurationItem[],
    rules: CompatibilityRule[]
  ): {
    isValid: boolean;
    violations: Array<{
      ruleId: string;
      ruleName: string;
      message: string;
      severity: 'error' | 'warning';
      affectedItems: string[];
    }>;
    suggestions: string[];
  } {
    const violations: Array<{
      ruleId: string;
      ruleName: string;
      message: string;
      severity: 'error' | 'warning';
      affectedItems: string[];
    }> = [];

    const suggestions: string[] = [];

    // Sort rules by priority (higher first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    // Convert items to simple format for rule evaluation
    const itemData = items.map((item) => ({
      componentType: item.componentType,
      quantity: item.quantity,
      id: item.id,
    }));

    // Evaluate each rule
    for (const rule of sortedRules) {
      const isValid = rule.evaluate(itemData);

      if (!isValid) {
        const affectedItems = items
          .filter((item) => item.componentType === rule.sourceComponentType)
          .map((item) => item.id);

        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          message: rule.getViolationMessage('en'),
          severity: this._determineSeverity(rule.ruleType),
          affectedItems,
        });
      }
    }

    // Generate suggestions based on violations
    for (const violation of violations) {
      const suggestion = this._generateSuggestion(violation, items);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      suggestions,
    };
  }

  /**
   * Check if a specific component type is required
   *
   * @param componentType - Component type to check
   * @param rules - Rules to evaluate
   * @return true if component is required
   */
  public isRequired(componentType: string, rules: CompatibilityRule[]): boolean {
    return rules.some(
      (rule) =>
        rule.ruleType === 'REQUIRES' &&
        rule.targetComponentType === componentType &&
        rule.isActive
    );
  }

  /**
   * Get incompatible components for a given type
   *
   * @param componentType - Component type
   * @param rules - Rules to check
   * @returns Array of incompatible component types
   */
  public getIncompatible(componentType: string, rules: CompatibilityRule[]): string[] {
    return rules
      .filter(
        (rule) =>
          rule.ruleType === 'EXCLUDES' &&
          rule.sourceComponentType === componentType &&
          rule.isActive &&
          rule.targetComponentType
      )
      .map((rule) => rule.targetComponentType as string);
  }

  /**
   * Get required components for a given type
   *
   * @param componentType - Component type
   * @param rules - Rules to check
   * @returns Array of required component types
   */
  public getRequired(componentType: string, rules: CompatibilityRule[]): string[] {
    return rules
      .filter(
        (rule) =>
          rule.ruleType === 'REQUIRES' &&
          rule.sourceComponentType === componentType &&
          rule.isActive &&
          rule.targetComponentType
      )
      .map((rule) => rule.targetComponentType as string);
  }

  /**
   * Determine severity of rule violation
   *
   * @private
   * @param ruleType - Type of rule violated
   * @returns Severity level
   */
  private _determineSeverity(
    ruleType: 'REQUIRES' | 'EXCLUDES' | 'MAX_QUANTITY' | 'MIN_QUANTITY' | 'DISTANCE'
  ): 'error' | 'warning' {
    // REQUIRES and EXCLUDES are hard errors
    if (ruleType === 'REQUIRES' || ruleType === 'EXCLUDES') {
      return 'error';
    }

    // Quantity and distance violations are warnings (can proceed with caution)
    return 'warning';
  }

  /**
   * Generate suggestion based on violation
   *
   * @private
   * @param violation - Violation to suggest for
   * @param items - Current items
   * @returns Suggestion text or undefined
   */
  private _generateSuggestion(
    violation: {
      ruleId: string;
      ruleName: string;
      message: string;
      severity: 'error' | 'warning';
      affectedItems: string[];
    },
    items: ConfigurationItem[]
  ): string | undefined {
    // Extract actionable suggestions from violation messages
    if (violation.message.toLowerCase().includes('requires power')) {
      return 'Add a power supply to your configuration';
    }

    const message = violation.message.toLowerCase();

    if (message.includes('maximum') || message.includes('max')) {
      return 'Reduce quantity of one or more components';
    }

    if (violation.message.toLowerCase().includes('controller')) {
      return 'Add a controller to manage the LED strips';
    }

    return undefined;
  }
}
