import path from 'path';
import fs from 'fs';
import { ICypherModule } from './module.interface';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('module-loader');

/**
 * Discovers and dynamically loads CYPHER ERP modules from the modules/ directory.
 * Each module folder must have src/index.ts exporting an ICypherModule implementation.
 *
 * ### Module Structure
 * ```
 * modules/
 * ├── pricing-engine/
 * │   ├── src/
 * │   │   ├── domain/
 * │   │   ├── application/
 * │   │   ├── infrastructure/
 * │   │   ├── api/
 * │   │   └── index.ts          <- Must export ICypherModule
 * │   └── tests/
 * ├── orders/
 * │   └── src/
 * │       └── index.ts          <- Must export ICypherModule
 * └── ...
 * ```
 *
 * ### Export Requirements
 * Each module's src/index.ts must export a default export or named export
 * of a class/function that implements ICypherModule.
 *
 * Common patterns:
 * ```typescript
 * // Pattern 1: Default export (preferred)
 * export default class OrdersModule implements ICypherModule { ... }
 *
 * // Pattern 2: Named export
 * export class OrdersModule implements ICypherModule { ... }
 * export const createOrdersModule = () => new OrdersModule();
 *
 * // Pattern 3: Factory function
 * export default (): ICypherModule => new OrdersModule();
 * ```
 *
 * ### Feature Flag Support
 * Modules with disabled feature flags are still loaded but can be
 * skipped during initialization via ModuleRegistry.
 *
 * ### Error Handling
 * - Failed module loads log warning and are skipped
 * - Missing index.ts files are detected and logged
 * - Invalid module implementations are detected and logged
 * - Loader continues even if some modules fail
 *
 * @example
 * // In your application startup
 * import { ModuleLoader } from './shared/module-system';
 *
 * const loader = new ModuleLoader();
 * const modules = await loader.loadModules('/path/to/modules');
 * console.log(`Loaded ${modules.length} modules`);
 *
 * for (const module of modules) {
 *   console.log(`- ${module.name} v${module.version}`);
 * }
 */
