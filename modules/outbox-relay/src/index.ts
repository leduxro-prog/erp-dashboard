/**
 * Outbox Relay Service - Main entry point with CLI and server mode
 *
 * Production-ready outbox pattern relay service for Cypher ERP.
 * Reads events from Postgres outbox table and publishes to RabbitMQ.
 *
 * Usage:
 *   - Server mode: node dist/index.js start
 *   - CLI mode:    node dist/index.js process --batch-size 100
 *   - Stats:       node dist/index.js stats
 *
 * @module outbox-relay
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { OutboxRelay, RelayStatus } from './OutboxRelay';
import { OutboxLogger, createLogger } from './logger';
import { OutboxMetrics, getMetrics } from './Metrics';
import { HealthCheckServer, createHealthCheckServer } from './HealthCheck';
import { getConfig, getConfigManager } from './Config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Application context
 */
interface ApplicationContext {
  relay: OutboxRelay;
  logger: OutboxLogger;
  metrics?: OutboxMetrics;
  healthCheck?: HealthCheckServer;
}

/**
 * Global application context
 */
let appContext: ApplicationContext | null = null;

/**
 * Main application class
 */
class OutboxRelayApplication {
  private readonly logger: OutboxLogger;
  private readonly config;
  private relay?: OutboxRelay;
  private metrics?: OutboxMetrics;
  private healthCheck?: HealthCheckServer;
  private isShuttingDown = false;

  constructor() {
    this.config = getConfig();
    this.logger = createLogger(
      {
        level: this.config.logLevel,
      },
        {
          service: 'outbox-relay',
          instance: uuidv4(),
          version: process.env.npm_package_version || '1.0.0',
        }
      );

    this.setupSignalHandlers();
  }

  /**
   * Sets up signal handlers for graceful shutdown
   *
   * @private
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal as NodeJS.Signals, async () => {
        if (this.isShuttingDown) {
          this.logger.warn('Already shutting down, ignoring signal');
          return;
        }

        this.isShuttingDown = true;
        this.logger.info(`Received ${signal}, initiating graceful shutdown`);

        await this.shutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.fatal('Uncaught exception', error);
      this.shutdown(1).catch(() => {
        process.exit(1);
      });
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason) => {
      this.logger.fatal('Unhandled rejection', reason as Error);
      this.shutdown(1).catch(() => {
        process.exit(1);
      });
    });
  }

  /**
   * Initializes the application
   *
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing Outbox Relay Service');

    try {
      // Initialize metrics if enabled
      if (this.config.metrics.enabled) {
        this.metrics = getMetrics(this.config.metrics, this.logger);
        this.logger.info('Metrics initialized', {
          port: this.config.metrics.port,
          path: this.config.metrics.path,
        });
      }

      // Create relay instance
      this.relay = new OutboxRelay(
        {
          autoStart: false,
          processOnStartup: this.config.relay.processOnStartup,
        },
        this.logger,
        this.metrics
      );

      // Initialize relay
      await this.relay.initialize();

      // Create health check server if enabled
      if (this.config.healthCheck.enabled) {
        this.healthCheck = createHealthCheckServer(
          this.relay,
          this.logger,
          this.metrics,
          {
            port: this.config.healthCheck.port,
            path: this.config.healthCheck.path,
            readinessPath: this.config.healthCheck.readinessPath,
            livenessPath: this.config.healthCheck.livenessPath,
            startupPath: this.config.healthCheck.startupPath,
            metricsPath: this.config.metrics.enabled ? this.config.metrics.path : undefined,
          }
        );

        await this.healthCheck.start();
        this.logger.info('Health check server started', {
          port: this.config.healthCheck.port,
        });
      }

      // Set global context
      appContext = {
        relay: this.relay,
        logger: this.logger,
        metrics: this.metrics,
        healthCheck: this.healthCheck,
      };

      this.logger.info('Outbox Relay Service initialized successfully');
    } catch (error) {
      this.logger.fatal('Failed to initialize Outbox Relay Service', error as Error);
      throw error;
    }
  }

  /**
   * Starts the relay in continuous mode
   *
   * @returns Promise that resolves when started
   */
  public async start(): Promise<void> {
    if (!this.relay) {
      throw new Error('Relay not initialized');
    }

    this.logger.info('Starting Outbox Relay in continuous mode');
    await this.relay.start();

    // Start metrics pushgateway if configured
    if (this.metrics && this.config.metrics.pushgatewayUrl) {
      this.metrics.startPushgateway();
    }

    this.logger.info('Outbox Relay started successfully');
  }

