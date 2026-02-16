import { CompatibilityRule } from '../entities/CompatibilityRule';

/**
 * Compatibility Rule Repository Port
 *
 * Defines the contract for persisting and retrieving CompatibilityRule entities.
 * Rules are configuration domain constraints that must be validated during
 * configuration assembly.
 *
 * @interface IRuleRepository
 */
export interface IRuleRepository {
  /**
   * Find all rules for a specific configurator type
   *
   * @param configuratorType - MAGNETIC_TRACK or LED_STRIP
   * @returns Promise resolving to all rules for type
   */
  findByConfiguratorType(configuratorType: 'MAGNETIC_TRACK' | 'LED_STRIP'): Promise<CompatibilityRule[]>;

  /**
   * Find all active rules
   *
   * @returns Promise resolving to all active rules
   */
  findActive(): Promise<CompatibilityRule[]>;

  /**
   * Save a rule (create or update)
   *
   * @param rule - Rule to save
   * @returns Promise resolving to saved rule
   * @throws {Error} If persistence fails
   */
  save(rule: CompatibilityRule): Promise<CompatibilityRule>;

  /**
   * Delete a rule by ID
   *
   * @param ruleId - Rule ID
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(ruleId: string): Promise<boolean>;

  /**
   * Find rule by ID
   *
   * @param ruleId - Rule ID
   * @returns Promise resolving to rule or undefined
   */
  findById(ruleId: string): Promise<CompatibilityRule | undefined>;
}
