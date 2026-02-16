import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { CompatibilityEngine } from '../../domain/services/CompatibilityEngine';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IRuleRepository } from '../../domain/repositories/IRuleRepository';
import {
  SessionExpiredError,
  SessionNotFoundError,
  InvalidSessionStatusError,
  IncompatibleComponentError,
} from '../../domain/errors/configurator.errors';

/**
 * UpdateComponent Use-Case
 *
 * Updates quantity or properties of an existing configuration item.
 * Re-validates compatibility after update.
 *
 * Business Rules:
 * - Session must be ACTIVE
 * - Item must exist in session
 * - Updated configuration must pass compatibility checks
 * - Session must not be expired
 *
 * @class UpdateComponent
 */
export class UpdateComponent {
  private compatibilityEngine: CompatibilityEngine;

  /**
   * Create new UpdateComponent use-case
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
   * Execute update component use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to updated session
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {InvalidSessionStatusError} If session is not ACTIVE
   * @throws {IncompatibleComponentError} If update violates rules
   */
  async execute(input: {
    sessionToken: string;
    itemId: string;
    quantity?: number;
    properties?: Record<string, unknown>;
  }): Promise<ConfiguratorSession> {
    this.logger.debug('UpdateComponent: Starting', {
      sessionToken: input.sessionToken,
      itemId: input.itemId,
      quantity: input.quantity,
    });

    try {
      // 1. Find session
      const session = await this.sessionRepository.findByToken(input.sessionToken);
      if (!session) {
        throw new SessionNotFoundError(input.sessionToken);
      }

      // 2. Check session status
      if (session.status !== 'ACTIVE') {
        throw new InvalidSessionStatusError(session.status, 'update components in');
      }

      // 3. Check session expiry
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Update item
      const updates: any = {};
      if (input.quantity !== undefined) {
        updates.quantity = input.quantity;
      }
      if (input.properties !== undefined) {
        updates.properties = input.properties;
      }

      session.updateItem(input.itemId, updates);

      // 5. Validate compatibility with all rules
      const rules = await this.ruleRepository.findByConfiguratorType(session.type);
      const items = session.getItems();
      const validation = this.compatibilityEngine.evaluate(items, rules);

      if (!validation.isValid) {
        const errorMessages = validation.violations
          .filter((v) => v.severity === 'error')
          .map((v) => v.message);

        throw new IncompatibleComponentError(
          session.items.get(input.itemId)?.componentType || 'Unknown',
          errorMessages.join('; ')
        );
      }

      // 6. Save session
      const savedSession = await this.sessionRepository.save(session);

      this.logger.info('UpdateComponent: Component updated successfully', {
        sessionId: savedSession.id,
        itemId: input.itemId,
        quantity: input.quantity,
      });

      return savedSession;
    } catch (error) {
      this.logger.error('UpdateComponent: Failed to update component', {
        sessionToken: input.sessionToken,
        itemId: input.itemId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
