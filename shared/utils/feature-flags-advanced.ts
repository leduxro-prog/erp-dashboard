/**
 * Advanced Feature Flag Service - Redis-backed with persistence and change tracking
 * Extends base feature flag functionality with runtime toggling, storage, and audit logging
 *
 * @module shared/utils/feature-flags-advanced
 */

import { createModuleLogger } from './logger';
import { RedisPool } from '../cache/redis-pool';
import { FeatureFlag, FlagEvaluationContext, IFeatureFlagService } from './feature-flags';
import { getAlertManager, AlertLevel } from '../alerting';
import * as crypto from 'crypto';

const logger = createModuleLogger('feature-flags-advanced');

/**
 * Flag change audit event
 */
export interface FlagChangeEvent {
  id: string;
  flagName: string;
  previousState: Partial<FeatureFlag>;
  newState: Partial<FeatureFlag>;
  changedBy: string; // User ID or 'api', 'system'
  changedAt: Date;
  changeType: 'enabled' | 'percentage' | 'roles' | 'all';
  metadata?: Record<string, unknown>;
}

/**
 * Redis-backed advanced feature flag service
 * Provides persistence, runtime toggling, and change tracking
 */
export class AdvancedFeatureFlagService implements IFeatureFlagService {
  private static instance: AdvancedFeatureFlagService | null = null;
  private flags: Map<string, FeatureFlag> = new Map();
  private redisPool: RedisPool;
  private changeAuditLog: FlagChangeEvent[] = [];
  private maxAuditLogSize = 1000;
  private redisKeyPrefix = 'feature_flags';

