import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * TypeORM DataSource Configuration
 * Configures PostgreSQL connection with enterprise-grade connection pooling
 * Supports read replicas, statement timeouts, and high-concurrency scenarios
 *
 * Environment Variables:
 * - DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME: Connection details
 * - DB_POOL_MAX: Max pool size (default: 25)
 * - DB_POOL_MIN: Min pool size (default: 5)
 * - DB_IDLE_TIMEOUT: Idle connection timeout in ms (default: 30000)
 * - DB_CONNECTION_TIMEOUT: Connection establishment timeout in ms (default: 5000)
 * - DB_STATEMENT_TIMEOUT: Query statement timeout in ms (default: 30000)
 * - READ_REPLICA_HOST: Optional read replica host for SELECT queries
 * - DB_LOGGING: Enable TypeORM query logging (default: false)
 */
const useDistArtifacts = process.env.NODE_ENV === 'production' || process.env.TYPEORM_USE_DIST === 'true';

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'cypher_erp',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  logger: 'advanced-console',
  entities: [
    // Core and Module Entities
    'modules/**/infrastructure/entities/*.ts',
    'modules/**/src/domain/entities/*.ts',
    ...(useDistArtifacts ? ['dist/modules/**/infrastructure/entities/*.js', 'dist/modules/**/src/domain/entities/*.js'] : []),
    'src/infrastructure/database/entities/*.ts',
    ...(useDistArtifacts ? ['dist/src/infrastructure/database/entities/*.js'] : []),
  ],
  migrations: useDistArtifacts
    ? ['dist/database/migrations/*.js']
    : ['database/migrations/*.ts'],
  subscribers: [
    'dist/src/subscribers/**/*.js',
    'src/subscribers/**/*.ts',
  ],
  migrationsTableName: 'typeorm_migrations',
  // Enterprise Connection Pool Configuration
  extra: {
    // Pool size configuration for high-concurrency scenarios (100K+ products, 500+ clients)
    max: parseInt(process.env.DB_POOL_MAX || '25', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),

    // Connection lifecycle
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),

    // Query timeout configuration
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),

    // Application identifier for database logs
    application_name: 'cypher-erp',

    // Connection validation and health checks
    keepAlive: true,
    keepAliveInitialDelaySeconds: 0,

    // Statement and query cache for performance
    statement_cache_size: 25,
    maxUses: 7500,
  },
};

/**
 * Create primary DataSource for write operations
 */
export const AppDataSource = new DataSource(dataSourceOptions);

/**
 * Create read replica DataSource if configured
 * Used for SELECT queries to distribute read load
 */
export const createReadReplicaDataSource = (): DataSource | undefined => {
  const readReplicaHost = process.env.READ_REPLICA_HOST;

  if (!readReplicaHost) {
    return undefined;
  }

  const readReplicaOptions: DataSourceOptions = {
    ...dataSourceOptions,
    host: readReplicaHost,
    port: parseInt(process.env.READ_REPLICA_PORT || process.env.DB_PORT || '5432', 10),
    synchronize: false,
    name: 'read-replica',
    extra: {
      ...dataSourceOptions.extra,
      max: parseInt(process.env.READ_REPLICA_POOL_MAX || '15', 10),
      min: parseInt(process.env.READ_REPLICA_POOL_MIN || '3', 10),
    },
  };

  return new DataSource(readReplicaOptions);
};
