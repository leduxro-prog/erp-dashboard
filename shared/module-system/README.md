# CYPHER ERP Module System

A comprehensive, enterprise-grade plugin architecture for CYPHER ERP that enables modular development, easy module discovery, and seamless integration.

## Overview

The module system provides:

- **Auto-discovery**: Automatically finds and loads modules from the `modules/` directory
- **Dependency management**: Topological sort ensures modules initialize in correct order
- **Lifecycle management**: Initialize → Start → Stop with graceful shutdown
- **Health monitoring**: Per-module and system-wide health checks
- **Metrics collection**: Request counts, error rates, response times
- **Feature flags**: Enable/disable modules at runtime
- **Event-driven architecture**: Pub/sub messaging via Redis
- **Zero type-safety issues**: Full TypeScript support with no `as any` casts

## Module Structure

Each module follows a standard directory structure:

```
modules/
├── pricing-engine/
│   ├── src/
│   │   ├── domain/                 # Business logic
│   │   │   ├── entities/
│   │   │   ├── repositories/
│   │   │   └── services/
│   │   ├── application/            # Use-cases
│   │   │   ├── use-cases/
│   │   │   ├── ports/
│   │   │   ├── dtos/
│   │   │   └── errors/
│   │   ├── infrastructure/         # Database & external services
│   │   │   ├── entities/           # TypeORM entities
│   │   │   ├── repositories/
│   │   │   └── composition-root.ts # Dependency injection
│   │   ├── api/                    # HTTP layer
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── validators/
│   │   ├── pricing-module.ts       # ICypherModule implementation
│   │   └── index.ts                # Public exports
│   ├── tests/
│   │   ├── domain/
│   │   ├── application/
│   │   └── api/
│   ├── README.md
│   └── package.json
├── orders/
│   └── src/
│       ├── ...
│       ├── orders-module.ts        # Module implementation
│       └── index.ts
└── ...
```

## Creating a New Module

### Quick Start

Use the module generator script:

```bash
npx ts-node scripts/create-module.ts --name=shipping --description="Shipping management"
```

This creates a complete module scaffold with all necessary files and TODO comments.

### Manual Creation

1. Create module directory: `modules/your-module/`

2. Create `src/index.ts` that exports your module:

```typescript
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '../../../shared/module-system';
import { Router } from 'express';

export default class YourModule implements ICypherModule {
  readonly name = 'your-module';
  readonly version = '1.0.0';
  readonly description = 'Your module description';
  readonly dependencies = [];
  readonly publishedEvents = ['event.published'];
  readonly subscribedEvents = ['event.subscribed'];
  readonly featureFlag?: string;

  async initialize(context: IModuleContext): Promise<void> {
    // Initialize databases, caches, composition root
  }

  async start(): Promise<void> {
    // Subscribe to events, start workers
  }

  async stop(): Promise<void> {
    // Graceful shutdown
  }

  async getHealth(): Promise<IModuleHealth> {
    // Check database, cache, dependencies
  }

  getRouter(): Router {
    // Return Express router
  }

  getMetrics(): IModuleMetrics {
    // Return collected metrics
  }
}
```

## Module Lifecycle

### 1. Registration

During application startup, modules are discovered and registered:

```typescript
const loader = new ModuleLoader();
const modules = await loader.loadModules('./modules');

const registry = ModuleRegistry.getInstance();
for (const module of modules) {
  registry.register(module);
}
```

The loader:
- Scans `modules/` directory for module folders
- Loads `src/index.ts` from each module
- Validates module implements `ICypherModule`
- Skips modules with disabled feature flags

### 2. Initialization

Modules are initialized in dependency order (topological sort):

```typescript
const context = await createModuleContext(...);
await registry.initializeAll(context);
```

For each module:
1. Check feature flag is enabled
2. Call `module.initialize(context)`
3. Mark module as initialized
4. On error: throw if critical, warn if non-critical

Dependencies:
- Module with no dependents = non-critical
- Module with dependents = critical
- Missing dependency → Error
- Circular dependency → Error

### 3. Startup

Modules are started in initialization order:

```typescript
await registry.startAll();
```

For each module:
1. Call `module.start()`
2. Mark module as started
3. On error: throw if critical, warn if non-critical

### 4. Runtime

Module routers are mounted to Express:

```typescript
for (const [name, module] of registry.getAllModules()) {
  app.use(`/api/v1/${name}`, module.getRouter());
}
```

Routes at `/api/v1/{module-name}/*` are handled by each module.

### 5. Shutdown

Modules are stopped in reverse order (LIFO):

```typescript
await registry.stopAll();
```

For each module (reverse order):
1. Call `module.stop()`
2. Log any errors but continue
3. Module errors don't prevent shutdown of other modules

