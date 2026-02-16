# Quick Start - Adding Modules to CYPHER ERP

## For Module Users/Developers

### Create a New Module (2 minutes)

```bash
npx ts-node scripts/create-module.ts --name=shipping --description="Shipping management system"
```

This creates:
```
modules/shipping/
├── src/
│   ├── domain/           (business logic)
│   ├── application/      (use-cases)
│   ├── infrastructure/   (database & DI)
│   ├── api/              (HTTP routes)
│   ├── shipping-module.ts (ICypherModule implementation)
│   └── index.ts
├── tests/
├── README.md
└── package.json
```

### Implement Your Module

1. Edit `src/shipping-module.ts` and fill in the TODOs
2. Create domain entities in `src/domain/entities/`
3. Implement repositories in `src/infrastructure/repositories/`
4. Create use-cases in `src/application/use-cases/`
5. Implement API controller and routes in `src/api/`
6. Update composition root in `src/infrastructure/composition-root.ts`

### Define Dependencies (if needed)

```typescript
readonly dependencies = ['orders', 'inventory'];
```

The system will ensure orders and inventory initialize first.

### Publish Events

```typescript
readonly publishedEvents = ['shipment.created', 'shipment.shipped'];

async publishShipmentCreated(shipmentId: string): Promise<void> {
  await this.context.eventBus.publish('shipment.created', { shipmentId });
}
```

### Subscribe to Events

```typescript
readonly subscribedEvents = ['order.created', 'order.cancelled'];

async start(): Promise<void> {
  await this.context.eventBus.subscribe('order.created', (data) => {
    this.onOrderCreated(data);
  });
}
```

### Test Your Module

```bash
# Unit tests
npm test --prefix modules/shipping

# Integration tests
npm run test:integration --prefix modules/shipping

# API tests
npm run test:api --prefix modules/shipping
```

### Start the App

```bash
npm start
```

Your module is automatically:
- Discovered from `modules/shipping/src/index.ts`
- Initialized
- Started
- Routed at `/api/v1/shipping/*`

## Module System Endpoints

After starting the app, check module status:

```bash
# List all loaded modules with health
curl http://localhost:3000/api/v1/system/modules

# Get system metrics
curl http://localhost:3000/api/v1/system/metrics
```

Response:
```json
{
  "status": "healthy",
  "modules": [
    {
      "name": "pricing-engine",
      "version": "1.0.0",
      "description": "...",
      "dependencies": [],
      "health": {
        "status": "healthy",
        "lastChecked": "2025-02-07T10:30:00Z"
      }
    }
  ]
}
```

## Module Interface Quick Reference

Every module must implement `ICypherModule`:

```typescript
export default class MyModule implements ICypherModule {
  // Identification
  readonly name = 'my-module';                    // kebab-case, unique
  readonly version = '1.0.0';                     // semantic version
  readonly description = 'Module description';    // human readable

  // Dependencies
  readonly dependencies = [];                     // modules that must init first
  readonly publishedEvents = [];                  // events this module emits
  readonly subscribedEvents = [];                 // events this module listens to
  readonly featureFlag?: string;                  // optional feature toggle

  // Lifecycle methods
  async initialize(context: IModuleContext): Promise<void> {
    // Called once during startup
    // Create tables, setup caches, create composition root
  }

  async start(): Promise<void> {
    // Called after all modules initialized
    // Subscribe to events, start workers, warm caches
  }

  async stop(): Promise<void> {
    // Called during shutdown (reverse order)
    // Unsubscribe, stop workers, flush caches
  }

  // Observability
  async getHealth(): Promise<IModuleHealth> {
    // Check database, cache, dependencies
    return {
      status: 'healthy', // 'healthy' | 'degraded' | 'unhealthy'
      details: { /* component status */ },
      lastChecked: new Date()
    };
  }

  getRouter(): Router {
    // Return Express router (auto-mounted at /api/v1/{module-name}/)
  }

  getMetrics(): IModuleMetrics {
    // Return collected metrics (requests, errors, response times, etc.)
  }
}
```

## Common Patterns

### Pattern 1: Simple CRUD Module

```typescript
async initialize(context: IModuleContext): Promise<void> {
  const repository = new TypeOrmRepository(context.dataSource);
  const useCase = new CrudUseCase(repository);
  const controller = new Controller(useCase);
  this.router = createRoutes(controller);
}

async start(): Promise<void> {
  // No event subscriptions needed
}

async stop(): Promise<void> {
  // No cleanup needed
}
```

### Pattern 2: Event-Driven Module

```typescript
async start(): Promise<void> {
  await this.context.eventBus.subscribe('product.created', async (data) => {
    await this.onProductCreated(data);
  });
}

async stop(): Promise<void> {
  // Event bus auto-unsubscribes
}
```

### Pattern 3: External Service Integration

```typescript
async initialize(context: IModuleContext): Promise<void> {
  this.client = await context.apiClientFactory.getServiceClient('woocommerce');
}

async start(): Promise<void> {
  // Verify connection
  const health = await this.client.health();
  if (!health.ok) throw new Error('Service unavailable');
}
```

