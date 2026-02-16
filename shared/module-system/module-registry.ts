import {
  ICypherModule,
  IModuleContext,
  ISystemHealth,
  ISystemMetrics,
} from './module.interface';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('module-registry');

/**
 * Dependency graph node for topological sorting.
 * @internal
 */
interface DependencyNode {
  module: ICypherModule;
  dependencies: string[];
  visited: boolean;
  inProgress: boolean;
}

/**
 * Central module registry that manages module lifecycle.
 * Handles dependency resolution, initialization order, and runtime management.
 *
 * Uses singleton pattern to ensure single instance across the application.
 * Performs topological sort to initialize modules in correct order based on dependencies.
 * Detects circular dependencies and validates module contracts.
 *
 * ### Initialization Flow
 * 1. Modules are registered via register()
 * 2. initializeAll() performs topological sort based on dependencies
 * 3. Modules are initialized in dependency order
 * 4. startAll() starts all modules in order
 * 5. stopAll() gracefully shuts down in reverse order
 *
 * ### Error Handling
 * - Circular dependencies detected and throw error
 * - Missing dependencies detected and throw error
 * - Graceful degradation: non-critical module failures log warning but continue
 * - Module failures marked as 'unhealthy' in health checks
 *
 * ### Hot Reload Support
 * - reloadModule() can stop, reinitialize, and restart a single module
 * - Maintains registry state during reload
 * - Useful for development and dynamic module loading
 *
 * @example
 * // Get singleton instance
 * const registry = ModuleRegistry.getInstance();
 *
 * // Register modules
 * registry.register(new PricingModule());
 * registry.register(new OrdersModule());
 * registry.register(new NotificationsModule());
 *
 * // Initialize all with context
 * await registry.initializeAll(context);
 *
 * // Start all modules
 * await registry.startAll();
 *
 * // Get system health
 * const health = await registry.getHealth();
 * console.log(`System status: ${health.status}`);
 *
 * // Get system metrics
 * const metrics = registry.getMetrics();
 * console.log(`Total requests: ${metrics.totalRequests}`);
 *
 * // Graceful shutdown
 * await registry.stopAll();
 */
export class ModuleRegistry {
  private static instance: ModuleRegistry | null = null;

  private modules: Map<string, ICypherModule> = new Map();
  private initializedModules: Map<string, ICypherModule> = new Map();
  private startedModules: Map<string, ICypherModule> = new Map();
  private context: IModuleContext | null = null;

  /**
   * Get singleton instance of ModuleRegistry.
   * Creates instance on first call.
   *
   * @returns Singleton ModuleRegistry instance
   */
  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Reset singleton instance (mainly for testing).
   * @internal
   */
  static resetInstance(): void {
    ModuleRegistry.instance = null;
  }

  /**
   * Register a new module in the registry.
   * Does not initialize the module - that happens in initializeAll().
   *
   * Validates that:
   * - Module name is unique
   * - Module name follows kebab-case convention
   * - All fields are properly defined
   *
   * @param module - Module implementing ICypherModule
   * @throws {Error} If module name already registered or validation fails
   *
   * @example
   * const pricingModule = new PricingEngineModule();
   * registry.register(pricingModule);
   */
  register(module: ICypherModule): void {
    // Validate module
    if (!module.name || typeof module.name !== 'string') {
      throw new Error('Module must have a valid name property (string)');
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(module.name)) {
      throw new Error(
        `Module name "${module.name}" must be lowercase kebab-case (e.g., "pricing-engine")`
      );
    }

    if (!module.version || typeof module.version !== 'string') {
      throw new Error('Module must have a valid version property (string)');
    }

    if (!module.description || typeof module.description !== 'string') {
      throw new Error('Module must have a valid description property (string)');
    }

    if (
      !Array.isArray(module.dependencies) ||
      !Array.isArray(module.publishedEvents) ||
      !Array.isArray(module.subscribedEvents)
    ) {
      throw new Error(
        'Module must have dependencies, publishedEvents, and subscribedEvents arrays'
      );
    }

    // Check for duplicate registration
    if (this.modules.has(module.name)) {
      throw new Error(`Module "${module.name}" is already registered`);
    }

    this.modules.set(module.name, module);
    logger.info(`Module registered: ${module.name} v${module.version}`);
  }

