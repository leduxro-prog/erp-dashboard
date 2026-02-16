import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import {
  SessionExpiredError,
  SessionNotFoundError,
  InvalidSessionStatusError,
} from '../../domain/errors/configurator.errors';

/**
 * RemoveComponent Use-Case
 *
 * Removes a component from a configuration session.
 *
 * Business Rules:
 * - Session must be ACTIVE
 * - Item must exist in session
 * - Session must not be expired
 *
 * @class RemoveComponent
 */
export class RemoveComponent {
  /**
   * Create new RemoveComponent use-case
   *
   * @param sessionRepository - Session repository
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Execute remove component use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to updated session
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {InvalidSessionStatusError} If session is not ACTIVE
   */
  async execute(input: {
    sessionToken: string;
    itemId: string;
  }): Promise<ConfiguratorSession> {
    this.logger.debug('RemoveComponent: Starting', {
      sessionToken: input.sessionToken,
      itemId: input.itemId,
    });

    try {
      // 1. Find session
      const session = await this.sessionRepository.findByToken(input.sessionToken);
      if (!session) {
        throw new SessionNotFoundError(input.sessionToken);
      }

      // 2. Check session status
      if (session.status !== 'ACTIVE') {
        throw new InvalidSessionStatusError(session.status, 'remove components from');
      }

      // 3. Check session expiry
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Remove item
      const removed = session.removeItem(input.itemId);

      if (!removed) {
        this.logger.warn('RemoveComponent: Item not found', {
          sessionId: session.id,
          itemId: input.itemId,
        });
      }

      // 5. Save session
      const savedSession = await this.sessionRepository.save(session);

      this.logger.info('RemoveComponent: Component removed successfully', {
        sessionId: savedSession.id,
        itemId: input.itemId,
        remainingItems: savedSession.items.size,
      });

      return savedSession;
    } catch (error) {
      this.logger.error('RemoveComponent: Failed to remove component', {
        sessionToken: input.sessionToken,
        itemId: input.itemId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
