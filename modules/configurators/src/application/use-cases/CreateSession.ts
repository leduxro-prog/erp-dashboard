import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

/**
 * CreateSession Use-Case
 *
 * Creates a new configurator session for a customer to begin building
 * a custom product configuration.
 *
 * Business Rules:
 * - Session is created with ACTIVE status
 * - Session expires after 24 hours
 * - Session token is generated for sharing
 * - Anonymous sessions (without customerId) are allowed
 *
 * @class CreateSession
 */
export class CreateSession {
  /**
   * Create new CreateSession use-case
   *
   * @param sessionRepository - Session repository for persistence
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Execute create session use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to session token
   * @throws {Error} If session creation fails
   */
  async execute(input: {
    type: 'MAGNETIC_TRACK' | 'LED_STRIP';
    customerId?: number;
  }): Promise<{
    sessionId: string;
    sessionToken: string;
    expiresAt: Date;
  }> {
    this.logger.debug('CreateSession: Starting', {
      type: input.type,
      customerId: input.customerId,
    });

    try {
      // Create new domain session
      const session = new ConfiguratorSession(input.type, input.customerId);

      // Persist session
      const savedSession = await this.sessionRepository.save(session);

      this.logger.info('CreateSession: Session created successfully', {
        sessionId: savedSession.id,
        type: savedSession.type,
        customerId: savedSession.customerId,
        expiresAt: savedSession.expiresAt,
      });

      return {
        sessionId: savedSession.id,
        sessionToken: savedSession.sessionToken,
        expiresAt: savedSession.expiresAt,
      };
    } catch (error) {
      this.logger.error('CreateSession: Failed to create session', {
        type: input.type,
        customerId: input.customerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
