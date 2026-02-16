/**
 * Workflow-specific caching layer
 * Implements multi-tier caching strategy for templates and instances
 */

import { ICacheManager } from '@shared/module-system/module.interface';

const CACHE_KEYS = {
  TEMPLATE: (id: string) => `wf:template:${id}`,
  TEMPLATE_BY_ENTITY: (entityType: string, version?: number) =>
    version ? `wf:template_entity:${entityType}:${version}` : `wf:template_entity:${entityType}`,
  INSTANCE: (id: string) => `wf:instance:${id}`,
  INSTANCE_BY_ENTITY: (entityType: string, entityId: string) => `wf:instance_entity:${entityType}:${entityId}`,
  PENDING_APPROVALS: (userId: string) => `wf:pending_approvals:${userId}`,
  ANALYTICS: (templateId: string, period: string) => `wf:analytics:${templateId}:${period}`,
};

const CACHE_TTL = {
  TEMPLATE: 3600, // 1 hour
  INSTANCE: 300, // 5 minutes
  PENDING_APPROVALS: 60, // 1 minute
  ANALYTICS: 1800, // 30 minutes
};

export class WorkflowCache {
  constructor(private cacheManager: ICacheManager) {}

  /**
   * Get template from cache
   */
  async getTemplate(id: string): Promise<any | null> {
    return this.cacheManager.get(CACHE_KEYS.TEMPLATE(id));
  }

  /**
   * Set template in cache
   */
  async setTemplate(id: string, template: any): Promise<void> {
    await this.cacheManager.set(CACHE_KEYS.TEMPLATE(id), template, CACHE_TTL.TEMPLATE);
  }

  /**
   * Get template by entity type
   */
  async getTemplateByEntity(entityType: string, version?: number): Promise<any | null> {
    return this.cacheManager.get(CACHE_KEYS.TEMPLATE_BY_ENTITY(entityType, version));
  }

  /**
   * Set template by entity type
   */
  async setTemplateByEntity(entityType: string, template: any, version?: number): Promise<void> {
    await this.cacheManager.set(
      CACHE_KEYS.TEMPLATE_BY_ENTITY(entityType, version),
      template,
      CACHE_TTL.TEMPLATE,
    );
  }

  /**
   * Get instance from cache
   */
  async getInstance(id: string): Promise<any | null> {
    return this.cacheManager.get(CACHE_KEYS.INSTANCE(id));
  }

  /**
   * Set instance in cache
   */
  async setInstance(id: string, instance: any): Promise<void> {
    await this.cacheManager.set(CACHE_KEYS.INSTANCE(id), instance, CACHE_TTL.INSTANCE);
  }

  /**
   * Get instances by entity
   */
  async getInstancesByEntity(entityType: string, entityId: string): Promise<any[] | null> {
    return this.cacheManager.get(CACHE_KEYS.INSTANCE_BY_ENTITY(entityType, entityId));
  }

  /**
   * Set instances by entity
   */
  async setInstancesByEntity(entityType: string, entityId: string, instances: any[]): Promise<void> {
    await this.cacheManager.set(
      CACHE_KEYS.INSTANCE_BY_ENTITY(entityType, entityId),
      instances,
      CACHE_TTL.INSTANCE,
    );
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: string): Promise<any[] | null> {
    return this.cacheManager.get(CACHE_KEYS.PENDING_APPROVALS(userId));
  }

  /**
   * Set pending approvals for user
   */
  async setPendingApprovals(userId: string, approvals: any[]): Promise<void> {
    await this.cacheManager.set(CACHE_KEYS.PENDING_APPROVALS(userId), approvals, CACHE_TTL.PENDING_APPROVALS);
  }

  /**
   * Get analytics data
   */
  async getAnalytics(templateId: string, period: string): Promise<any | null> {
    return this.cacheManager.get(CACHE_KEYS.ANALYTICS(templateId, period));
  }

  /**
   * Set analytics data
   */
  async setAnalytics(templateId: string, period: string, data: any): Promise<void> {
    await this.cacheManager.set(
      CACHE_KEYS.ANALYTICS(templateId, period),
      data,
      CACHE_TTL.ANALYTICS,
    );
  }

  /**
   * Invalidate template cache
   */
  async invalidateTemplate(id: string): Promise<void> {
    await this.cacheManager.del(CACHE_KEYS.TEMPLATE(id));
  }

  /**
   * Invalidate all templates for entity type
   */
  async invalidateTemplatesByEntity(entityType: string): Promise<void> {
    await this.cacheManager.delPattern(`wf:template_entity:${entityType}:*`);
  }

  /**
   * Invalidate instance cache
   */
  async invalidateInstance(id: string): Promise<void> {
    await this.cacheManager.del(CACHE_KEYS.INSTANCE(id));
  }

  /**
   * Invalidate instances for entity
   */
  async invalidateInstancesByEntity(entityType: string, entityId: string): Promise<void> {
    await this.cacheManager.del(CACHE_KEYS.INSTANCE_BY_ENTITY(entityType, entityId));
  }

  /**
   * Invalidate user pending approvals
   */
  async invalidatePendingApprovals(userId: string): Promise<void> {
    await this.cacheManager.del(CACHE_KEYS.PENDING_APPROVALS(userId));
  }

  /**
   * Invalidate all workflow caches
   */
  async invalidateAll(): Promise<void> {
    await this.cacheManager.delPattern('wf:*');
  }
}
