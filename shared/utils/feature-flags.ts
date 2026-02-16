import { createModuleLogger } from './logger';

const logger = createModuleLogger('feature-flags');

/**
 * Feature flag definition with metadata.
 * Stores flag state, scope, and rollout configuration.
 *
 * @example
 * {
 *   name: 'WOOCOMMERCE_SYNC',
 *   enabled: true,
 *   description: 'Enable WooCommerce product synchronization',
 *   percentage: 100,
 *   createdAt: '2025-02-07T10:30:00Z',
 *   updatedAt: '2025-02-07T10:30:00Z'
 * }
 */
export interface FeatureFlag {
  /** Unique feature flag name */
  name: string;
  /** Current enabled state */
  enabled: boolean;
  /** Human-readable description of the feature */
  description: string;
  /** Specific user IDs or roles this flag is enabled for (null = all users) */
  enabledFor?: string[];
  /** Gradual rollout percentage 0-100 (null = all or none based on enabled) */
  percentage?: number;
  /** When flag was created */
  createdAt: Date;
  /** Last modification timestamp */
  updatedAt: Date;
}

/**
 * Context for feature flag evaluation.
 * Provides user/role information for scoped flag decisions.
 *
 * @example
 * { userId: 123, role: 'admin' }
 * { userId: 456, role: 'user' }
 */
export interface FlagEvaluationContext {
  /** User ID for percentage-based rollout hashing */
  userId?: number;
  /** User role for role-based flags */
  role?: string;
}

/**
 * Feature Flag Service Interface.
 * Handles all feature flag operations with support for
 * percentage-based rollout, role-based scoping, and runtime override.
 *
 * @example
 * const service = FeatureFlagService.getInstance();
 * if (service.isEnabled('WOOCOMMERCE_SYNC', { role: 'admin' })) {
 *   await syncWooCommerce();
 * }
 */
export interface IFeatureFlagService {
  /**
   * Check if a feature flag is enabled for the given context.
   *
   * @param flagName - Feature flag name
   * @param context - User/role context for scoped evaluation
   * @returns true if flag is enabled for this context, false otherwise
   */
  isEnabled(flagName: string, context?: FlagEvaluationContext): boolean;

  /**
   * Get all registered feature flags.
   *
   * @returns Array of all feature flags with current state
   */
  getAll(): FeatureFlag[];

  /**
   * Get a specific feature flag by name.
   *
   * @param name - Feature flag name
   * @returns Feature flag definition or undefined if not found
   */
  getFlag(name: string): FeatureFlag | undefined;

  /**
   * Enable or disable a feature flag at runtime.
   * Does not persist to database (use for temporary overrides in session).
   *
   * @param name - Feature flag name
   * @param enabled - New enabled state
   */
  setFlag(name: string, enabled: boolean): void;

  /**
   * Set percentage-based rollout for a flag.
   * Users will be included in rollout based on userId hash.
   *
   * @param name - Feature flag name
   * @param percentage - Rollout percentage 0-100
   */
  setPercentage(name: string, percentage: number): void;

  /**
   * Set role-based access for a flag.
   * Flag only enabled for specified roles.
   *
   * @param name - Feature flag name
   * @param roles - Array of roles with access (empty = all if enabled)
   */
  setEnabledForRoles(name: string, roles: string[]): void;
}

/**
 * Enterprise feature flag system.
 * Allows enabling/disabling features without redeployment.
 * Flags are loaded from environment variables and can be overridden at runtime.
 *
 * Supports three types of flags:
 * 1. Global: enabled for all users (percentage=100, enabledFor=undefined)
 * 2. Percentage-based: gradual rollout (percentage 0-100, userId hash-based)
 * 3. Role-based: only for specific roles (enabledFor=['admin', 'manager'])
 *
 * Environment variables format: FEATURE_<FLAG_NAME>=true|false
 * Example: FEATURE_SMARTBILL_SYNC=true, FEATURE_WOOCOMMERCE_SYNC=true
 *
 * @example
 * const service = FeatureFlagService.getInstance();
 * if (service.isEnabled('WOOCOMMERCE_SYNC')) {
 *   await syncProduct(product);
 * }
 *
 * @example
 * // Percentage-based rollout - 50% of users
 * const isEligible = service.isEnabled('NEW_UI', { userId: 123 });
 *
 * @example
 * // Role-based flag - only admins
 * const isEnabled = service.isEnabled('ADMIN_PANEL', { role: 'admin' });
 */
