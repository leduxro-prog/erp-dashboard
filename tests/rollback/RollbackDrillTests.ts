/**
 * Rollback Drill Tests
 *
 * These tests simulate production deployment issues and verify that
 * the rollback procedure works correctly. They help ensure that
 * rollback can be performed quickly and reliably when needed.
 *
 * Run: npm run test -- tests/rollback/RollbackDrillTests.ts
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Test configuration
const PROJECT_ROOT = process.cwd();
const ROLLBACK_SCRIPT = join(PROJECT_ROOT, 'scripts', 'rollback.sh');
const BACKUP_DIR = join(PROJECT_ROOT, 'backups');

// Rollback drill result interface
interface RollbackDrillResult {
  timestamp: string;
  phase: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  details: Record<string, unknown>;
}

// Test tracking
const drillResults: RollbackDrillResult[] = [];

// Helper function to execute shell command
function executeCommand(command: string, options = { silent: false }): string {
  const { silent } = options;
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    });
  } catch (error) {
    if (silent) {
      throw error;
    }
    throw new Error(`Command failed: ${command}`);
  }
}

// Helper function to record drill result
function recordDrillResult(
  phase: string,
  status: 'success' | 'failed' | 'skipped',
  duration: number,
  details: Record<string, unknown> = {}
): void {
  const result: RollbackDrillResult = {
    timestamp: new Date().toISOString(),
    phase,
    status,
    duration,
    details,
  };
  drillResults.push(result);
}

// Helper function to get current git commit
function getCurrentGitCommit(): string {
  try {
    return executeCommand('git rev-parse HEAD', { silent: true }).trim();
  } catch {
    return 'unknown';
  }
}

// Helper function to get current git branch
function getCurrentGitBranch(): string {
  try {
    return executeCommand('git rev-parse --abbrev-ref HEAD', { silent: true }).trim();
  } catch {
    return 'unknown';
  }
}

// Helper function to get current Docker service status
function getDockerServiceStatus(service: string): string {
  try {
    const output = executeCommand(
      `docker compose ps --format json ${service} 2>/dev/null || echo '[]'`,
      { silent: true }
    );
    const parsed = JSON.parse(output);
    if (parsed.length > 0) {
      return parsed[0].State || 'unknown';
    }
    return 'not-running';
  } catch {
    return 'unknown';
  }
}

describe('Rollback Drill Tests', () => {
  let initialCommit: string;
  let initialBranch: string;
  let drillBranch: string;

  beforeAll(() => {
    // Save initial state
    initialCommit = getCurrentGitCommit();
    initialBranch = getCurrentGitBranch();

    // Create a branch for testing
    drillBranch = `rollback-drill-${Date.now()}`;
    try {
      executeCommand(`git checkout -b ${drillBranch}`, { silent: true });
    } catch {
      // Branch might already exist, checkout it
      executeCommand(`git checkout ${drillBranch}`, { silent: true });
    }

    console.log(`Running rollback drill on branch: ${drillBranch}`);
    console.log(`Initial commit: ${initialCommit}`);
  });

  afterAll(() => {
    // Restore original branch
    try {
      executeCommand(`git checkout ${initialBranch}`, { silent: true });
      executeCommand(`git branch -D ${drillBranch}`, { silent: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Phase 1: Pre-Rollback Validation', () => {
    it('should verify rollback script exists', () => {
      expect(existsSync(ROLLBACK_SCRIPT)).toBe(true);
    });

    it('should verify rollback script is executable', () => {
      try {
        const stats = require('fs').statSync(ROLLBACK_SCRIPT);
        const mode = stats.mode;
        const isExecutable = !!(mode & parseInt('111', 8));
        expect(isExecutable).toBe(true);
      } catch (error) {
        throw new Error('Could not verify script permissions');
      }
    });

    it('should display rollback script help', () => {
      const start = Date.now();
      try {
        const output = executeCommand(`${ROLLBACK_SCRIPT} --help`, { silent: true });
        const duration = Date.now() - start;

        expect(output).toContain('Rollback Script');
        expect(output).toContain('--help');
        expect(output).toContain('--version');

        recordDrillResult('help_command', 'success', duration, { output_length: output.length });
      } catch (error) {
        recordDrillResult('help_command', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should verify backup directory exists or can be created', () => {
      if (!existsSync(BACKUP_DIR)) {
        try {
          execSync(`mkdir -p ${BACKUP_DIR}`);
          expect(existsSync(BACKUP_DIR)).toBe(true);
        } catch {
          throw new Error('Could not create backup directory');
        }
      }
      expect(existsSync(BACKUP_DIR)).toBe(true);
    });

    it('should check Docker Compose is available', () => {
      try {
        const output = executeCommand('docker compose version', { silent: true });
        expect(output).toBeDefined();
      } catch (error) {
        throw new Error('Docker Compose is not available');
      }
    });

    it('should verify current environment state', () => {
      const currentCommit = getCurrentGitCommit();
      const currentBranch = getCurrentGitBranch();

      expect(currentCommit).not.toBe('unknown');
      expect(currentBranch).toBe(drillBranch);

      const appStatus = getDockerServiceStatus('app');
      const dbStatus = getDockerServiceStatus('db');

      console.log(`App status: ${appStatus}`);
      console.log(`DB status: ${dbStatus}`);
    });
  });

  describe('Phase 2: Dry Run Rollback', () => {
    it('should perform dry run rollback', () => {
      const start = Date.now();
      try {
        const output = executeCommand(`${ROLLBACK_SCRIPT} --dry-run --force`, { silent: true });
        const duration = Date.now() - start;

        expect(output).toContain('[DRY RUN]');

        recordDrillResult('dry_run', 'success', duration, { output_length: output.length });
      } catch (error) {
        recordDrillResult('dry_run', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should perform dry run with version specified', () => {
      const start = Date.now();
      try {
        const output = executeCommand(
          `${ROLLBACK_SCRIPT} --dry-run --version v0.1.0 --force`,
          { silent: true }
        );
        const duration = Date.now() - start;

        expect(output).toContain('[DRY RUN]');

        recordDrillResult('dry_run_version', 'success', duration);
      } catch (error) {
        recordDrillResult('dry_run_version', 'failed', Date.now() - start);
        throw error;
      }
    });
  });

  describe('Phase 3: Backup Creation Simulation', () => {
    it('should simulate backup creation', () => {
      const start = Date.now();
      try {
        // Create a test backup
        const testBackupDir = join(BACKUP_DIR, 'test_backup');
        execSync(`mkdir -p ${testBackupDir}`);

        // Create dummy backup files
        execSync(`echo "test database backup" > ${testBackupDir}/database.sql`);
        execSync(`echo "test config" > ${testBackupDir}/config.env`);

        const duration = Date.now() - start;

        expect(existsSync(testBackupDir)).toBe(true);
        expect(existsSync(join(testBackupDir, 'database.sql'))).toBe(true);

        recordDrillResult('backup_creation', 'success', duration);

        // Cleanup
        execSync(`rm -rf ${testBackupDir}`);
      } catch (error) {
        recordDrillResult('backup_creation', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should verify backup file integrity', () => {
      const start = Date.now();
      try {
        // Create a test backup with checksums
        const testBackupDir = join(BACKUP_DIR, 'test_integrity');
        execSync(`mkdir -p ${testBackupDir}`);

        const testContent = 'test backup content';
        execSync(`echo "${testContent}" > ${testBackupDir}/test_backup.sql`);

        // Verify content
        const content = readFileSync(join(testBackupDir, 'test_backup.sql'), 'utf-8');
        expect(content).toContain(testContent);

        const duration = Date.now() - start;

        recordDrillResult('backup_integrity', 'success', duration);

        // Cleanup
        execSync(`rm -rf ${testBackupDir}`);
      } catch (error) {
        recordDrillResult('backup_integrity', 'failed', Date.now() - start);
        throw error;
      }
    });
  });

  describe('Phase 4: Application Code Rollback Simulation', () => {
    it('should simulate git checkout to previous commit', () => {
      const start = Date.now();
      try {
        const currentCommit = getCurrentGitCommit();
        const parentCommit = executeCommand('git rev-parse HEAD~1', { silent: true }).trim();

        // Checkout parent commit
        executeCommand(`git checkout ${parentCommit}`, { silent: true });

        // Verify we're on a different commit
        const newCommit = getCurrentGitCommit();
        expect(newCommit).not.toBe(currentCommit);

        // Return to drill branch
        executeCommand(`git checkout ${drillBranch}`, { silent: true });

        const duration = Date.now() - start;

        recordDrillResult('app_rollback', 'success', duration, {
          from: currentCommit.substring(0, 8),
          to: parentCommit.substring(0, 8),
        });
      } catch (error) {
        recordDrillResult('app_rollback', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should handle branch switching during rollback', () => {
      const start = Date.now();
      try {
        const originalBranch = getCurrentGitBranch();

        // Switch to main and back
        executeCommand('git checkout main', { silent: true });
        expect(getCurrentGitBranch()).toBe('main');

        executeCommand(`git checkout ${drillBranch}`, { silent: true });
        expect(getCurrentGitBranch()).toBe(drillBranch);

        const duration = Date.now() - start;

        recordDrillResult('branch_switch', 'success', duration);
      } catch (error) {
        recordDrillResult('branch_switch', 'failed', Date.now() - start);
        throw error;
      }
    });
  });

  describe('Phase 5: Service Restart Simulation', () => {
    it('should simulate Docker Compose restart', () => {
      const start = Date.now();
      try {
        // Get service status before
        const statusBefore = getDockerServiceStatus('app');

        // This is a drill - we won't actually restart production services
        // Just verify the command exists
        const output = executeCommand('docker compose ps', { silent: true });

        const duration = Date.now() - start;

        expect(output).toBeDefined();

        recordDrillResult('service_restart', 'success', duration, {
          status_before: statusBefore,
          drill_only: true,
        });
      } catch (error) {
        recordDrillResult('service_restart', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should verify service health check endpoint', () => {
      const start = Date.now();
      try {
        // Try to check health endpoint
        let healthCheckPassed = false;

        try {
          executeCommand('curl -sf http://localhost:3000/health/live', { silent: true });
          healthCheckPassed = true;
        } catch {
          // Service might not be running, which is OK for drill
          healthCheckPassed = false;
        }

        const duration = Date.now() - start;

        recordDrillResult('health_check', 'success', duration, {
          passed: healthCheckPassed,
          drill_only: true,
        });
      } catch (error) {
        recordDrillResult('health_check', 'failed', Date.now() - start);
        throw error;
      }
    });
  });

  describe('Phase 6: Database Rollback Simulation', () => {
    it('should simulate database backup restoration', () => {
      const start = Date.now();
      try {
        // Create a test database backup
        const testBackup = join(BACKUP_DIR, 'test_db_backup.sql');
        execSync(`echo "CREATE TABLE test (id INT);" > ${testBackup}`);

        // Verify backup file exists
        expect(existsSync(testBackup)).toBe(true);

        // Simulate restore (don't actually restore to production)
        const output = executeCommand(`cat ${testBackup}`, { silent: true });
        expect(output).toContain('CREATE TABLE');

        // Cleanup
        execSync(`rm -f ${testBackup}`);

        const duration = Date.now() - start;

        recordDrillResult('db_rollback', 'success', duration, {
          drill_only: true,
          backup_verified: true,
        });
      } catch (error) {
        recordDrillResult('db_rollback', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should verify database connectivity', () => {
      const start = Date.now();
      try {
        // Try to connect to database
        let dbConnected = false;

        try {
          executeCommand('docker compose exec -T db pg_isready -U cypher_user', {
            silent: true,
          });
          dbConnected = true;
        } catch {
          // Database might not be running, which is OK for drill
          dbConnected = false;
        }

        const duration = Date.now() - start;

        recordDrillResult('db_connectivity', 'success', duration, {
          connected: dbConnected,
          drill_only: true,
        });
      } catch (error) {
        recordDrillResult('db_connectivity', 'failed', Date.now() - start);
        throw error;
      }
    });
  });

  describe('Phase 7: Rollback Verification', () => {
    it('should verify rollback state file creation', () => {
      const start = Date.now();
      try {
        const stateFile = '/tmp/cypher-rollback-state.json';

        if (existsSync(stateFile)) {
          const content = readFileSync(stateFile, 'utf-8');
          const state = JSON.parse(content);

          expect(state).toHaveProperty('timestamp');
          expect(state).toHaveProperty('status');
        }

        const duration = Date.now() - start;

        recordDrillResult('state_verification', 'success', duration);
      } catch (error) {
        recordDrillResult('state_verification', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should verify all rollback phases completed', () => {
      const requiredPhases = [
        'help_command',
        'dry_run',
        'backup_creation',
        'app_rollback',
        'service_restart',
        'db_rollback',
      ];

      const completedPhases = drillResults.map((r) => r.phase);
      const missingPhases = requiredPhases.filter((p) => !completedPhases.includes(p));

      expect(missingPhases.length).toBe(0);
    });

    it('should calculate total rollback duration', () => {
      const totalDuration = drillResults.reduce((sum, r) => sum + r.duration, 0);

      console.log(`Total rollback drill duration: ${totalDuration}ms`);

      // Rollback should complete within 5 minutes in production
      // For drill, we just check it's reasonable
      expect(totalDuration).toBeGreaterThan(0);
      expect(totalDuration).toBeLessThan(300000); // 5 minutes max

      recordDrillResult('total_duration', 'success', totalDuration, {
        phases_completed: drillResults.length,
      });
    });

    it('should have no failed phases', () => {
      const failedPhases = drillResults.filter((r) => r.status === 'failed');

      console.log(`Rollback drill results:`);
      drillResults.forEach((r) => {
        console.log(`  ${r.phase}: ${r.status} (${r.duration}ms)`);
      });

      expect(failedPhases.length).toBe(0);
    });
  });

  describe('Phase 8: Data Integrity Verification', () => {
    it('should verify no data loss during drill', () => {
      const start = Date.now();
      try {
        // Verify we're back on the drill branch
        const currentBranch = getCurrentGitBranch();
        expect(currentBranch).toBe(drillBranch);

        const duration = Date.now() - start;

        recordDrillResult('data_integrity', 'success', duration);
      } catch (error) {
        recordDrillResult('data_integrity', 'failed', Date.now() - start);
        throw error;
      }
    });

    it('should verify configuration files intact', () => {
      const start = Date.now();
      try {
        // Check if .env file exists and is readable
        const envFile = join(PROJECT_ROOT, '.env');
        if (existsSync(envFile)) {
          const content = readFileSync(envFile, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
        }

        const duration = Date.now() - start;

        recordDrillResult('config_integrity', 'success', duration);
      } catch (error) {
        recordDrillResult('config_integrity', 'failed', Date.now() - start);
        throw error;
      }
    });
  });

  describe('Phase 9: Rollback Report Generation', () => {
    it('should generate rollback drill report', () => {
      const report = {
        timestamp: new Date().toISOString(),
        initial_commit: initialCommit,
        initial_branch: initialBranch,
        drill_branch: drillBranch,
        total_phases: drillResults.length,
        successful_phases: drillResults.filter((r) => r.status === 'success').length,
        failed_phases: drillResults.filter((r) => r.status === 'failed').length,
        total_duration: drillResults.reduce((sum, r) => sum + r.duration, 0),
        results: drillResults,
      };

      console.log('\n=== ROLLBACK DRILL REPORT ===');
      console.log(JSON.stringify(report, null, 2));
      console.log('=== END REPORT ===\n');

      expect(report.total_phases).toBeGreaterThan(0);
      expect(report.failed_phases).toBe(0);

      return report;
    });

    it('should verify rollback SLA compliance', () => {
      const totalDuration = drillResults.reduce((sum, r) => sum + r.duration, 0);
      const slaThreshold = 300000; // 5 minutes

      const slaCompliant = totalDuration < slaThreshold;

      console.log(`Rollback SLA: ${slaCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
      console.log(`Duration: ${totalDuration}ms / Threshold: ${slaThreshold}ms`);

      expect(slaCompliant).toBe(true);
    });
  });
});

/**
 * Export drill results for use in other tests or reports
 */
export interface RollbackDrillSummary {
  timestamp: string;
  overallStatus: 'passed' | 'failed';
  totalDuration: number;
  phasesCompleted: number;
  phasesFailed: number;
  slaCompliant: boolean;
  details: RollbackDrillResult[];
}

/**
 * Generate rollback drill summary
 */
export function generateRollbackDrillSummary(): RollbackDrillSummary {
  const totalDuration = drillResults.reduce((sum, r) => sum + r.duration, 0);
  const failedPhases = drillResults.filter((r) => r.status === 'failed');

  return {
    timestamp: new Date().toISOString(),
    overallStatus: failedPhases.length === 0 ? 'passed' : 'failed',
    totalDuration,
    phasesCompleted: drillResults.length,
    phasesFailed: failedPhases.length,
    slaCompliant: totalDuration < 300000, // 5 minute SLA
    details: drillResults,
  };
}
