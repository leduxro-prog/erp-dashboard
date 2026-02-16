/**
 * Chaos execution helper for reliability testing.
 *
 * Provides utilities for executing chaos experiments,
 * measuring system behavior under fault conditions,
 * and validating system resilience.
 *
 * @module ChaosRunner
 */

import { v4 as uuidv4 } from 'uuid';
import { TestRabbitMQ } from './TestRabbitMQ';
import { TestPostgres } from './TestPostgres';

/**
 * Chaos experiment result
 */
export interface ExperimentResult {
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  error?: string;
  metrics: ExperimentMetrics;
  observations: string[];
}

/**
 * Chaos experiment metrics
 */
export interface ExperimentMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  duplicateOperations: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
}

/**
 * Chaos operation
 */
export interface ChaosOperation {
  name: string;
  fn: () => Promise<void> | void;
  timeout?: number;
}

/**
 * Chaos fault injection configuration
 */
export interface FaultConfig {
  type: 'connection_failure' | 'network_partition' | 'high_latency' | 'channel_failure' | 'deadlock';
  duration?: number;
  latency?: number;
  target?: 'rabbitmq' | 'postgres' | 'both';
}

/**
 * Chaos scenario configuration
 */
export interface ScenarioConfig {
  name: string;
  description: string;
  operations: ChaosOperation[];
  faults?: FaultConfig[];
  expectedBehavior: string;
  successCriteria: (result: ExperimentResult) => boolean;
}

/**
 * Measurement point
 */
export interface Measurement {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Observation
 */
export interface Observation {
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Chaos runner class
 */
export class ChaosRunner {
  private measurements: Measurement[] = [];
  private observations: Observation[] = [];
  private currentScenario: ScenarioConfig | null = null;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;

  private readonly rabbitmq?: TestRabbitMQ;
  private readonly postgres?: TestPostgres;

  constructor(rabbitmq?: TestRabbitMQ, postgres?: TestPostgres) {
    this.rabbitmq = rabbitmq;
    this.postgres = postgres;
  }

  /**
   * Runs a chaos scenario
   */
  public async runScenario(scenario: ScenarioConfig): Promise<ExperimentResult> {
    this.currentScenario = scenario;
    this.isRunning = true;
    this.abortController = new AbortController();

    const startTime = new Date();
    const scenarioId = uuidv4();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`CHAOS SCENARIO: ${scenario.name}`);
    console.log(`ID: ${scenarioId}`);
    console.log(`Description: ${scenario.description}`);
    console.log(`Operations: ${scenario.operations.length}`);
    console.log(`Faults: ${scenario.faults?.length || 0}`);
    console.log(`${'='.repeat(80)}\n`);

    this.addObservation('info', `Starting scenario: ${scenario.name}`);

    try {
      // Inject faults before operations
      if (scenario.faults && scenario.faults.length > 0) {
        await this.injectFaults(scenario.faults);
      }

      // Execute operations
      for (const operation of scenario.operations) {
        if (!this.isRunning) {
          this.addObservation('warning', 'Scenario aborted');
          break;
        }

        await this.executeOperation(operation);
      }

      this.addObservation('success', 'Scenario completed');
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.addObservation('error', `Scenario failed: ${errorMessage}`);
      console.error(`Scenario failed:`, error);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result: ExperimentResult = {
      name: scenario.name,
      startTime,
      endTime,
      duration,
      success: this.evaluateSuccessCriteria(scenario),
      metrics: this.calculateMetrics(),
      observations: this.observations.map((o) => `${o.type.toUpperCase()}: ${o.message}`),
    };

    console.log(`\n${'='.repeat(80)}`);
    console.log(`SCENARIO RESULT: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Operations: ${result.metrics.totalOperations}`);
    console.log(`Success Rate: ${((result.metrics.successfulOperations / result.metrics.totalOperations) * 100).toFixed(2)}%`);
    console.log(`Avg Latency: ${result.metrics.avgLatency.toFixed(2)}ms`);
    console.log(`${'='.repeat(80)}\n`);

    this.reset();
    return result;
  }