class FeatureFlagService implements IFeatureFlagService {
  private static instance: FeatureFlagService | null = null;
  private flags: Map<string, FeatureFlag> = new Map();

  private constructor() {
    this.initializeFlags();
  }

  /**
   * Get singleton instance of FeatureFlagService.
   *
   * @returns Singleton instance
   *
   * @example
   * const service = FeatureFlagService.getInstance();
   */
  static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Initialize feature flags from environment variables.
   * Reads FEATURE_* environment variables and creates flag definitions.
   *
   * @internal
   */
  private initializeFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        name: 'SMARTBILL_SYNC',
        description: 'Enable SmartBill ERP synchronization',
        enabled: this.getEnvFlag('FEATURE_SMARTBILL_SYNC', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'WOOCOMMERCE_SYNC',
        description: 'Enable WooCommerce product synchronization',
        enabled: this.getEnvFlag('FEATURE_WOOCOMMERCE_SYNC', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'SUPPLIER_SCRAPING',
        description: 'Enable supplier price scraping',
        enabled: this.getEnvFlag('FEATURE_SUPPLIER_SCRAPING', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'NOTIFICATIONS_EMAIL',
        description: 'Enable email notifications',
        enabled: this.getEnvFlag('FEATURE_NOTIFICATIONS_EMAIL', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'NOTIFICATIONS_WHATSAPP',
        description: 'Enable WhatsApp notifications',
        enabled: this.getEnvFlag('FEATURE_NOTIFICATIONS_WHATSAPP', false),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'B2B_PORTAL',
        description: 'Enable B2B customer portal',
        enabled: this.getEnvFlag('FEATURE_B2B_PORTAL', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'CONFIGURATOR_MAGNETIC',
        description: 'Enable magnetic products configurator',
        enabled: this.getEnvFlag('FEATURE_CONFIGURATOR_MAGNETIC', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'CONFIGURATOR_LED',
        description: 'Enable LED products configurator',
        enabled: this.getEnvFlag('FEATURE_CONFIGURATOR_LED', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'ANALYTICS_DASHBOARD',
        description: 'Enable analytics dashboard',
        enabled: this.getEnvFlag('FEATURE_ANALYTICS_DASHBOARD', true),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'SEO_AUTOMATION',
        description: 'Enable SEO automation and optimization',
        enabled: this.getEnvFlag('FEATURE_SEO_AUTOMATION', false),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'MARKETING_CAMPAIGNS',
        description: 'Enable marketing campaign management',
        enabled: this.getEnvFlag('FEATURE_MARKETING_CAMPAIGNS', false),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultFlags.forEach((flag) => this.flags.set(flag.name, flag));

    logger.info('Feature flags initialized', {
      totalFlags: this.flags.size,
      enabledCount: Array.from(this.flags.values()).filter((f) => f.enabled).length,
    });
  }

  /**
   * Read feature flag from environment variable.
   * Converts environment variable string to boolean.
   *
   * @param envVar - Environment variable name
   * @param defaultValue - Default value if env var not set
   * @returns Boolean flag state
   *
   * @internal
   */
  private getEnvFlag(envVar: string, defaultValue: boolean): boolean {
    const value = process.env[envVar];
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Hash a user ID for percentage-based rollout.
   * Uses consistent hashing so same user always gets same result.
   *
   * @param userId - User ID to hash
   * @returns Percentage value 0-99
   *
   * @internal
   */
  private hashUserForPercentage(userId: number): number {
    // Simple but effective hash function
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Check if a feature flag is enabled for the given context.
   * Evaluates global, percentage-based, and role-based flags.
   *
   * @param flagName - Feature flag name
   * @param context - User/role context for scoped evaluation
   * @returns true if flag is enabled for this context, false otherwise
   *
   * @example
   * const enabled = service.isEnabled('WOOCOMMERCE_SYNC');
   * const adminEnabled = service.isEnabled('ADMIN_PANEL', { role: 'admin' });
   * const percentEnabled = service.isEnabled('NEW_UI', { userId: 123 });
   */
  isEnabled(flagName: string, context?: FlagEvaluationContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      logger.debug('Feature flag not found', { flagName });
      return false;
    }

    // If flag is globally disabled, return false regardless of context
    if (!flag.enabled) {
      logger.debug('Feature flag disabled', { flagName });
      return false;
    }

    // Check role-based access
    if (flag.enabledFor && flag.enabledFor.length > 0) {
      const hasRole = context?.role && flag.enabledFor.includes(context.role);
      logger.debug('Feature flag role check', {
        flagName,
        userRole: context?.role,
        enabledFor: flag.enabledFor,
        allowed: hasRole,
      });
      return hasRole || false;
    }

    // Check percentage-based rollout
    if (flag.percentage !== undefined && flag.percentage < 100) {
      if (!context?.userId) {
        // No userId provided - exclude from percentage rollout
        logger.debug('Feature flag percentage check - no userId', { flagName });
        return false;
      }

      const userHash = this.hashUserForPercentage(context.userId);
      const included = userHash < flag.percentage;

      logger.debug('Feature flag percentage check', {
        flagName,
        userId: context.userId,
        percentage: flag.percentage,
        userHash,
        included,
      });

      return included;
    }

    // Global flag - enabled for all
    logger.debug('Feature flag enabled globally', { flagName });
    return true;
  }

  /**
   * Get all registered feature flags.
   *
   * @returns Array of all feature flags with current state
   */
  getAll(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get a specific feature flag by name.
   *
   * @param name - Feature flag name
   * @returns Feature flag definition or undefined if not found
   */
  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /**
   * Enable or disable a feature flag at runtime.
   * Changes are in-memory only (not persisted).
   * Used for temporary overrides or testing.
   *
   * @param name - Feature flag name
   * @param enabled - New enabled state
   *
   * @example
   * service.setFlag('WOOCOMMERCE_SYNC', false); // Disable feature
   * service.setFlag('WOOCOMMERCE_SYNC', true);  // Re-enable feature
   */
  setFlag(name: string, enabled: boolean): void {
    const flag = this.flags.get(name);
    if (!flag) {
      logger.warn('Attempted to set unknown feature flag', { name });
      return;
    }

    flag.enabled = enabled;
    flag.updatedAt = new Date();

    logger.info('Feature flag updated', {
      name,
      enabled,
      timestamp: flag.updatedAt,
    });
  }

  /**
   * Set percentage-based rollout for a flag.
   * Users will be included based on consistent hash of userId.
   *
   * @param name - Feature flag name
   * @param percentage - Rollout percentage 0-100
   *
   * @example
   * service.setPercentage('NEW_UI', 50); // Roll out to 50% of users
   */
  setPercentage(name: string, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      logger.error('Invalid percentage value', { name, percentage });
      return;
    }

    const flag = this.flags.get(name);
    if (!flag) {
      logger.warn('Attempted to set percentage on unknown flag', { name });
      return;
    }

    flag.percentage = percentage;
    flag.updatedAt = new Date();

    logger.info('Feature flag percentage updated', {
      name,
      percentage,
      timestamp: flag.updatedAt,
    });
  }

  /**
   * Set role-based access for a flag.
   * Flag is only enabled for specified roles.
   *
   * @param name - Feature flag name
   * @param roles - Array of roles with access (empty array = all users if enabled)
   *
   * @example
   * service.setEnabledForRoles('ADMIN_PANEL', ['admin', 'manager']);
   * service.setEnabledForRoles('BETA_FEATURES', ['beta-tester']);
   */
  setEnabledForRoles(name: string, roles: string[]): void {
    const flag = this.flags.get(name);
    if (!flag) {
      logger.warn('Attempted to set roles on unknown flag', { name });
      return;
    }

    flag.enabledFor = roles;
    flag.updatedAt = new Date();

    logger.info('Feature flag roles updated', {
      name,
      roles,
      timestamp: flag.updatedAt,
    });
  }
}

/**
 * Get singleton instance of FeatureFlagService.
 *
 * @returns Singleton service instance
 *
 * @example
 * import { getFeatureFlagService } from './feature-flags';
 *
 * const service = getFeatureFlagService();
 * if (service.isEnabled('WOOCOMMERCE_SYNC')) {
 *   await syncWooCommerce();
 * }
 */
export function getFeatureFlagService(): IFeatureFlagService {
  return FeatureFlagService.getInstance();
}

export default getFeatureFlagService();