## Module Context

```typescript
interface IModuleContext {
  dataSource: DataSource;              // TypeORM - query database
  eventBus: IEventBus;                 // Redis pub/sub
  cacheManager: ICacheManager;         // Multi-layer cache
  logger: Logger;                      // Module-scoped logger
  config: Record<string, string>;      // Environment variables
  apiClientFactory: IApiClientFactory; // Create HTTP clients
  featureFlags: IFeatureFlagService;   // Toggle features
}
```

## Using Module Context

```typescript
// Database
const data = await this.context.dataSource.query('SELECT...');

// Cache
await this.context.cacheManager.set('key', value, 3600);
const cached = await this.context.cacheManager.get('key');

// Events
await this.context.eventBus.publish('order.created', { orderId: 123 });

// Logging
this.context.logger.info('Order created', { orderId: 123 });

// Feature flags
if (this.context.featureFlags.isEnabled('new_pricing')) {
  // Use new pricing engine
}

// External API
const wooClient = await this.context.apiClientFactory.getServiceClient('woocommerce');
```

## Error Handling

### Initialization Errors

```typescript
async initialize(context: IModuleContext): Promise<void> {
  try {
    // Initialize
  } catch (error) {
    context.logger.error('Failed to initialize', { error });
    throw error; // Fail startup
  }
}
```

### Health Check Errors

```typescript
async getHealth(): Promise<IModuleHealth> {
  try {
    const latency = await checkDatabase();
    return { status: 'healthy', details: { database: { status: 'up', latency } }, lastChecked: new Date() };
  } catch (error) {
    return { status: 'unhealthy', details: { database: { status: 'down' } }, lastChecked: new Date() };
  }
}
```

### Event Handler Errors

```typescript
async start(): Promise<void> {
  await this.context.eventBus.subscribe('order.created', async (data) => {
    try {
      await this.onOrderCreated(data);
    } catch (error) {
      this.context.logger.error('Error processing order', { error });
      this.metrics.errorCount++;
    }
  });
}
```

## Feature Flags

Control module loading at runtime:

```typescript
readonly featureFlag = 'enable_shipping';
```

In environment file:
```
FEATURE_FLAG_ENABLE_SHIPPING=true     # Enable module
FEATURE_FLAG_ENABLE_SHIPPING=false    # Disable module
```

If disabled:
- Module still loads (can be toggled)
- Module initialization is skipped
- Module routes are not mounted
- Module start/stop are not called

## Performance Tips

1. **Cache frequently accessed data**
   ```typescript
   const data = await this.context.cacheManager.get('key');
   ```

2. **Use database connection pooling** (already configured)

3. **Publish events asynchronously** (fire-and-forget)
   ```typescript
   this.context.eventBus.publish('event', data).catch(err => log(err));
   ```

4. **Track metrics in hot paths**
   ```typescript
   const start = Date.now();
   const result = await doWork();
   this.metrics.responseTimes.push(Date.now() - start);
   ```

5. **Graceful degradation** - don't fail if optional services down
   ```typescript
   try {
     const result = await externalService.call();
   } catch (error) {
     logger.warn('External service down, using fallback');
     return fallbackValue;
   }
   ```

## Troubleshooting

### Module not loading?

Check that:
- Module folder exists in `modules/`
- `src/index.ts` exports ICypherModule
- Module name is kebab-case
- No syntax errors

```bash
# Check logs
npm start | grep "module"
```

### Module initialization fails?

Check:
- All dependencies are registered
- No circular dependencies
- Database connection works
- Tables exist (or migrations ran)

### Routes not available?

Check:
- Module loaded successfully (see logs)
- getRouter() returns router
- Routes don't have base path (auto-prefixed)

Example bad:
```typescript
getRouter(): Router {
  const r = Router();
  r.get('/api/v1/mymodule/data', ...); // WRONG - double path
  return r;
}
```

Example good:
```typescript
getRouter(): Router {
  const r = Router();
  r.get('/data', ...); // Correct - auto-prefixed to /api/v1/mymodule/data
  return r;
}
```

### Module health shows degraded?

Check:
- Database connectivity
- Redis/cache connectivity
- External service connectivity

```bash
# Check health
curl http://localhost:3000/api/v1/system/modules
```

## File Locations

- Module system: `/shared/module-system/`
- Module templates: `/modules/*/`
- Server integration: `/src/server.ts`
- Generator: `/scripts/create-module.ts`
- Documentation: `/shared/module-system/README.md`

## Next Steps

1. Create your first module: `npx ts-node scripts/create-module.ts --name=YOUR_MODULE`
2. Read `/shared/module-system/README.md` for comprehensive guide
3. Check `/modules/pricing-engine/src/pricing-module.ts` for reference implementation
4. Write tests in `tests/`
5. Start the app and verify at `/api/v1/system/modules`

## Getting Help

1. Check the module system README: `/shared/module-system/README.md`
2. Look at pricing module reference: `/modules/pricing-engine/src/pricing-module.ts`
3. Review this quick start guide
4. Check server integration: `/src/server.ts`