  /**
   * Processes a single batch
   *
   * @param batchSize - Optional batch size
   * @returns Promise resolving to batch result
   */
  public async process(batchSize?: number): Promise<any> {
    if (!this.relay) {
      throw new Error('Relay not initialized');
    }

    this.logger.info('Processing batch', { batchSize });
    const result = await this.relay.processOnce();

    this.logger.info('Batch processing completed', {
      total: result.total,
      published: result.published,
      failed: result.failed,
      discarded: result.discarded,
      duration: result.durationMs,
    });

    return result;
  }

  /**
   * Gets statistics
   *
   * @returns Promise resolving to statistics
   */
  public async getStats(): Promise<any> {
    if (!this.relay) {
      throw new Error('Relay not initialized');
    }

    const relayStats = this.relay.getStatistics();
    const outboxStats = await this.relay.getOutboxStatistics();
    const healthStatus = await this.relay.getHealthStatus();

    return {
      relay: relayStats,
      outbox: outboxStats,
      health: healthStatus,
      uptime: this.relay.getUptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resets the circuit breaker
   */
  public resetCircuitBreaker(): void {
    if (!this.relay) {
      throw new Error('Relay not initialized');
    }

    this.relay.resetCircuitBreaker();
    this.logger.info('Circuit breaker reset');
  }

  /**
   * Shuts down the application
   *
   * @param exitCode - Exit code
   * @returns Promise that resolves when shutdown is complete
   */
  public async shutdown(exitCode: number = 0): Promise<void> {
    this.logger.info('Shutting down Outbox Relay Service');

    try {
      // Stop health check server
      if (this.healthCheck) {
        await this.healthCheck.stop();
      }

      // Stop metrics pushgateway
      if (this.metrics) {
        this.metrics.stopPushgateway();
        await this.metrics.shutdown();
      }

      // Stop relay
      if (this.relay) {
        await this.relay.stop();
      }

      // Flush logs
      this.logger.info('Shutdown complete');
      await this.logger.flush();

      process.exit(exitCode);
    } catch (error) {
      this.logger.error('Error during shutdown', error as Error);
      process.exit(1);
    }
  }
}

/**
 * Main function - CLI entry point
 */
async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('outbox-relay')
    .version(process.env.npm_package_version || '1.0.0')
    .usage('Usage: $0 <command> [options]')
    .command(
      'start',
      'Start the relay service in continuous mode',
      (yargs) => {
        return yargs
          .option('batch-size', {
            type: 'number',
            description: 'Batch size for event processing',
          })
          .option('interval', {
            type: 'number',
            description: 'Processing interval in milliseconds',
          })
          .option('no-health-check', {
            type: 'boolean',
            description: 'Disable health check server',
          })
          .option('no-metrics', {
            type: 'boolean',
            description: 'Disable metrics collection',
          });
      },
      async (argv) => {
        const app = new OutboxRelayApplication();

        // Apply command-line overrides
        if (argv.batchSize) {
          process.env.OUTBOX_BATCH_SIZE = argv.batchSize.toString();
        }
        if (argv.interval) {
          process.env.OUTBOX_BATCH_INTERVAL_MS = argv.interval.toString();
        }
        if (argv.noHealthCheck) {
          process.env.HEALTH_CHECK_ENABLED = 'false';
        }
        if (argv.noMetrics) {
          process.env.METRICS_ENABLED = 'false';
        }

        await app.initialize();
        await app.start();
      }
    )
    .command(
      'process',
      'Process a single batch of events',
      (yargs) => {
        return yargs
          .option('batch-size', {
            type: 'number',
            alias: 'b',
            description: 'Batch size',
            default: 100,
          })
          .option('json', {
            type: 'boolean',
            alias: 'j',
            description: 'Output as JSON',
          });
      },
      async (argv) => {
        const app = new OutboxRelayApplication();
        await app.initialize();

        const result = await app.process(argv.batchSize);

        if (argv.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('Batch processing result:');
          console.log(`  Total:      ${result.total}`);
          console.log(`  Published:  ${result.published}`);
          console.log(`  Failed:     ${result.failed}`);
          console.log(`  Discarded:  ${result.discarded}`);
          console.log(`  Duration:   ${result.durationMs}ms`);
        }

        await app.shutdown(0);
      }
    )
    .command(
      'stats',
      'Show relay and outbox statistics',
      (yargs) => {
        return yargs.option('json', {
          type: 'boolean',
          alias: 'j',
          description: 'Output as JSON',
        });
      },
      async (argv) => {
        const app = new OutboxRelayApplication();
        await app.initialize();

        const stats = await app.getStats();

        if (argv.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log('Outbox Relay Statistics:');
          console.log('');
          console.log('Relay Stats:');
          console.log(`  Status:     ${stats.health.status}`);
          console.log(`  Uptime:     ${Math.round(stats.uptime / 1000)}s`);
          console.log(`  Total Batches:  ${stats.relay.totalBatches}`);
          console.log(`  Events Processed: ${stats.relay.totalEventsProcessed}`);
          console.log(`  Events Published:  ${stats.relay.totalEventsPublished}`);
          console.log(`  Events Failed:     ${stats.relay.totalEventsFailed}`);
          console.log(`  Events Discarded:  ${stats.relay.totalEventsDiscarded}`);
          console.log('');
          console.log('Outbox Stats:');
          console.log(`  Pending:    ${stats.outbox.pending}`);
          console.log(`  Processing: ${stats.outbox.processing}`);
          console.log(`  Published:  ${stats.outbox.published}`);
          console.log(`  Failed:     ${stats.outbox.failed}`);
          console.log(`  Discarded:  ${stats.outbox.discarded}`);
          console.log('');
          console.log('Component Health:');
          console.log(`  Postgres:   ${stats.health.components.postgres.status}`);
          console.log(`  RabbitMQ:   ${stats.health.components.rabbitmq.status}`);
          console.log(`  Relay:      ${stats.health.components.outboxRelay.status}`);
        }

        await app.shutdown(0);
      }
    )
    .command(
      'reset-cb',
      'Reset the circuit breaker',
      () => {},
      async () => {
        const app = new OutboxRelayApplication();
        await app.initialize();
        app.resetCircuitBreaker();
        console.log('Circuit breaker has been reset');
        await app.shutdown(0);
      }
    )
    .command(
      'validate-config',
      'Validate the configuration',
      () => {},
      async () => {
        const configManager = getConfigManager();
        const isValid = configManager.validate();

        if (isValid) {
          console.log('Configuration is valid');
          console.log(JSON.stringify(configManager.getConfig(), null, 2));
          process.exit(0);
        } else {
          console.error('Configuration is invalid');
          process.exit(1);
        }
      }
    )
    .help()
    .alias('help', 'h')
    .demandCommand(1, 'You must provide a command')
    .strict()
    .parse();

  // If yargs handled the command, we won't reach here
  // But TypeScript needs a return statement
  return;
}

/**
 * Export for programmatic use
 */
export * from './OutboxRelay';
export * from './OutboxProcessor';
export * from './OutboxRepository';
export * from './Publisher';
export * from './Config';
export * from './Metrics';
export * from './HealthCheck';
export * from './logger';

export { OutboxRelayApplication };

// Export factory functions
export { getRelay, createRelay } from './OutboxRelay';
export { getProcessor, createProcessor } from './OutboxProcessor';
export { getRepository, createRepository } from './OutboxRepository';
export { getPublisher, createPublisher } from './Publisher';
export { getConfig, getConfigManager } from './Config';
export { getMetrics, createMetrics } from './Metrics';
export { getLogger, createLogger } from './logger';

// Run main if this is the entry point
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