## Module Context

Modules receive a context object with dependencies:

```typescript
interface IModuleContext {
  dataSource: DataSource;           // TypeORM database access
  eventBus: IEventBus;              // Redis pub/sub
  cacheManager: ICacheManager;      // Multi-layer caching
  logger: Logger;                   // Module-scoped logger
  config: Record<string, string>;   // Environment variables
  apiClientFactory: IApiClientFactory; // HTTP client factory
  featureFlags: IFeatureFlagService; // Feature toggle service
}
```

Example usage:

```typescript
async initialize(context: IModuleContext): Promise<void> {
  this.logger = context.logger; // Module-scoped logger
  const data = await context.dataSource.query('SELECT...');
  await context.cacheManager.set('key', value, 3600);
  this.client = await context.apiClientFactory.getServiceClient('woocommerce');
}
```

## Events

Modules communicate via events:

```typescript
// Subscribe to event
await context.eventBus.subscribe('order.created', (data) => {
  // Handle order creation
});

// Publish event
await context.eventBus.publish('price.updated', {
  productId: 123,
  newPrice: 99.99
});
```

Naming convention: `entity.action` (e.g., `order.created`, `inventory.updated`)

## Health Checks

System health endpoint: `GET /api/v1/system/modules`

Returns:

```json
{
  "status": "healthy",
  "modules": {
    "pricing-engine": {
      "status": "healthy",
      "lastChecked": "2025-02-07T10:30:00Z"
    },
    "orders": {
      "status": "degraded",
      "lastChecked": "2025-02-07T10:30:00Z"
    }
  },
  "checkedAt": "2025-02-07T10:30:00Z"
}
```

Module health:

```typescript
async getHealth(): Promise<IModuleHealth> {
  return {
    status: 'healthy', // 'healthy' | 'degraded' | 'unhealthy'
    details: {
      database: { status: 'up', latency: 12 },
      cache: { status: 'up', latency: 3 },
      externalService: { status: 'down', message: 'Connection timeout' }
    },
    lastChecked: new Date()
  };
}
```

## Metrics

System metrics endpoint: `GET /api/v1/system/metrics`

Returns:

```json
{
  "totalRequests": 1500,
  "totalErrors": 2,
  "avgResponseTime": 145,
  "modules": {
    "pricing-engine": {
      "requestCount": 500,
      "errorCount": 1,
      "avgResponseTime": 120,
      "activeWorkers": 2,
      "cacheHitRate": 92,
      "eventCount": {
        "published": 50,
        "received": 100
      }
    }
  },
  "collectedAt": "2025-02-07T10:30:00Z"
}
```

Module metrics:

```typescript
getMetrics(): IModuleMetrics {
  return {
    requestCount: 500,      // Total requests handled
    errorCount: 1,          // Total errors
    avgResponseTime: 120,   // Average response time (ms)
    activeWorkers: 2,       // Active background workers
    cacheHitRate: 92,       // Cache hit rate (0-100)
    eventCount: {
      published: 50,        // Events published
      received: 100         // Events received
    }
  };
}
```

## Feature Flags

Control module loading at runtime:

```typescript
readonly featureFlag = 'enable_shipping'; // Optional flag name
```

In environment:

```
FEATURE_FLAG_ENABLE_SHIPPING=true
```

If flag is disabled:
- Module is not initialized
- Module routes are not mounted
- Module start/stop are not called
- Module is still in registry but marked as skipped

## Dependencies

Module dependencies ensure correct initialization order:

```typescript
readonly dependencies = ['orders', 'inventory'];
```

Features:
- Topological sort by dependencies
- Circular dependency detection
- Missing dependency detection
- Initialization in correct order

Example:

```
A depends on: B, C
B depends on: C
C depends on: (none)

Initialization order: C → B → A
```

## Error Handling

### Initialization Errors

- **Critical module fails**: Application startup fails
- **Non-critical module fails**: Warning logged, app continues
- Non-critical = module has no dependents

### Startup Errors

- **Critical module fails**: Application startup fails
- **Non-critical module fails**: Warning logged, app continues

### Runtime Errors

- Handled by individual modules
- Logged but don't crash application
- Health check reflects module status

### Shutdown Errors

- Logged but don't prevent shutdown
- All modules get chance to stop gracefully
- 30-second timeout, then force kill

## Performance Considerations

### Scalability

- Handles 100K+ products
- Supports 500+ concurrent clients
- Multi-layer caching (Redis L1, memory L2)
- Database connection pooling
- Event-driven for decoupling

### Module Initialization

- Parallel module loading
- Sequential but optimized initialization
- Early error detection
- Graceful degradation

### Health Checks

- Async, non-blocking
- Cached results (5-10 second TTL)
- Fails gracefully

### Metrics