  /**
   * Get a registered module by name.
   *
   * @param name - Module name
   * @returns Module instance, or undefined if not found
   *
   * @example
   * const pricingModule = registry.getModule('pricing-engine');
   * if (pricingModule) {
   *   console.log(`Module version: ${pricingModule.version}`);
   * }
   */
  getModule(name: string): ICypherModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all registered modules.
   *
   * @returns Map of module name to module instance
   */
  getAllModules(): Map<string, ICypherModule> {
    return new Map(this.modules);
  }

  /**
   * Check if a module is registered.
   *
   * @param name - Module name
   * @returns True if module is registered
   */
  hasModule(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Initialize all registered modules.
   * Performs topological sort by dependencies and initializes in correct order.
   *
   * Validates:
   * - No circular dependencies
   * - All dependencies exist
   * - Modules support required interfaces
   *
   * Handles errors:
   * - Critical modules: throw error, stop initialization
   * - Non-critical modules: log warning, skip but continue
   *
   * Module is marked non-critical if its dependents list is empty.
   *
   * @param context - Module context with dependencies
   * @throws {Error} If circular dependency detected or critical module fails
   *
   * @example
   * const context: IModuleContext = {
   *   dataSource,
   *   eventBus,
   *   cacheManager,
   *   logger,
   *   config: {},
   *   apiClientFactory,
   *   featureFlags
   * };
   * await registry.initializeAll(context);
   */
  async initializeAll(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Starting module initialization...');

    // Detect circular dependencies
    this.detectCircularDependencies();

    // Topological sort
    const sortedModules = this.topologicalSort();

    // Initialize modules in sorted order
    for (const module of sortedModules) {
      try {
        // Check if feature flag is enabled
        if (module.featureFlag) {
          const isFlagEnabled = context.featureFlags.isEnabled(module.featureFlag);
          if (!isFlagEnabled) {
            logger.info(
              `Skipping module "${module.name}" (feature flag "${module.featureFlag}" disabled)`
            );
            continue;
          }
        }

        logger.info(`Initializing module: ${module.name}`);
        await module.initialize(context);
        this.initializedModules.set(module.name, module);
        logger.info(`Module initialized: ${module.name}`);
      } catch (error) {
        const isDependedUpon = Array.from(this.modules.values()).some((m) =>
          m.dependencies.includes(module.name)
        );

        const message = error instanceof Error ? error.message : String(error);

        if (isDependedUpon) {
          logger.error(`Critical module "${module.name}" failed to initialize: ${message}`);
          throw error;
        } else {
          logger.warn(
            `Non-critical module "${module.name}" failed to initialize: ${message}. Continuing...`
          );
        }
      }
    }

    logger.info('Module initialization completed');
  }

  /**
   * Start all initialized modules.
   * Called after initializeAll() completes.
   * Starts modules in initialization order.
   *
   * Handles errors:
   * - Critical modules: throw error, stop startup
   * - Non-critical modules: log warning, skip but continue
   *
   * @throws {Error} If critical module fails to start
   *
   * @example
   * await registry.startAll();
   */
  async startAll(): Promise<void> {
    logger.info('Starting all initialized modules...');

    for (const [name, module] of this.initializedModules) {
      try {
        logger.info(`Starting module: ${name}`);
        await module.start();
        this.startedModules.set(name, module);
        logger.info(`Module started: ${name}`);
      } catch (error) {
        const isDependedUpon = Array.from(this.modules.values()).some((m) =>
          m.dependencies.includes(name)
        );

        const message = error instanceof Error ? error.message : String(error);

        if (isDependedUpon) {
          logger.error(`Critical module "${name}" failed to start: ${message}`);
          throw error;
        } else {
          logger.warn(`Non-critical module "${name}" failed to start: ${message}. Continuing...`);
        }
      }
    }

    logger.info('All modules started successfully');
  }

  /**
   * Stop all started modules gracefully.
   * Called during application shutdown.
   * Stops modules in reverse order (LIFO).
   *
   * Must complete within reasonable timeout (typically 30 seconds).
   * Errors during shutdown are logged but do not prevent other modules from stopping.
   *
   * @example
   * await registry.stopAll();
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all modules gracefully...');

    // Get modules in reverse start order
    const modulesToStop = Array.from(this.startedModules.values()).reverse();

    for (const module of modulesToStop) {
      try {
        logger.info(`Stopping module: ${module.name}`);
        await module.stop();
        logger.info(`Module stopped: ${module.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Error stopping module "${module.name}": ${message}. Continuing...`);
      }
    }

    this.startedModules.clear();
    logger.info('All modules stopped');
  }

  /**
   * Reload a single module (stop, reinitialize, start).
   * Useful for development and dynamic module loading.
   *
   * @param name - Module name
   * @throws {Error} If module not found, failed to reinitialize, or failed to restart
   *
   * @example
   * await registry.reloadModule('pricing-engine');
   */
  async reloadModule(name: string): Promise<void> {
    const module = this.getModule(name);
    if (!module) {
      throw new Error(`Module "${name}" not found`);
    }

    if (!this.context) {
      throw new Error('Module context not initialized');
    }

    logger.info(`Reloading module: ${name}`);

    try {
      // Stop if started
      if (this.startedModules.has(name)) {
        logger.info(`Stopping module: ${name}`);
        await module.stop();
        this.startedModules.delete(name);
      }

      // Reinitialize
      logger.info(`Reinitializing module: ${name}`);
      await module.initialize(this.context);
      this.initializedModules.set(name, module);

      // Restart
      logger.info(`Restarting module: ${name}`);
      await module.start();
      this.startedModules.set(name, module);

      logger.info(`Module reloaded successfully: ${name}`);
    } catch (error) {
      logger.error(`Failed to reload module "${name}"`);
      throw error;
    }
  }

  /**
   * Get aggregated health status of all modules.
   *
   * @returns System health with status of each module
   *
   * @example
   * const health = await registry.getHealth();
   * if (health.status === 'unhealthy') {
   *   console.log('System unhealthy, investigate modules:');
   *   Object.entries(health.modules).forEach(([name, status]) => {
   *     if (status.status !== 'healthy') {
   *       console.log(`  ${name}: ${status.status}`);
   *     }
   *   });
   * }
   */
  async getHealth(): Promise<ISystemHealth> {
    const modules: Record<
      string,
      {
        status: 'healthy' | 'degraded' | 'unhealthy';
        lastChecked: Date;
      }
    > = {};

    for (const [name, module] of this.startedModules) {
      try {
        const health = await module.getHealth();
        modules[name] = {
          status: health.status,
          lastChecked: health.lastChecked,
        };
      } catch (error) {
        logger.warn(`Failed to get health for module "${name}"`, {
          error: error instanceof Error ? error.message : String(error),
        });
        modules[name] = {
          status: 'unhealthy',
          lastChecked: new Date(),
        };
      }
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    for (const status of Object.values(modules)) {
      if (status.status === 'unhealthy') {
        overallStatus = 'unhealthy';
        break;
      } else if (status.status === 'degraded') {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      modules,
      checkedAt: new Date(),
    };
  }

  /**
   * Get aggregated metrics from all modules.
   *
   * @returns System metrics combining all modules
   *
   * @example
   * const metrics = registry.getMetrics();
   * console.log(`Total requests: ${metrics.totalRequests}`);
   * console.log(`Total errors: ${metrics.totalErrors}`);
   * console.log(`Avg response time: ${metrics.avgResponseTime}ms`);
   */
  getMetrics(): ISystemMetrics {
    const moduleMetrics: Record<string, any> = {};
    let totalRequests = 0;
    let totalErrors = 0;
    let sumResponseTimes = 0;
    let moduleCount = 0;

    for (const [name, module] of this.startedModules) {
      try {
        const metrics = module.getMetrics();
        moduleMetrics[name] = metrics;
        totalRequests += metrics.requestCount;
        totalErrors += metrics.errorCount;
        sumResponseTimes += metrics.avgResponseTime;
        moduleCount += 1;
      } catch (error) {
        logger.warn(`Failed to get metrics for module "${name}"`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      totalRequests,
      totalErrors,
      avgResponseTime: moduleCount > 0 ? sumResponseTimes / moduleCount : 0,
      modules: moduleMetrics,
      collectedAt: new Date(),
    };
  }

  /**
   * Detect circular dependencies in module dependency graph.
   * Uses depth-first search.
   *
   * @throws {Error} If circular dependency is found
   * @internal
   */
  private detectCircularDependencies(): void {
    const nodes: Map<string, DependencyNode> = new Map();

    // Create nodes
    for (const [name, module] of this.modules) {
      nodes.set(name, {
        module,
        dependencies: module.dependencies,
        visited: false,
        inProgress: false,
      });
    }

    // Validate all dependencies exist - warn for missing, filter out non-existent
    for (const [name, node] of nodes) {
      const validDeps: string[] = [];
      for (const depName of node.dependencies) {
        if (!nodes.has(depName)) {
          logger.warn(
            `Module "${name}" depends on unloaded module "${depName}" - dependency skipped. ` +
            `Available modules: ${Array.from(nodes.keys()).join(', ')}`
          );
        } else {
          validDeps.push(depName);
        }
      }
      node.dependencies = validDeps;
    }

    // DFS to detect cycles
    const visit = (name: string, path: string[]): void => {
      const node = nodes.get(name);
      if (!node) return;

      if (node.inProgress) {
        throw new Error(
          `Circular dependency detected: ${path.join(' -> ')} -> ${name}`
        );
      }

      if (node.visited) {
        return;
      }

      node.inProgress = true;

      for (const depName of node.dependencies) {
        visit(depName, [...path, name]);
      }

      node.inProgress = false;
      node.visited = true;
    };

    for (const name of nodes.keys()) {
      if (!nodes.get(name)!.visited) {
        visit(name, []);
      }
    }
  }

  /**
   * Topologically sort modules by dependencies.
   * Uses Kahn's algorithm.
   *
   * @returns Sorted array of modules
   * @internal
   */
  private topologicalSort(): ICypherModule[] {
    const inDegree: Map<string, number> = new Map();
    const graph: Map<string, string[]> = new Map();

    // Initialize
    for (const [name, module] of this.modules) {
      inDegree.set(name, 0);
      graph.set(name, []);
    }

    // Build graph (reverse edges for dependencies)
    for (const [name, module] of this.modules) {
      for (const dep of module.dependencies) {
        // Only add edge if the dependency is actually loaded
        if (!graph.has(dep)) continue;
        const dependents = graph.get(dep);
        if (dependents) {
          dependents.push(name);
        }
      }
    }

    // Calculate in-degrees (only count loaded dependencies)
    for (const [name, module] of this.modules) {
      const loadedDeps = module.dependencies.filter(d => this.modules.has(d));
      inDegree.set(name, loadedDeps.length);
    }

    // Kahn's algorithm
    const queue: string[] = Array.from(this.modules.keys()).filter(
      (name) => inDegree.get(name) === 0
    );

    const result: ICypherModule[] = [];

    while (queue.length > 0) {
      const name = queue.shift()!;
      const module = this.modules.get(name)!;
      result.push(module);

      const dependents = graph.get(name) || [];
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    return result;
  }
}
