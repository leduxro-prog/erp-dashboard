import { Logger } from 'winston';
import { IEventBus } from '@shared/module-system';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { CompatibilityEngine } from '../../domain/services/CompatibilityEngine';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IRuleRepository } from '../../domain/repositories/IRuleRepository';
import {
  SessionExpiredError,
  SessionNotFoundError,
  InvalidSessionStatusError,
  EmptyConfigurationError,
  InvalidConfigurationError,
} from '../../domain/errors/configurator.errors';

/**
 * CompleteConfiguration Use-Case
 *
 * Marks a configuration as complete and publishes completion event.
 * Configuration must pass validation before completion.
 *
 * Business Rules:
 * - Session must be ACTIVE
 * - Configuration must not be empty
 * - Configuration must be valid (pass all compatibility checks)
 * - Publishes 'configuration.completed' event for downstream processing
 *
 * @class CompleteConfiguration
 */
export class CompleteConfiguration {
  private compatibilityEngine: CompatibilityEngine;

  /**
   * Create new CompleteConfiguration use-case
   *
   * @param sessionRepository - Session repository
   * @param ruleRepository - Rule repository
   * @param eventBus - Event bus for publishing completion event
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly ruleRepository: IRuleRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger
  ) {
    this.compatibilityEngine = new CompatibilityEngine();
  }

  /**
   * Execute completion use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to completed session
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {InvalidSessionStatusError} If session is not ACTIVE
   * @throws {EmptyConfigurationError} If configuration is empty
   * @throws {InvalidConfigurationError} If configuration fails validation
   */
  async execute(input: {
    sessionToken: string;
  }): Promise<ConfiguratorSession> {
    this.logger.debug('CompleteConfiguration: Starting', {
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
        throw new InvalidSessionStatusError(session.status, 'complete');
      }

      // 3. Check session expiry
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Check configuration not empty
      if (session.items.size === 0) {
        throw new EmptyConfigurationError();
      }

      // 5. Validate configuration
      const rules = await this.ruleRepository.findByConfiguratorType(session.type);
      const items = session.getItems();
      const validation = this.compatibilityEngine.evaluate(items, rules);

      if (!validation.isValid) {
        const errorMessages = validation.violations
          .filter((v) => v.severity === 'error')
          .map((v) => v.message);

        throw new InvalidConfigurationError(
          'Configuration contains validation errors',
          errorMessages
        );
      }

      // 6. Mark session as complete
      session.complete();

      // 7. Save updated session
      const completedSession = await this.sessionRepository.save(session);

      // 8. Publish completion event
      await this.eventBus.publish('configuration.completed', {
        sessionId: completedSession.id,
        sessionToken: completedSession.sessionToken,
        configuratorType: completedSession.type,
        customerId: completedSession.customerId,
        itemCount: completedSession.items.size,
        totalPrice: completedSession.totalPrice,
        completedAt: new Date(),
      });

      this.logger.info('CompleteConfiguration: Configuration completed successfully', {
        sessionId: completedSession.id,
        type: completedSession.type,
        customerId: completedSession.customerId,
        itemCount: completedSession.items.size,
      });

      return completedSession;
    } catch (error) {
      this.logger.error('CompleteConfiguration: Failed to complete configuration', {
        sessionToken: input.sessionToken,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