- Low-overhead collection
- In-memory aggregation
- No external dependencies

## Best Practices

### 1. Module Naming

Use lowercase kebab-case:

```typescript
readonly name = 'pricing-engine';  // Good
readonly name = 'pricingEngine';   // Bad
readonly name = 'pricing_engine';  // Bad
```

### 2. Dependencies

List all dependencies explicitly:

```typescript
readonly dependencies = ['orders', 'inventory'];
```

Avoid circular dependencies. Break cycles with events instead.

### 3. Events

Use consistent naming:

```typescript
readonly publishedEvents = [
  'order.created',      // entity.action
  'order.shipped',
  'order.cancelled'
];

readonly subscribedEvents = [
  'product.deleted',    // entity.action
  'inventory.updated'
];
```

### 4. Error Handling

Always catch and log errors:

```typescript
async initialize(context: IModuleContext): Promise<void> {
  try {
    // Initialize
  } catch (error) {
    context.logger.error('Failed to initialize', { error });
    throw error; // Re-throw to fail gracefully
  }
}
```

### 5. Graceful Shutdown

Always clean up resources:

```typescript
async stop(): Promise<void> {
  try {
    // Unsubscribe, stop workers, flush caches
  } catch (error) {
    context.logger.warn('Error during shutdown', { error });
    // Don't throw - let other modules shut down
  }
}
```

### 6. Feature Flags

Use for gradual rollouts:

```typescript
readonly featureFlag = 'enable_new_pricing_engine';

// In environment:
// FEATURE_FLAG_ENABLE_NEW_PRICING_ENGINE=true (enable)
// FEATURE_FLAG_ENABLE_NEW_PRICING_ENGINE=false (disable, old pricing still runs)
```

## Module Reloading

Hot reload a module at runtime:

```typescript
const registry = ModuleRegistry.getInstance();
await registry.reloadModule('pricing-engine');
```

This:
1. Stops the module
2. Reinitializes it
3. Restarts it

Useful for:
- Development
- Configuration changes
- Emergency updates

## Testing Modules

### Unit Tests

Test domain and application layers:

```typescript
describe('PricingCalculator', () => {
  it('should calculate price with discount', () => {
    const calculator = new PricingCalculator(mockRepository);
    const price = calculator.calculate({ productId: 1, quantity: 10 });
    expect(price).toBe(99.99);
  });
});
```

### Integration Tests

Test module with real database:

```typescript
describe('Pricing Module', () => {
  let context: IModuleContext;
  let module: PricingModule;

  beforeAll(async () => {
    context = await setupTestContext();
    module = new PricingModule();
    await module.initialize(context);
  });

  it('should initialize module', async () => {
    const health = await module.getHealth();
    expect(health.status).toBe('healthy');
  });
});
```

### API Tests

Test REST endpoints:

```typescript
describe('Pricing API', () => {
  it('GET /api/v1/pricing/:id should return product pricing', async () => {
    const response = await request(app).get('/api/v1/pricing/1');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('price');
  });
});
```

## Troubleshooting

### Module not loading

Check:
1. Module folder exists in `modules/`
2. `src/index.ts` exists and exports ICypherModule
3. Module name follows kebab-case
4. No syntax errors in module code

### Initialization fails

Check:
1. Database connection working
2. All dependencies registered
3. No circular dependencies
4. Tables/migrations applied

### Health check shows unhealthy

Check:
1. Database connectivity
2. Cache/Redis connectivity
3. External service connectivity
4. Module error logs

### Module stops unexpectedly

Check:
1. Application shutdown logs
2. Module error logs
3. Timeout settings (30 seconds)
4. Unhandled exceptions in module

## API Reference

### ModuleRegistry

```typescript
// Get singleton instance
const registry = ModuleRegistry.getInstance();

// Register module
registry.register(module);

// Get module
const module = registry.getModule('pricing-engine');

// Initialize all modules
await registry.initializeAll(context);

// Start all modules
await registry.startAll();

// Stop all modules
await registry.stopAll();

// Get system health
const health = await registry.getHealth();

// Get system metrics
const metrics = registry.getMetrics();

// Reload single module
await registry.reloadModule('pricing-engine');
```

### ModuleLoader

```typescript
const loader = new ModuleLoader();

// Load all modules
const modules = await loader.loadModules('./modules');
```

## Files

- `/shared/module-system/module.interface.ts` - Interface definitions
- `/shared/module-system/module-registry.ts` - Registry implementation
- `/shared/module-system/module-loader.ts` - Loader implementation
- `/shared/module-system/index.ts` - Public exports
- `/scripts/create-module.ts` - Module generator
- `/src/server.ts` - Server integration (refactored)
- `/modules/*/src/{module}-module.ts` - Module implementations
