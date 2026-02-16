/**
 * Health check endpoints for Kubernetes readiness/liveness probes.
 *
 * Provides liveness probe, readiness probe, startup probe,
 * and component status checks for Postgres and RabbitMQ.
 *
 * @module HealthCheck
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { OutboxLogger } from './logger';
import { OutboxRelay, HealthStatus } from './OutboxRelay';
import { getConfig, HealthCheckConfig } from './Config';
import { OutboxMetrics } from './Metrics';

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  status: 'pass' | 'fail' | 'warn';
  timestamp: string;
  uptime: number;
  checks?: {
    postgres?: ComponentCheck;
    rabbitmq?: ComponentCheck;
    outboxRelay?: ComponentCheck;
  };
}

/**
 * Component check result
 */
export interface ComponentCheck {
  status: 'pass' | 'fail' | 'warn';
  componentId: string;
  componentType: string;
  observedValue?: any;
  observedUnit?: string;
  time: string;
  output?: string;
  links?: string[];
}

/**
 * Readiness check response interface
 */
export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    postgres: boolean;
    rabbitmq: boolean;
    relay: boolean;
  };
}

/**
 * Startup check response interface
 */
export interface StartupResponse {
  status: 'started' | 'starting';
  timestamp: string;
  uptime: number;
}

/**
 * Health check server configuration
 */
export interface HealthCheckServerOptions {
  port?: number;
  path?: string;
  readinessPath?: string;
  livenessPath?: string;
  startupPath?: string;
  metricsPath?: string;
}

/**
 * Health check server class
 */
export class HealthCheckServer {
  private readonly app: express.Application;
  private readonly server: http.Server;
  private readonly logger: OutboxLogger;
  private readonly config: HealthCheckConfig;
  private readonly relay: OutboxRelay;
  private readonly metrics?: OutboxMetrics;
  private readonly metricsPath: string;

  private startupTimestamp: number = Date.now();
  private ready: boolean = false;

  /**
   * Creates a new HealthCheckServer instance
   *
   * @param relay - Outbox relay instance
   * @param logger - Logger instance
   * @param metrics - Metrics instance
   * @param options - Server options
   */
  constructor(
    relay: OutboxRelay,
    logger?: OutboxLogger,
    metrics?: OutboxMetrics,
    options?: HealthCheckServerOptions
  ) {
    this.relay = relay;
    this.logger = logger || new OutboxLogger().forComponent('HealthCheck');
    this.metrics = metrics;

    const configManager = getConfig();
    this.config = {
      enabled: configManager.healthCheck.enabled,
      port: options?.port ?? configManager.healthCheck.port,
      path: options?.path ?? configManager.healthCheck.path,
      readinessPath: options?.readinessPath ?? configManager.healthCheck.readinessPath,
      livenessPath: options?.livenessPath ?? configManager.healthCheck.livenessPath,
      startupPath: options?.startupPath ?? configManager.healthCheck.startupPath,
      intervalMs: configManager.healthCheck.intervalMs,
      timeoutMs: configManager.healthCheck.timeoutMs,
      startupTimeoutMs: configManager.healthCheck.startupTimeoutMs,
    };
    this.metricsPath = options?.metricsPath ?? configManager.metrics.path;

    // Create Express app
    this.app = express();

    // Configure middleware
    this.configureMiddleware();

    // Configure routes
    this.configureRoutes();

    // Create server
    this.server = http.createServer(this.app);

    this.logger.info('HealthCheckServer created', {
      port: this.config.port,
      enabled: this.config.enabled,
    });
  }

  /**
   * Configures Express middleware
   *
   * @private
   */
  private configureMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string;
      (req as any).log = this.logger.withCorrelationId(correlationId);

      this.logger.debug('Health check request', {
        method: req.method,
        path: req.path,
      });

