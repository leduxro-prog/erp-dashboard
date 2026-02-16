#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * CYPHER ERP Module Generator Script
 *
 * Creates a new module with the standard architecture:
 * - Domain layer (entities, repositories, services)
 * - Application layer (use-cases, ports, DTOs)
 * - Infrastructure layer (TypeORM repos, composition root)
 * - API layer (controllers, routes, validators)
 * - Tests (unit, integration)
 *
 * Usage:
 *   npx ts-node scripts/create-module.ts --name=shipping --description="Shipping integration"
 *   npx ts-node scripts/create-module.ts --name=notifications --desc="Send notifications"
 *
 * Flags:
 *   --name/-n REQUIRED: Module name in kebab-case (e.g., shipping, order-tracking)
 *   --description/-d REQUIRED: Human-readable module description
 *   --author/-a OPTIONAL: Author name (default: CYPHER Team)
 *   --version/-v OPTIONAL: Initial version (default: 1.0.0)
 *   --help/-h: Show this help message
 */

interface ModuleConfig {
  name: string;
  description: string;
  author: string;
  version: string;
  pascalCaseName: string;
  camelCaseName: string;
}

/**
 * Parse command line arguments.
 */
function parseArgs(): { config: ModuleConfig; help: boolean } {
  const args = process.argv.slice(2);
  let name = '';
  let description = '';
  let author = 'CYPHER Team';
  let version = '1.0.0';
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--name' || arg === '-n') {
      name = args[++i];
    } else if (arg === '--description' || arg === '-d' || arg === '--desc') {
      description = args[++i];
    } else if (arg === '--author' || arg === '-a') {
      author = args[++i];
    } else if (arg === '--version' || arg === '-v') {
      version = args[++i];
    }
  }

  const config: ModuleConfig = {
    name: name.toLowerCase(),
    description,
    author,
    version,
    pascalCaseName: kebabToPascalCase(name),
    camelCaseName: kebabToCamelCase(name),
  };

  return { config, help };
}

/**
 * Convert kebab-case to PascalCase.
 */
function kebabToPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convert kebab-case to camelCase.
 */
function kebabToCamelCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/**
 * Validate module configuration.
 */
function validateConfig(config: ModuleConfig): void {
  if (!config.name) {
    throw new Error('Module name is required (use --name or -n)');
  }

  if (!config.description) {
    throw new Error('Module description is required (use --description or -d)');
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(config.name)) {
    throw new Error(
      `Module name "${config.name}" must be lowercase kebab-case (e.g., shipping, order-tracking)`
    );
  }

  if (!/^\d+\.\d+\.\d+/.test(config.version)) {
    throw new Error(
      `Module version "${config.version}" must follow semantic versioning (e.g., 1.0.0)`
    );
  }
}

/**
 * Show help message.
 */
function showHelp(): void {
  console.log(`
CYPHER ERP Module Generator

Creates a new module with standard architecture:
  - Domain layer (entities, repositories, services)
  - Application layer (use-cases, ports, DTOs)
  - Infrastructure layer (TypeORM repos, composition root)
  - API layer (controllers, routes, validators)
  - Tests

Usage:
  npx ts-node scripts/create-module.ts --name=shipping --description="Shipping integration"

Flags:
  --name, -n REQUIRED           Module name in kebab-case
  --description, -d REQUIRED    Human-readable description
  --author, -a OPTIONAL         Author name (default: CYPHER Team)
  --version, -v OPTIONAL        Initial version (default: 1.0.0)
  --help, -h                    Show this help message

Examples:
  npx ts-node scripts/create-module.ts -n shipping -d "Shipping management"
  npx ts-node scripts/create-module.ts -n notifications -d "Send notifications" -a "John Doe"
  npx ts-node scripts/create-module.ts --name=reports --description="Reporting engine" --version=2.0.0
`);
}

/**
 * Create directory structure.
 */
