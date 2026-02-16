import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { CompatibilityEngine } from '../../domain/services/CompatibilityEngine';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IRuleRepository } from '../../domain/repositories/IRuleRepository';
import {
  SessionExpiredError,
  SessionNotFoundError,
  InvalidSessionStatusError,
  EmptyConfigurationError,
} from '../../domain/errors/configurator.errors';

/**
 * ValidateConfiguration Use-Case
 *
 * Validates a configuration against all compatibility rules.
 * Does not modify the session, only returns validation results.
 *
 * Business Rules:
 * - Session must exist and be ACTIVE
 * - Configuration must contain at least one item
 * - All compatibility rules must be evaluated
 * - Violations are categorized by severity
 *
 * @class ValidateConfiguration
 */
export class ValidateConfiguration {
  private compatibilityEngine: CompatibilityEngine;

  /**
   * Create new ValidateConfiguration use-case
   *
   * @param sessionRepository - Session repository
   * @param ruleRepository - Rule repository
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly ruleRepository: IRuleRepository,
    private readonly logger: Logger
  ) {
    this.compatibilityEngine = new CompatibilityEngine();
  }

  /**
   * Execute validation use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to validation result
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {InvalidSessionStatusError} If session is not ACTIVE
   * @throws {EmptyConfigurationError} If configuration is empty
   */
  async execute(input: {
    sessionToken: string;
  }): Promise<{
    isValid: boolean;
    violations: Array<{
      ruleId: string;
      ruleName: string;
      message: string;
      severity: 'error' | 'warning';
      affectedItems: string[];
    }>;
    suggestions: string[];
    errorCount: number;
    warningCount: number;
  }> {
    this.logger.debug('ValidateConfiguration: Starting', {
      sessionToken: input.sessionToken,
    });

    try {
      // 1. Find session
      const session = await this.sessionRepository.findByToken(input.sessionToken);
      if (!session) {
        throw new SessionNotFoundError(input.sessionToken);
      }

      // 2. Check session status
      if (session.status !== 'ACTIVE') {
        throw new InvalidSessionStatusError(session.status, 'validate configuration in');
      }

      // 3. Check session expiry
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Check configuration not empty
      if (session.items.size === 0) {
        throw new EmptyConfigurationError();
      }

      // 5. Get rules for configurator type
      const rules = await this.ruleRepository.findByConfiguratorType(session.type);

      // 6. Evaluate compatibility
      const items = session.getItems();
      const validation = this.compatibilityEngine.evaluate(items, rules);

      // 7. Count violations by severity
      const errorCount = validation.violations.filter((v) => v.severity === 'error').length;
      const warningCount = validation.violations.filter((v) => v.severity === 'warning').length;

      this.logger.info('ValidateConfiguration: Validation completed', {
        sessionId: session.id,
        isValid: validation.isValid,
        errorCount,
        warningCount,
        itemCount: session.items.size,
      });

      return {
        isValid: validation.isValid,
        violations: validation.violations,
        suggestions: validation.suggestions,
        errorCount,
        warningCount,
      };
    } catch (error) {
      this.logger.error('ValidateConfiguration: Validation failed', {
        sessionToken: input.sessionToken,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
