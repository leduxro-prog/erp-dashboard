/**
 * Smoke Tests Entry Point
 *
 * This file exports all smoke tests and provides a unified interface
 * for running smoke tests as part of the release gate.
 */

export * from './ApiSmokeTests';
export * from './DatabaseSmokeTests';
export * from './EventBusSmokeTests';

import type { SmokeTestReport } from './ApiSmokeTests';
import type { DatabaseSmokeTestReport } from './DatabaseSmokeTests';
import type { EventBusSmokeTestReport } from './EventBusSmokeTests';

/**
 * Combined smoke test report
 */
export interface CombinedSmokeTestReport {
  timestamp: string;
  environment: string;
  duration: number;
  overallStatus: 'pass' | 'fail' | 'degraded';
  api: SmokeTestReport;
  database: DatabaseSmokeTestReport;
  eventBus: EventBusSmokeTestReport;
  recommendations: string[];
}

/**
 * Run all smoke tests and generate combined report
 */
export async function runSmokeTests(): Promise<CombinedSmokeTestReport> {
  const startTime = Date.now();

  // Import test functions
  const { generateSmokeTestReport } = await import('./ApiSmokeTests');
  const { generateDatabaseSmokeTestReport } = await import('./DatabaseSmokeTests');
  const { generateEventBusSmokeTestReport } = await import('./EventBusSmokeTests');

  const [apiReport, databaseReport, eventBusReport] = await Promise.all([
    generateSmokeTestReport().catch(() => null),
    generateDatabaseSmokeTestReport().catch(() => null),
    generateEventBusSmokeTestReport().catch(() => null),
  ]);

  const duration = Date.now() - startTime;

  // Determine overall status
  let overallStatus: 'pass' | 'fail' | 'degraded' = 'pass';
  const recommendations: string[] = [];

  if (!apiReport || !databaseReport) {
    overallStatus = 'fail';
    recommendations.push('Critical services not responding');
  } else if (!apiReport.healthCheck.readiness || !apiReport.connectivity.database) {
    overallStatus = 'degraded';
    recommendations.push('Some dependencies not fully ready');
  }

  if (!eventBusReport) {
    recommendations.push('Event bus not configured or not responding');
  }

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    duration,
    overallStatus,
    api: apiReport || {} as SmokeTestReport,
    database: databaseReport || {} as DatabaseSmokeTestReport,
    eventBus: eventBusReport || {} as EventBusSmokeTestReport,
    recommendations,
  };
}