function createDirectories(modulePath: string): void {
  const dirs = [
    'src/domain/entities',
    'src/domain/repositories',
    'src/domain/services',
    'src/application/use-cases',
    'src/application/ports',
    'src/application/dtos',
    'src/application/errors',
    'src/infrastructure/entities',
    'src/infrastructure/repositories',
    'src/api/controllers',
    'src/api/routes',
    'src/api/validators',
    'tests/domain',
    'tests/application',
    'tests/api',
  ];

  for (const dir of dirs) {
    const fullPath = path.join(modulePath, dir);
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

/**
 * Create module main index.ts implementing ICypherModule.
 */
function createModuleIndex(modulePath: string, config: ModuleConfig): void {
  const content = `import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '../../../shared/module-system';
import { createModuleLogger } from '../../../shared/utils/logger';

const logger = createModuleLogger('${config.name}');

/**
 * ${config.pascalCaseName} Module
 *
 * ${config.description}
 *
 * @version ${config.version}
 * @author ${config.author}
 */
export default class ${config.pascalCaseName}Module implements ICypherModule {
  readonly name = '${config.name}';
  readonly version = '${config.version}';
  readonly description = '${config.description}';
  readonly dependencies: string[] = [];
  readonly publishedEvents: string[] = [];
  readonly subscribedEvents: string[] = [];
  readonly featureFlag?: string;

  private context!: IModuleContext;
  private router!: Router;

  // TODO: Add module-specific properties and composition root

  /**
   * Initialize the module.
   * Set up database tables, caches, and dependencies.
   */
  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing ${config.pascalCaseName} module');

    try {
      // TODO: Create tables if not exist
      // TODO: Create composition root
      // TODO: Create Express router
      logger.info('${config.pascalCaseName} module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ${config.pascalCaseName} module', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start the module.
   * Subscribe to events, start workers, warm caches.
   */
  async start(): Promise<void> {
    logger.info('Starting ${config.pascalCaseName} module');

    try {
      // TODO: Subscribe to events
      // TODO: Start background workers
      logger.info('${config.pascalCaseName} module started successfully');
    } catch (error) {
      logger.error('Failed to start ${config.pascalCaseName} module', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the module gracefully.
   * Unsubscribe from events, stop workers, flush caches.
   */
  async stop(): Promise<void> {
    logger.info('Stopping ${config.pascalCaseName} module');

    try {
      // TODO: Unsubscribe from events
      // TODO: Stop background workers
      logger.info('${config.pascalCaseName} module stopped successfully');
    } catch (error) {
      logger.warn('Error stopping ${config.pascalCaseName} module', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get module health status.
   * Check database, cache, and external service connectivity.
   */
  async getHealth(): Promise<IModuleHealth> {
    try {
      // TODO: Check database connectivity
      // TODO: Check cache/Redis connectivity
      // TODO: Check external service connectivity

      return {
        status: 'healthy',
        details: {
          database: { status: 'up' },
          // TODO: Add more health checks
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      logger.warn('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        status: 'unhealthy',
        details: {
          database: {
            status: 'down',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Get Express router for this module.
   * Routes are mounted at /api/v1/${config.name}/
   */
  getRouter(): Router {
    // TODO: Implement routes
    return this.router;
  }

  /**
   * Get module metrics.
   * Used for monitoring and observability.
   */
  getMetrics(): IModuleMetrics {
    return {
      requestCount: 0, // TODO: Track request count
      errorCount: 0, // TODO: Track error count
      avgResponseTime: 0, // TODO: Track response times
      activeWorkers: 0, // TODO: Track active workers
      cacheHitRate: 0, // TODO: Track cache hit rate
      eventCount: {
        published: 0, // TODO: Track published events
        received: 0, // TODO: Track received events
      },
    };
  }
}

export { ${config.pascalCaseName}Module };
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'index.ts'), content);
}

/**
 * Create domain/entities placeholder.
 */
function createDomainEntities(modulePath: string, config: ModuleConfig): void {
  const content = `/**
 * Domain Entity Example
 * TODO: Replace with actual domain entities
 */
export interface I${config.pascalCaseName}Entity {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TODO: Create entity classes here
 * Example:
 *
 * export class ${config.pascalCaseName} implements I${config.pascalCaseName}Entity {
 *   id: string;
 *   name: string;
 *   createdAt: Date;
 *   updatedAt: Date;
 *
 *   constructor(data: I${config.pascalCaseName}Entity) {
 *     this.id = data.id;
 *     this.name = data.name;
 *     this.createdAt = data.createdAt;
 *     this.updatedAt = data.updatedAt;
 *   }
 * }
 */
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'domain', 'entities', '.gitkeep'), '');
  fs.writeFileSync(
    path.join(modulePath, 'src', 'domain', 'entities', 'README.ts'),
    content
  );
}

/**
 * Create application/ports placeholder.
 */
function createApplicationPorts(modulePath: string, config: ModuleConfig): void {
  const content = `/**
 * Repository Port (Interface)
 * TODO: Define repository interface for domain
 */
export interface I${config.pascalCaseName}Repository {
  // TODO: Define repository methods
  // find(id: string): Promise<${config.pascalCaseName} | null>;
  // findAll(): Promise<${config.pascalCaseName}[]>;
  // save(entity: ${config.pascalCaseName}): Promise<${config.pascalCaseName}>;
  // delete(id: string): Promise<void>;
}

/**
 * TODO: Create other port interfaces here
 */
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'application', 'ports', '.gitkeep'), '');
  fs.writeFileSync(
    path.join(modulePath, 'src', 'application', 'ports', 'index.ts'),
    content
  );
}

/**
 * Create application/dtos placeholder.
 */
function createApplicationDTOs(modulePath: string, config: ModuleConfig): void {
  const content = `/**
 * Data Transfer Objects for API and inter-module communication
 */

export interface Create${config.pascalCaseName}DTO {
  // TODO: Define DTO fields
  // name: string;
  // description?: string;
}

export interface Update${config.pascalCaseName}DTO {
  // TODO: Define DTO fields
  // name?: string;
  // description?: string;
}

export interface ${config.pascalCaseName}ResponseDTO {
  // TODO: Define response DTO
  // id: string;
  // name: string;
  // createdAt: Date;
  // updatedAt: Date;
}
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'application', 'dtos', '.gitkeep'), '');
  fs.writeFileSync(
    path.join(modulePath, 'src', 'application', 'dtos', 'index.ts'),
    content
  );
}

