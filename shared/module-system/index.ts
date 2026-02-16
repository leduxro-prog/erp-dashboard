/**
 * CYPHER ERP Module System
 * Central export point for module framework
 *
 * Provides:
 * - ICypherModule interface (contract for all modules)
 * - Module context types and dependencies
 * - ModuleRegistry (lifecycle and dependency management)
 * - ModuleLoader (auto-discovery of modules)
 *
 * @example
 * // In your application startup
 * import {
 *   ICypherModule,
 *   IModuleContext,
 *   ModuleRegistry,
 *   ModuleLoader,
 * } from './shared/module-system';
 *
 * // Load and register modules
 * const loader = new ModuleLoader();
 * const modules = await loader.loadModules('./modules');
 *
 * const registry = ModuleRegistry.getInstance();
 * for (const module of modules) {
 *   registry.register(module);
 * }
 *
 * // Initialize and start
 * await registry.initializeAll(context);
 * await registry.startAll();
 *
 * // Mount routers
 * for (const [name, module] of registry.getAllModules()) {
 *   app.use(\`/api/v1/\${name}\`, module.getRouter());
 * }
 */

// Interfaces and types
export type {
  IEventBus,
  ICacheManager,
  IFeatureFlagService,
  IApiClientFactory,
  IModuleContext,
  ICypherModule,
  IHealthStatus,
  IModuleHealth,
  IModuleMetrics,
  ISystemHealth,
  ISystemMetrics,
} from './module.interface';

// Registry and Loader
export { ModuleRegistry } from './module-registry';
export { ModuleLoader } from './module-loader';
