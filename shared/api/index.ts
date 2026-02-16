/**
 * API Integration Module Exports
 *
 * Central hub for all external API integrations with:
 * - Generic API client with resilience patterns
 * - Factory pattern for client management
 * - Webhook handling
 * - Rate limiting
 * - Circuit breaker protection
 * - API registry
 */

// API Client
export { ApiClient } from './api-client';
export type {
  ApiResponse,
  ApiRequest,
  BatchResponse,
  ApiClientHealth,
  ApiClientMetrics,
  IApiClient,
  ApiClientConfig,
} from './api-client';

// API Client Factory
export { ApiClientFactory } from './api-client-factory';
export type { ApiHealthReport } from './api-client-factory';

// Rate Limiter
export { TokenBucketRateLimiter } from './rate-limiter';
export type { TokenBucketConfig, RateLimiterMetrics } from './rate-limiter';

// API Registry
export { ApiRegistry } from './api-registry';
export type { ApiAuthConfig, ApiConfig } from './api-registry';

// Webhook Manager
export { WebhookManager } from './webhook-manager';
export type { WebhookResult, WebhookHandler, WebhookValidation, DeadLetterEntry } from './webhook-manager';