/**
 * Create API routes placeholder.
 */
function createApiRoutes(modulePath: string, config: ModuleConfig): void {
  const content = `import { Router } from 'express';
// TODO: Import controller

/**
 * Create routes for ${config.name} module
 * Routes are mounted at /api/v1/${config.name}/
 */
export function create${config.pascalCaseName}Routes(
  // TODO: Inject dependencies
  controller: any
): Router {
  const router = Router();

  // TODO: Define routes
  // router.get('/list', controller.list.bind(controller));
  // router.post('/create', controller.create.bind(controller));
  // router.get('/:id', controller.get.bind(controller));
  // router.put('/:id', controller.update.bind(controller));
  // router.delete('/:id', controller.delete.bind(controller));

  return router;
}
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'api', 'routes', '.gitkeep'), '');
  fs.writeFileSync(
    path.join(modulePath, 'src', 'api', 'routes', \`\${config.name}.routes.ts\`),
    content
  );
}

/**
 * Create API controller placeholder.
 */
function createApiControllers(modulePath: string, config: ModuleConfig): void {
  const content = `import { Request, Response } from 'express';
import { createModuleLogger } from '../../../../shared/utils/logger';

const logger = createModuleLogger('${config.name}-controller');

/**
 * ${config.pascalCaseName} API Controller
 * TODO: Implement API endpoints
 */
export class ${config.pascalCaseName}Controller {
  constructor(
    // TODO: Inject use-cases
  ) {}

  // TODO: Implement controller methods
  // async list(req: Request, res: Response): Promise<void> { ... }
  // async create(req: Request, res: Response): Promise<void> { ... }
  // async get(req: Request, res: Response): Promise<void> { ... }
  // async update(req: Request, res: Response): Promise<void> { ... }
  // async delete(req: Request, res: Response): Promise<void> { ... }
}
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'api', 'controllers', '.gitkeep'), '');
  fs.writeFileSync(
    path.join(modulePath, 'src', 'api', 'controllers', \`\${config.pascalCaseName}Controller.ts\`),
    content
  );
}

/**
 * Create infrastructure composition root.
 */
function createCompositionRoot(modulePath: string, config: ModuleConfig): void {
  const content = `import { Router } from 'express';
import { DataSource } from 'typeorm';
// TODO: Import repositories, use-cases, controller

/**
 * Composition Root for ${config.pascalCaseName} Module
 * Orchestrates dependency injection and creates configured Express router
 */
export function create${config.pascalCaseName}Router(
  dataSource: DataSource
): Router {
  // TODO: Instantiate repositories with DataSource
  // const repository = new TypeOrmRepository(dataSource);

  // TODO: Instantiate use-cases with injected repositories
  // const useCase = new UseCase(repository);

  // TODO: Instantiate controller with injected use-cases
  // const controller = new ${config.pascalCaseName}Controller(useCase);

  // TODO: Create and return configured Express router
  // return create${config.pascalCaseName}Routes(controller);

  return Router();
}
`;

  fs.writeFileSync(path.join(modulePath, 'src', 'infrastructure', 'composition-root.ts'), content);
}

/**
 * Create infrastructure/entities placeholder.
 */
function createInfrastructureEntities(modulePath: string, config: ModuleConfig): void {
  const content = `import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * TypeORM Entity for ${config.pascalCaseName}
 * Maps to database table: ${config.name}
 * TODO: Replace with actual entity
 */
@Entity('${config.name}')
export class ${config.pascalCaseName}Entity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar')
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // TODO: Add more columns and relationships
}
`;

  fs.writeFileSync(
    path.join(
      modulePath,
      'src',
      'infrastructure',
      'entities',
      \`\${config.pascalCaseName}Entity.ts\`
    ),
    content
  );
}

/**
 * Create package.json.
 */
function createPackageJson(modulePath: string, config: ModuleConfig): void {
  const pkg = {
    name: \`@cypher-erp/\${config.name}\`,
    version: config.version,
    description: config.description,
    author: config.author,
    license: 'PROPRIETARY',
    private: true,
    main: 'src/index.ts',
    types: 'src/index.ts',
    scripts: {
      build: 'tsc',
      test: 'jest',
      'test:watch': 'jest --watch',
    },
  };

  fs.writeFileSync(path.join(modulePath, 'package.json'), JSON.stringify(pkg, null, 2));
}

/**
 * Create README.md.
 */
function createReadme(modulePath: string, config: ModuleConfig): void {
  const content = \`# \${config.pascalCaseName} Module

\${config.description}

## Version

\${config.version}

## Author

\${config.author}

## Dependencies

TODO: List module dependencies

## Published Events

TODO: List events published by this module

## Subscribed Events

TODO: List events this module subscribes to

## API Endpoints

TODO: Document API endpoints

## Architecture

This module follows clean architecture with layers:

- **Domain**: Core business logic and entities
- **Application**: Use-cases and DTOs
- **Infrastructure**: Database, external services
- **API**: HTTP controllers and routes

## Development

TODO: Add development instructions

## Testing

TODO: Add test instructions
\`;

  fs.writeFileSync(path.join(modulePath, 'README.md'), content);
}

/**
 * Create test files.
 */
function createTests(modulePath: string, config: ModuleConfig): void {
  const testExample = \`describe('\${config.pascalCaseName} Module', () => {
  // TODO: Write tests

  it('should do something', () => {
    // Arrange
    // Act
    // Assert
  });
});
\`;

  fs.writeFileSync(
    path.join(modulePath, 'tests', 'domain', '.gitkeep'),
    ''
  );
  fs.writeFileSync(
    path.join(modulePath, 'tests', 'application', '.gitkeep'),
    ''
  );
  fs.writeFileSync(
    path.join(modulePath, 'tests', 'api', 'example.test.ts'),
    testExample
  );
}

/**
 * Main generator function.
 */
async function main(): Promise<void> {
  try {
    const { config, help } = parseArgs();

    if (help) {
      showHelp();
      process.exit(0);
    }

    // Validate configuration
    validateConfig(config);

    // Determine module path
    const modulesDir = path.join(process.cwd(), 'modules');
    const modulePath = path.join(modulesDir, config.name);

    // Check if module already exists
    if (fs.existsSync(modulePath)) {
      throw new Error(\`Module directory already exists: \${modulePath}\`);
    }

    console.log(\`\\n📦 Creating CYPHER ERP module: \${config.name}\`);
    console.log(\`   Path: \${modulePath}\`);
    console.log(\`   Version: \${config.version}\`);
    console.log(\`   Author: \${config.author}\\n\`);

    // Create directory structure
    console.log('📁 Creating directories...');
    createDirectories(modulePath);

    // Create files
    console.log('📝 Creating files...');
    createModuleIndex(modulePath, config);
    createDomainEntities(modulePath, config);
    createApplicationPorts(modulePath, config);
    createApplicationDTOs(modulePath, config);
    createApiRoutes(modulePath, config);
    createApiControllers(modulePath, config);
    createCompositionRoot(modulePath, config);
    createInfrastructureEntities(modulePath, config);
    createPackageJson(modulePath, config);
    createReadme(modulePath, config);
    createTests(modulePath, config);

    console.log('✅ Module created successfully!\\n');
    console.log(\`📋 Next steps:\`);
    console.log(\`   1. Edit src/index.ts to implement \${config.pascalCaseName}Module\`);
    console.log(\`   2. Implement domain entities in src/domain/entities/\`);
    console.log(\`   3. Implement repositories in src/infrastructure/repositories/\`);
    console.log(\`   4. Implement use-cases in src/application/use-cases/\`);
    console.log(\`   5. Implement API controller and routes in src/api/\`);
    console.log(\`   6. Update composition root in src/infrastructure/composition-root.ts\`);
    console.log(\`   7. Write tests in tests/\`);
    console.log(\`   8. Add module to README.md\`);
    console.log(\`   9. Module will be auto-discovered on next startup\\n\`);
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error)
    );
    console.log('\\nUse --help flag for usage information');
    process.exit(1);
  }
}

main();
