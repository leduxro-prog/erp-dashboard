import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from '../../domain/errors/configurator.errors';

/**
 * GetSession Use-Case
 *
 * Retrieves a configuration session by token with all items.
 *
 * Business Rules:
 * - Session must exist
 * - Checks if session has expired but still returns it
 * - Returns complete session with all items
 *
 * @class GetSession
 */
export class GetSession {
  /**
   * Create new GetSession use-case
   *
   * @param sessionRepository - Session repository
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Execute get session use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to session
   * @throws {SessionNotFoundError} If session not found
   * @throws {SessionExpiredError} If session has expired
   */
  async execute(input: {
    sessionToken: string;
  }): Promise<ConfiguratorSession> {
    this.logger.debug('GetSession: Starting', {
      sessionToken: input.sessionToken,
    });

    try {
      // 1. Find session
      const session = await this.sessionRepository.findByToken(input.sessionToken);
      if (!session) {
        throw new SessionNotFoundError(input.sessionToken);
      }

      // 2. Check expiry (throws if expired)
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      this.logger.debug('GetSession: Session retrieved successfully', {
        sessionId: session.id,
        type: session.type,
        itemCount: session.items.size,
        status: session.status,
      });

      return session;
    } catch (error) {
      this.logger.error('GetSession: Failed to retrieve session', {
        sessionToken: input.sessionToken,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