      res.on('finish', () => {
        this.logger.debug('Health check response', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      });

      next();
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Health check error', err, {
        path: req.path,
      });
      res.status(500).json({
        status: 'fail',
        error: err.message,
      });
    });
  }

  /**
   * Configures Express routes
   *
   * @private
   */
  private configureRoutes(): void {
    // General health endpoint (combined check)
    this.app.get(this.config.path, this.healthHandler.bind(this));

    // Readiness probe
    this.app.get(this.config.readinessPath, this.readinessHandler.bind(this));

    // Liveness probe
    this.app.get(this.config.livenessPath, this.livenessHandler.bind(this));

    // Startup probe
    this.app.get(this.config.startupPath, this.startupHandler.bind(this));

    // Detailed health endpoint
    this.app.get(`${this.config.path}/detailed`, this.detailedHealthHandler.bind(this));

    // Statistics endpoint
    this.app.get('/stats', this.statsHandler.bind(this));

    // Metrics endpoint (if configured)
    const configManager = getConfig();
    if (configManager.metrics.enabled && this.metricsPath) {
      this.app.get(this.metricsPath, this.metricsHandler.bind(this));
    }
  }

  /**
   * General health check handler
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async healthHandler(req: Request, res: Response): Promise<void> {
    const health = await this.relay.getHealthStatus();

    const response: HealthCheckResponse = {
      status: health.status === 'healthy' ? 'pass' : health.status === 'degraded' ? 'warn' : 'fail',
      timestamp: new Date().toISOString(),
      uptime: health.uptime,
    };

    const statusCode = response.status === 'pass' ? 200 : response.status === 'warn' ? 200 : 503;

    res.status(statusCode).json(response);
  }

  /**
   * Readiness probe handler
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async readinessHandler(req: Request, res: Response): Promise<void> {
    const isReady = await this.relay.isReady();

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Liveness probe handler
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async livenessHandler(req: Request, res: Response): Promise<void> {
    const isAlive = await this.relay.isHealthy();

    if (isAlive) {
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_alive',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Startup probe handler
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async startupHandler(req: Request, res: Response): Promise<void> {
    const isStarted = await this.relay.isStartedUp();
    const uptime = Date.now() - this.startupTimestamp;

    if (isStarted) {
      res.status(200).json({
        status: 'started',
        timestamp: new Date().toISOString(),
        uptime,
      });
    } else {
      // Check if we've exceeded startup timeout
      const startupTimeout = this.config.startupTimeoutMs;

      if (uptime > startupTimeout) {
        res.status(503).json({
          status: 'timeout',
          timestamp: new Date().toISOString(),
          uptime,
          error: 'Startup timeout exceeded',
        });
      } else {
        res.status(503).json({
          status: 'starting',
          timestamp: new Date().toISOString(),
          uptime,
        });
      }
    }
  }

  /**
   * Detailed health check handler
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async detailedHealthHandler(req: Request, res: Response): Promise<void> {
    const health = await this.relay.getHealthStatus();

    const response: HealthCheckResponse = {
      status: health.status === 'healthy' ? 'pass' : health.status === 'degraded' ? 'warn' : 'fail',
      timestamp: new Date().toISOString(),
      uptime: health.uptime,
      checks: {
        postgres: {
          status: health.components.postgres.status === 'healthy' ? 'pass' : 'fail',
          componentId: 'postgres',
          componentType: 'database',
          time: health.components.postgres.lastCheck?.toISOString() || new Date().toISOString(),
          output: health.components.postgres.error || 'OK',
        },
        rabbitmq: {
          status: health.components.rabbitmq.status === 'healthy' ? 'pass' : 'fail',
          componentId: 'rabbitmq',
          componentType: 'message_queue',
          time: health.components.rabbitmq.lastCheck?.toISOString() || new Date().toISOString(),
          output: health.components.rabbitmq.error || 'OK',
          observedValue: health.components.rabbitmq.details?.circuitBreakerState,
          observedUnit: 'circuit_breaker_state',
        },
        outboxRelay: {
          status: health.components.outboxRelay.status === 'healthy' ? 'pass' : 'fail',
          componentId: 'outboxRelay',
          componentType: 'service',
          time: health.components.outboxRelay.lastCheck?.toISOString() || new Date().toISOString(),
          output: health.components.outboxRelay.error || 'OK',
          observedValue: health.components.outboxRelay.details?.status,
          observedUnit: 'service_state',
        },
      },
    };

    const statusCode = response.status === 'pass' ? 200 : response.status === 'warn' ? 200 : 503;

    res.status(statusCode).json(response);
  }

  /**
   * Statistics handler
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async statsHandler(req: Request, res: Response): Promise<void> {
    const stats = this.relay.getStatistics();
    const outboxStats = await this.relay.getOutboxStatistics();

    res.status(200).json({
      relay: stats,
      outbox: outboxStats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Metrics handler (Prometheus format)
   *
   * @param req - Express request
   * @param res - Express response
   * @private
   */
  private async metricsHandler(req: Request, res: Response): Promise<void> {
    if (!this.metrics) {
      res.status(404).json({ error: 'Metrics not enabled' });
      return;
    }

    try {
      const metrics = await this.metrics.getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.status(200).send(metrics);
    } catch (error) {
      this.logger.error('Failed to get metrics', error as Error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }

  /**
   * Starts the health check server
   *
   * @returns Promise that resolves when started
   */
  public async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Health check server is disabled');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        this.logger.info('Health check server started', {
          port: this.config.port,
          path: this.config.path,
          readinessPath: this.config.readinessPath,
          livenessPath: this.config.livenessPath,
          startupPath: this.config.startupPath,
        });
        resolve();
      });

      this.server.on('error', (error) => {
        this.logger.error('Health check server error', error);
        reject(error);
      });
    });
  }

  /**
   * Stops the health check server
   *
   * @returns Promise that resolves when stopped
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          this.logger.error('Error stopping health check server', error);
          reject(error);
        } else {
          this.logger.info('Health check server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Gets the Express app instance
   *
   * @returns Express app
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Gets the HTTP server instance
   *
   * @returns HTTP server
   */
  public getServer(): http.Server {
    return this.server;
  }

  /**
   * Sets the ready state (for manual control)
   *
   * @param ready - Ready state
   */
  public setReady(ready: boolean): void {
    this.ready = ready;
    this.logger.debug('Ready state changed', { ready });
  }
}

/**
 * Default server instance
 */
let defaultServer: HealthCheckServer | null = null;

/**
 * Gets the default health check server instance
 *
 * @param relay - Outbox relay instance
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @param options - Server options
 * @returns Health check server instance
 */
export function getHealthCheckServer(
  relay: OutboxRelay,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics,
  options?: HealthCheckServerOptions
): HealthCheckServer {
  if (!defaultServer) {
    defaultServer = new HealthCheckServer(relay, logger, metrics, options);
  }
  return defaultServer;
}

/**
 * Creates a new health check server instance
 *
 * @param relay - Outbox relay instance
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @param options - Server options
 * @returns New health check server instance
 */
export function createHealthCheckServer(
  relay: OutboxRelay,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics,
  options?: HealthCheckServerOptions
): HealthCheckServer {
  return new HealthCheckServer(relay, logger, metrics, options);
}

export default HealthCheckServer;