export class ModuleLoader {
  /**
   * Load all modules from the modules directory.
   *
   * Scans the modules directory and attempts to load each module.
   * Skips modules with disabled feature flags (but still loads them).
   * Logs all activities (loaded, skipped, failed).
   *
   * @param modulesPath - Absolute path to modules directory
   * @returns Array of loaded modules
   * @throws {Error} If modulesPath is invalid or inaccessible
   *
   * @example
   * const loader = new ModuleLoader();
   * const modules = await loader.loadModules('/app/modules');
   * // Returns array of ICypherModule instances
   */
  async loadModules(modulesPath: string): Promise<ICypherModule[]> {
    // Validate path exists
    if (!fs.existsSync(modulesPath)) {
      throw new Error(`Modules directory not found: ${modulesPath}`);
    }

    const stats = fs.statSync(modulesPath);
    if (!stats.isDirectory()) {
      throw new Error(`Modules path is not a directory: ${modulesPath}`);
    }

    logger.info(`Loading modules from: ${modulesPath}`);

    const loadedModules: ICypherModule[] = [];
    const moduleFolders = this.getModuleFolders(modulesPath);

    logger.info(`Found ${moduleFolders.length} module folder(s): ${moduleFolders.join(', ')}`);

    for (const moduleName of moduleFolders) {
      try {
        const modulePath = path.join(modulesPath, moduleName);
        const module = await this.loadModule(modulePath, moduleName);

        if (module) {
          loadedModules.push(module);
          logger.info(
            `Module loaded: ${module.name} v${module.version} - ${module.description}`
          );
        } else {
          logger.warn(`Module ${moduleName}: exported value is not a valid ICypherModule`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to load module "${moduleName}": ${message}`);
      }
    }

    logger.info(`Module loading complete: ${loadedModules.length} modules loaded successfully`);

    return loadedModules;
  }

  /**
   * Load a single module from a directory.
   *
   * Attempts to load src/index.ts and extract ICypherModule instance.
   * Handles various export patterns (default, named, factory).
   *
   * @param modulePath - Path to module directory
   * @param moduleName - Module folder name (for logging)
   * @returns Module instance or null if not found/invalid
   * @internal
   */
  private async loadModule(modulePath: string, moduleName: string): Promise<ICypherModule | null> {
    // Check for both .js (compiled/production) and .ts (development)
    const indexPathJs = path.join(modulePath, 'src', 'index.js');
    const indexPathTs = path.join(modulePath, 'src', 'index.ts');
    const indexPath = fs.existsSync(indexPathJs) ? indexPathJs : indexPathTs;

    // Check if index file exists
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Module index file not found: ${indexPath}`);
    }

    try {
      // Dynamically import the module
      const exported = await import(indexPath);

      // Try to extract module instance
      // Pattern 1: Default export
      if (exported.default) {
        return this.instantiateModule(exported.default, moduleName);
      }

      // Pattern 2: Named export matching module name or common patterns
      const moduleNameCamelCase = this.kebabToCamelCase(moduleName);
      const moduleClassName = this.kebabToPascalCase(moduleName);

      if (exported[moduleClassName]) {
        return this.instantiateModule(exported[moduleClassName], moduleName);
      }

      if (exported[moduleNameCamelCase]) {
        return this.instantiateModule(exported[moduleNameCamelCase], moduleName);
      }

      // Pattern 3: Factory function named 'create' + module name
      const factoryName = `create${moduleClassName}`;
      if (exported[factoryName] && typeof exported[factoryName] === 'function') {
        const instance = await exported[factoryName]();
        this.validateModule(instance);
        return instance;
      }

      // Pattern 4: First export that looks like a module
      for (const [key, value] of Object.entries(exported)) {
        if (key !== 'default' && this.looksLikeModule(value)) {
          return this.instantiateModule(value, moduleName);
        }
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error loading module index: ${message}`);
    }
  }

  /**
   * Instantiate a module class or function.
   * Handles both class constructors and factory functions.
   *
   * @param exported - Exported value (class or factory function)
   * @param moduleName - Module name for logging
   * @returns Module instance
   * @internal
   */
  private instantiateModule(exported: unknown, moduleName: string): ICypherModule | null {
    if (!exported) {
      return null;
    }

    // Already an instance
    if (this.looksLikeModule(exported)) {
      this.validateModule(exported);
      return exported as ICypherModule;
    }

    // Try to call as factory function
    if (typeof exported === 'function') {
      try {
        const instance = (exported as Function)();
        if (this.looksLikeModule(instance)) {
          this.validateModule(instance);
          return instance as ICypherModule;
        }
      } catch (error) {
        // Try as class constructor
      }
    }

    // Try as class constructor
    if (typeof exported === 'function') {
      try {
        const instance = new (exported as any)();
        if (this.looksLikeModule(instance)) {
          this.validateModule(instance);
          return instance as ICypherModule;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to instantiate module ${moduleName}: ${message}`
        );
      }
    }

    return null;
  }

  /**
   * Check if a value looks like an ICypherModule.
   * Performs duck-typing check for required properties.
   *
   * @param value - Value to check
   * @returns True if value has required module properties
   * @internal
   */
  private looksLikeModule(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const obj = value as any;

    return (
      typeof obj.name === 'string' &&
      typeof obj.version === 'string' &&
      typeof obj.description === 'string' &&
      Array.isArray(obj.dependencies) &&
      Array.isArray(obj.publishedEvents) &&
      Array.isArray(obj.subscribedEvents) &&
      typeof obj.initialize === 'function' &&
      typeof obj.start === 'function' &&
      typeof obj.stop === 'function' &&
      typeof obj.getHealth === 'function' &&
      typeof obj.getRouter === 'function' &&
      typeof obj.getMetrics === 'function'
    );
  }

  /**
   * Validate that a module instance properly implements ICypherModule.
   * Checks required properties and methods.
   *
   * @param module - Module to validate
   * @throws {Error} If module is invalid
   * @internal
   */
  private validateModule(module: unknown): void {
    if (!this.looksLikeModule(module)) {
      throw new Error(
        'Module must implement ICypherModule interface with all required properties and methods'
      );
    }

    const m = module as any;

    // Validate name
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(m.name)) {
      throw new Error(
        `Module name "${m.name}" must be lowercase kebab-case (e.g., "pricing-engine")`
      );
    }

    // Validate version
    if (!/^\d+\.\d+\.\d+/.test(m.version)) {
      throw new Error(
        `Module version "${m.version}" must follow semantic versioning (e.g., "1.0.0")`
      );
    }

    // Validate arrays are actually arrays
    if (!Array.isArray(m.dependencies)) {
      throw new Error(`Module dependencies must be an array, got ${typeof m.dependencies}`);
    }

    if (!Array.isArray(m.publishedEvents)) {
      throw new Error(`Module publishedEvents must be an array, got ${typeof m.publishedEvents}`);
    }

    if (!Array.isArray(m.subscribedEvents)) {
      throw new Error(`Module subscribedEvents must be an array, got ${typeof m.subscribedEvents}`);
    }

    // Validate feature flag if present
    if (m.featureFlag && typeof m.featureFlag !== 'string') {
      throw new Error(`Module featureFlag must be a string if specified`);
    }
  }

  /**
   * Get all module folders in the modules directory.
   * Ignores non-directory entries and dot-folders.
   *
   * @param modulesPath - Path to modules directory
   * @returns Array of module folder names
   * @internal
   */
  private getModuleFolders(modulesPath: string): string[] {
    try {
      const entries = fs.readdirSync(modulesPath, { withFileTypes: true });

      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read modules directory: ${message}`);
    }
  }

  /**
   * Convert kebab-case to camelCase.
   * 'pricing-engine' -> 'pricingEngine'
   *
   * @param kebab - Kebab-case string
   * @returns camelCase string
   * @internal
   */
  private kebabToCamelCase(kebab: string): string {
    return kebab
      .split('-')
      .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
  }

  /**
   * Convert kebab-case to PascalCase.
   * 'pricing-engine' -> 'PricingEngine'
   *
   * @param kebab - Kebab-case string
   * @returns PascalCase string
   * @internal
   */
  private kebabToPascalCase(kebab: string): string {
    return kebab
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}