  private constructor() {
    this.redisPool = RedisPool.getInstance();
    this.initializeFlags();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdvancedFeatureFlagService {
    if (!AdvancedFeatureFlagService.instance) {
      AdvancedFeatureFlagService.instance = new AdvancedFeatureFlagService();
    }
    return AdvancedFeatureFlagService.instance;
  }

  /**
   * Initialize flags from environment and Redis
   */
  private async initializeFlags(): Promise<void> {
    try {
      // Load from Redis first
      const redisFlags = await this.loadFlagsFromRedis();
      if (redisFlags && Object.keys(redisFlags).length > 0) {
        this.flags = new Map(Object.entries(redisFlags));
        logger.info('Feature flags loaded from Redis', {
          count: this.flags.size,
        });
        return;
      }
    } catch (error) {
      logger.warn('Failed to load feature flags from Redis, using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Fallback to environment variables
    this.initializeFlagsFromEnv();
  }

  /**
   * Initialize flags from environment variables (synchronous)
   */
  private initializeFlagsFromEnv(): void {
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

    defaultFlags.forEach(flag => this.flags.set(flag.name, flag));

    logger.info('Feature flags initialized from environment', {
      totalFlags: this.flags.size,
      enabledCount: Array.from(this.flags.values()).filter(f => f.enabled).length,
    });

    // Persist to Redis
    this.persistFlagsToRedis().catch(error => {
      logger.warn('Failed to persist flags to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Load flags from Redis
   */
  private async loadFlagsFromRedis(): Promise<Record<string, FeatureFlag> | null> {
    try {
      const client = this.redisPool.getClient();
      const data = await client.get(`${this.redisKeyPrefix}:all`);

      if (!data) {
        return null;
      }

      const flags = JSON.parse(data) as Record<string, FeatureFlag>;

      // Reconstruct dates
      Object.values(flags).forEach(flag => {
        flag.createdAt = new Date(flag.createdAt);
        flag.updatedAt = new Date(flag.updatedAt);
      });

      return flags;
    } catch (error) {
      logger.error('Failed to load flags from Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Persist flags to Redis
   */
  private async persistFlagsToRedis(): Promise<void> {
    try {
      const client = this.redisPool.getPrimaryClient();
      const flagsData = Object.fromEntries(this.flags);

      await client.setEx(
        `${this.redisKeyPrefix}:all`,
        86400, // 24 hour TTL
        JSON.stringify(flagsData)
      );

      logger.debug('Feature flags persisted to Redis', {
        count: this.flags.size,
      });
    } catch (error) {
      logger.error('Failed to persist flags to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Read env variable as boolean
   */
  private getEnvFlag(envVar: string, defaultValue: boolean): boolean {
    const value = process.env[envVar];
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Hash user ID for consistent percentage-based rollout
   */
  private hashUserForPercentage(userId: number): number {
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Check if flag is enabled
   */
  isEnabled(flagName: string, context?: FlagEvaluationContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      logger.debug('Feature flag not found', { flagName });
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Role-based check
    if (flag.enabledFor && flag.enabledFor.length > 0) {
      const hasRole = context?.role && flag.enabledFor.includes(context.role);
      return hasRole || false;
    }

    // Percentage-based check
    if (flag.percentage !== undefined && flag.percentage < 100) {
      if (!context?.userId) {
        return false;
      }

      const userHash = this.hashUserForPercentage(context.userId);
      return userHash < flag.percentage;
    }

    return true;
  }

  /**
   * Get all flags
   */
  getAll(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get specific flag
   */
  getFlag(name: string): FeatureFlag | undefined {
    return this.flags.get(name);
  }

  /**
   * Toggle flag enabled state and persist
   */
  async setFlag(name: string, enabled: boolean, changedBy: string = 'api'): Promise<void> {
    const flag = this.flags.get(name);
    if (!flag) {
      logger.warn('Attempted to set unknown flag', { name });
      return;
    }

    const previousState = { enabled: flag.enabled };

    flag.enabled = enabled;
    flag.updatedAt = new Date();

    // Record change
    this.recordChangeEvent({
      flagName: name,
      previousState,
      newState: { enabled },
      changedBy,
      changeType: 'enabled',
    });

    // Persist
    await this.persistFlagsToRedis();

    logger.info('Feature flag toggled', {
      name,
      enabled,
      changedBy,
    });

    // Send alert if critical flag is disabled
    if (!enabled && this.isCriticalFlag(name)) {
      await getAlertManager().sendAlert(
        AlertLevel.WARNING,
        'Critical Feature Flag Disabled',
        `Feature flag "${name}" has been disabled`,
        { flagName: name, changedBy }
      );
    }
  }

  /**
   * Set percentage rollout
   */
  async setPercentage(name: string, percentage: number, changedBy: string = 'api'): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      logger.error('Invalid percentage', { name, percentage });
      return;
    }

    const flag = this.flags.get(name);
    if (!flag) {
      logger.warn('Attempted to set percentage on unknown flag', { name });
      return;
    }

    const previousState = { percentage: flag.percentage };

    flag.percentage = percentage;
    flag.updatedAt = new Date();

    this.recordChangeEvent({
      flagName: name,
      previousState,
      newState: { percentage },
      changedBy,
      changeType: 'percentage',
    });

    await this.persistFlagsToRedis();

    logger.info('Feature flag percentage updated', {
      name,
      percentage,
      changedBy,
    });
  }

  /**
   * Set role-based access
   */
  async setEnabledForRoles(
    name: string,
    roles: string[],
    changedBy: string = 'api'
  ): Promise<void> {
    const flag = this.flags.get(name);
    if (!flag) {
      logger.warn('Attempted to set roles on unknown flag', { name });
      return;
    }

    const previousState = { enabledFor: flag.enabledFor };

    flag.enabledFor = roles;
    flag.updatedAt = new Date();

    this.recordChangeEvent({
      flagName: name,
      previousState,
      newState: { enabledFor: roles },
      changedBy,
      changeType: 'roles',
    });

    await this.persistFlagsToRedis();

    logger.info('Feature flag roles updated', {
      name,
      roles,
      changedBy,
    });
  }

  /**
   * Record a flag change event for audit trail
   */
  private recordChangeEvent(partial: Omit<FlagChangeEvent, 'id' | 'changedAt'>): void {
    const event: FlagChangeEvent = {
      id: crypto.randomUUID(),
      changedAt: new Date(),
      ...partial,
    };

    this.changeAuditLog.push(event);

    // Maintain size limit
    if (this.changeAuditLog.length > this.maxAuditLogSize) {
      this.changeAuditLog = this.changeAuditLog.slice(-this.maxAuditLogSize);
    }

    // Also persist to Redis
    this.persistChangeEventToRedis(event).catch(error => {
      logger.warn('Failed to persist change event to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Persist change event to Redis
   */
  private async persistChangeEventToRedis(event: FlagChangeEvent): Promise<void> {
    try {
      const client = this.redisPool.getPrimaryClient();
      const key = `${this.redisKeyPrefix}:changes:${event.flagName}`;

      await client.lPush(key, JSON.stringify(event));
      // Keep only last 100 changes per flag
      await client.lTrim(key, 0, 99);
      // Set TTL
      await client.expire(key, 86400 * 7); // 7 days
    } catch (error) {
      logger.error('Failed to persist change event', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get change history for a flag
   */
  async getChangeHistory(flagName: string, limit: number = 50): Promise<FlagChangeEvent[]> {
    try {
      const client = this.redisPool.getClient();
      const key = `${this.redisKeyPrefix}:changes:${flagName}`;

      const events = await client.lRange(key, 0, limit - 1);
      return events.map(e => JSON.parse(e) as FlagChangeEvent);
    } catch (error) {
      logger.error('Failed to get change history', {
        flagName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Check if flag is critical
   */
  private isCriticalFlag(name: string): boolean {
    const criticalFlags = ['SMARTBILL_SYNC', 'WOOCOMMERCE_SYNC', 'NOTIFICATIONS_EMAIL'];
    return criticalFlags.includes(name);
  }

  /**
   * Get audit log
   */
  getAuditLog(): FlagChangeEvent[] {
    return [...this.changeAuditLog];
  }

  /**
   * Export flag state snapshot
   */
  exportState(): Record<string, FeatureFlag> {
    return Object.fromEntries(this.flags);
  }

  /**
   * Import flag state snapshot
   */
  async importState(state: Record<string, FeatureFlag>, changedBy: string = 'system'): Promise<void> {
    this.flags = new Map(Object.entries(state));
    await this.persistFlagsToRedis();

    logger.info('Feature flag state imported', {
      count: this.flags.size,
      changedBy,
    });
  }
}

/**
 * Get singleton instance
 */
export function getAdvancedFeatureFlagService(): AdvancedFeatureFlagService {
  return AdvancedFeatureFlagService.getInstance();
}

export default getAdvancedFeatureFlagService;
