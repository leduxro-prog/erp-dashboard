/**
 * Rollback Tests Entry Point
 *
 * This file exports all rollback-related tests and provides a unified
 * interface for running rollback drills as part of the release gate.
 */

export * from './RollbackDrillTests';

import type { RollbackDrillSummary, generateRollbackDrillSummary } from './RollbackDrillTests';

/**
 * Combined rollback test report
 */
export interface RollbackTestReport {
  timestamp: string;
  environment: string;
  rollbackReady: boolean;
  drillSummary: RollbackDrillSummary;
  recommendations: string[];
}

/**
 * Run rollback tests and generate report
 */
export async function runRollbackTests(): Promise<RollbackTestReport> {
  const startTime = Date.now();

  try {
    // Import drill summary function
    const summary = await (await import('./RollbackDrillTests')).generateRollbackDrillSummary();

    const duration = Date.now() - startTime;
    const rollbackReady = summary.overallStatus === 'passed' && summary.slaCompliant;

    const recommendations: string[] = [];
    if (!rollbackReady) {
      recommendations.push('Rollback procedure needs improvement');
    }
    if (!summary.slaCompliant) {
      recommendations.push('Rollback exceeds SLA threshold of 5 minutes');
    }

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      rollbackReady,
      drillSummary: summary,
      recommendations,
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      rollbackReady: false,
      drillSummary: {
        timestamp: new Date().toISOString(),
        overallStatus: 'failed',
        totalDuration: Date.now() - startTime,
        phasesCompleted: 0,
        phasesFailed: 1,
        slaCompliant: false,
        details: [],
      },
      recommendations: ['Rollback tests failed to run'],
    };
  }
}