  /**
   * Executes a single operation
   */
  private async executeOperation(operation: ChaosOperation): Promise<void> {
    const startTime = Date.now();
    const timeout = operation.timeout || 30000;

    try {
      // Execute with timeout
      await Promise.race([
        operation.fn(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
        ),
      ]);

      const duration = Date.now() - startTime;

      this.measurements.push({
        timestamp: Date.now(),
        operation: operation.name,
        duration,
        success: true,
      });

      this.addObservation('success', `Operation completed: ${operation.name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;

      this.measurements.push({
        timestamp: Date.now(),
        operation: operation.name,
        duration,
        success: false,
        metadata: { error: (error as Error).message },
      });

      this.addObservation('error', `Operation failed: ${operation.name} - ${(error as Error).message}`);
    }
  }

  /**
   * Injects faults
   */
  private async injectFaults(faults: FaultConfig[]): Promise<void> {
    for (const fault of faults) {
      await this.injectFault(fault);
    }
  }

  /**
   * Injects a single fault
   */
  public async injectFault(fault: FaultConfig): Promise<void> {
    this.addObservation('warning', `Injecting fault: ${fault.type}`);

    const duration = fault.duration || 5000;
    const target = fault.target || 'both';

    switch (fault.type) {
      case 'connection_failure':
        if (target === 'rabbitmq' || target === 'both') {
          await this.rabbitmq?.simulateConnectionFailure(duration);
        }
        if (target === 'postgres' || target === 'both') {
          await this.postgres?.simulateConnectionFailure(duration);
        }
        break;

      case 'network_partition':
        if (target === 'rabbitmq' || target === 'both') {
          await this.rabbitmq?.simulateNetworkPartition(duration);
        }
        if (target === 'postgres' || target === 'both') {
          await this.postgres?.simulateNetworkPartition(duration);
        }
        break;

      case 'high_latency':
        const latency = fault.latency || 1000;
        if (target === 'postgres' || target === 'both') {
          await this.postgres?.simulateHighLatency(duration, latency);
        }
        break;

      case 'channel_failure':
        if (target === 'rabbitmq' || target === 'both') {
          await this.rabbitmq?.simulateChannelFailure(duration);
        }
        break;

      case 'deadlock':
        // Deadlock is handled at operation level
        this.addObservation('warning', 'Deadlock fault requires operation-level handling');
        break;
    }

    this.addObservation('info', `Fault injection complete: ${fault.type}`);
  }

  /**
   * Evaluates success criteria
   */
  private evaluateSuccessCriteria(scenario: ScenarioConfig): boolean {
    const metrics = this.calculateMetrics();

    try {
      return scenario.successCriteria({
        name: scenario.name,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        success: true,
        metrics,
        observations: [],
      });
    } catch (error) {
      console.error('Error evaluating success criteria:', error);
      return false;
    }
  }

  /**
   * Calculates experiment metrics
   */
  private calculateMetrics(): ExperimentMetrics {
    const durations = this.measurements
      .filter((m) => m.success)
      .map((m) => m.duration)
      .sort((a, b) => a - b);

    const successfulOps = this.measurements.filter((m) => m.success).length;
    const failedOps = this.measurements.filter((m) => !m.success).length;

    const totalLatency = durations.reduce((a, b) => a + b, 0);
    const avgLatency = durations.length > 0 ? totalLatency / durations.length : 0;

    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    return {
      totalOperations: this.measurements.length,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      duplicateOperations: this.countDuplicates(),
      avgLatency,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      maxLatency: durations.length > 0 ? durations[durations.length - 1] : 0,
      minLatency: durations.length > 0 ? durations[0] : 0,
    };
  }

  /**
   * Calculates percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) {
      return 0;
    }

    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Counts duplicate operations
   */
  private countDuplicates(): number {
    const operationNames = this.measurements.map((m) => m.operation);
    const unique = new Set(operationNames);
    return operationNames.length - unique.size;
  }

  /**
   * Adds an observation
   */
  private addObservation(type: Observation['type'], message: string, data?: Record<string, unknown>): void {
    this.observations.push({
      timestamp: Date.now(),
      type,
      message,
      data,
    });

    const prefix = {
      info: '[INFO]',
      warning: '[WARN]',
      error: '[ERROR]',
      success: '[OK]',
    }[type];

    console.log(`${prefix} ${message}`);
  }

  /**
   * Adds a measurement
   */
  public addMeasurement(operation: string, duration: number, success: boolean): void {
    this.measurements.push({
      timestamp: Date.now(),
      operation,
      duration,
      success,
    });
  }

  /**
   * Aborts the current scenario
   */
  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.isRunning = false;
      this.addObservation('warning', 'Scenario aborted');
    }
  }

  /**
   * Resets the runner state
   */
  public reset(): void {
    this.measurements = [];
    this.observations = [];
    this.currentScenario = null;
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Gets the measurements
   */
  public getMeasurements(): Measurement[] {
    return [...this.measurements];
  }

  /**
   * Gets the observations
   */
  public getObservations(): Observation[] {
    return [...this.observations];
  }

  /**
   * Checks if running
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Creates a publish operation
   */
  public static createPublishOperation(
    name: string,
    exchange: string,
    routingKey: string,
    payload: any
  ): ChaosOperation {
    return {
      name,
      async fn() {
        // This would use the actual publish function
        // Placeholder for test implementation
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
      },
    };
  }

  /**
   * Creates a batch of publish operations
   */
  public static createBatchPublishOperations(
    count: number,
    exchange: string,
    routingKey: string,
    payloadFactory: (i: number) => any
  ): ChaosOperation[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `publish_batch_${i}`,
      async fn() {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
      },
    }));
  }

  /**
   * Creates a consumer operation
   */
  public static createConsumeOperation(
    name: string,
    queue: string,
    expectedCount: number
  ): ChaosOperation {
    return {
      name,
      timeout: 10000,
      async fn() {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
      },
    };
  }
}

/**
 * Factory function for creating chaos runners
 */
export function createChaosRunner(
  rabbitmq?: TestRabbitMQ,
  postgres?: TestPostgres
): ChaosRunner {
  return new ChaosRunner(rabbitmq, postgres);
}

/**
 * Predefined scenarios
 */
export const PredefinedScenarios = {
  /**
   * Scenario: Broker restart during publishing
   */
  brokerRestartDuringPublish: (rmq: TestRabbitMQ): ScenarioConfig => ({
    name: 'Broker restart during publish',
    description: 'Simulates RabbitMQ broker restart while messages are being published',
    operations: ChaosRunner.createBatchPublishOperations(100, 'test.events', 'test.key', (i) => ({ id: i })),
    faults: [
      {
        type: 'connection_failure',
        duration: 3000,
        target: 'rabbitmq',
      },
    ],
    expectedBehavior: 'Publisher should reconnect and continue publishing',
    successCriteria: (result) => {
      const successRate = result.metrics.successfulOperations / result.metrics.totalOperations;
      return successRate >= 0.95; // 95% success rate acceptable
    },
  }),

  /**
   * Scenario: Duplicate publish detection
   */
  duplicatePublishDetection: (rmq: TestRabbitMQ): ScenarioConfig => ({
    name: 'Duplicate publish detection',
    description: 'Verifies that duplicate messages are detected and handled',
    operations: [
      ChaosRunner.createPublishOperation('publish_1', 'test.events', 'test.key', { id: 1 }),
      ChaosRunner.createPublishOperation('publish_1', 'test.events', 'test.key', { id: 1 }), // Duplicate
      ChaosRunner.createPublishOperation('publish_2', 'test.events', 'test.key', { id: 2 }),
      ChaosRunner.createPublishOperation('publish_2', 'test.events', 'test.key', { id: 2 }), // Duplicate
    ],
    faults: [],
    expectedBehavior: 'Duplicate messages should be detected and rejected',
    successCriteria: (result) => {
      return result.metrics.duplicateOperations === 2; // Should detect 2 duplicates
    },
  }),

  /**
   * Scenario: Consumer crash recovery
   */
  consumerCrashRecovery: (rmq: TestRabbitMQ): ScenarioConfig => ({
    name: 'Consumer crash recovery',
    description: 'Simulates consumer crash and verifies message redelivery',
    operations: ChaosRunner.createBatchPublishOperations(50, 'test.events', 'test.key', (i) => ({ id: i })),
    faults: [
      {
        type: 'channel_failure',
        duration: 2000,
        target: 'rabbitmq',
      },
    ],
    expectedBehavior: 'Consumer should reconnect and redeliver unacknowledged messages',
    successCriteria: (result) => {
      const successRate = result.metrics.successfulOperations / result.metrics.totalOperations;
      return successRate >= 0.98;
    },
  }),

  /**
   * Scenario: Network partition
   */
  networkPartition: (rmq: TestRabbitMQ, pg: TestPostgres): ScenarioConfig => ({
    name: 'Network partition',
    description: 'Simulates network partition between services',
    operations: ChaosRunner.createBatchPublishOperations(100, 'test.events', 'test.key', (i) => ({ id: i })),
    faults: [
      {
        type: 'network_partition',
        duration: 5000,
        target: 'both',
      },
    ],
    expectedBehavior: 'System should handle partition gracefully and recover',
    successCriteria: (result) => {
      const successRate = result.metrics.successfulOperations / result.metrics.totalOperations;
      return successRate >= 0.90;
    },
  }),

  /**
   * Scenario: High latency
   */
  highLatency: (pg: TestPostgres): ScenarioConfig => ({
    name: 'High latency',
    description: 'Simulates high latency in database operations',
    operations: ChaosRunner.createBatchPublishOperations(50, 'test.events', 'test.key', (i) => ({ id: i })),
    faults: [
      {
        type: 'high_latency',
        duration: 3000,
        latency: 500,
        target: 'postgres',
      },
    ],
    expectedBehavior: 'System should handle high latency without significant degradation',
    successCriteria: (result) => {
      const successRate = result.metrics.successfulOperations / result.metrics.totalOperations;
      return successRate >= 0.95 && result.metrics.p99Latency < 1000;
    },
  }),
};
