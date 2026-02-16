import { Logger } from 'winston';
import { IEventBus } from '@shared/module-system';
import { ConfiguratorSession, ConfigurationItem } from '../../domain/entities/ConfiguratorSession';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import {
  SessionExpiredError,
  SessionNotFoundError,
  InvalidSessionStatusError,
  EmptyConfigurationError,
} from '../../domain/errors/configurator.errors';

/**
 * ConvertToQuote Use-Case
 *
 * Converts a completed configuration session to a quotation.
 * This is a downstream operation triggered after configuration completion.
 *
 * Business Rules:
 * - Session must be COMPLETED
 * - Session must not be empty
 * - Publishes 'configuration.convert_to_quote' event for quotations module
 *
 * @class ConvertToQuote
 */
export class ConvertToQuote {
  /**
   * Create new ConvertToQuote use-case
   *
   * @param sessionRepository - Session repository
   * @param eventBus - Event bus for publishing conversion event
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger
  ) {}

  /**
   * Execute quote conversion use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to converted session data
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {InvalidSessionStatusError} If session is not COMPLETED
   * @throws {EmptyConfigurationError} If configuration is empty
   */
  async execute(input: {
    sessionToken: string;
  }): Promise<{
    sessionId: string;
    configuratorType: string;
    items: Array<{
      id: string;
      componentType: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    totalPrice: number;
  }> {
    this.logger.debug('ConvertToQuote: Starting', {
      sessionToken: input.sessionToken,
    });

    try {
      // 1. Find session
      const session = await this.sessionRepository.findByToken(input.sessionToken);
      if (!session) {
        throw new SessionNotFoundError(input.sessionToken);
      }

      // 2. Check session status (must be completed to convert)
      if (session.status !== 'COMPLETED') {
        throw new InvalidSessionStatusError(session.status, 'convert to quote');
      }

      // 3. Check session expiry (completed sessions don't expire, but check anyway)
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Check configuration not empty
      if (session.items.size === 0) {
        throw new EmptyConfigurationError();
      }

      // 5. Build quote data
      const items = session.getItems();
      const quoteData = {
        sessionId: session.id,
        configuratorType: session.type,
        items: items.map((item: ConfigurationItem) => ({
          id: item.id,
          componentType: item.componentType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        totalPrice: session.totalPrice,
      };

      // 6. Publish conversion event
      await this.eventBus.publish('configuration.convert_to_quote', {
        sessionId: session.id,
        sessionToken: session.sessionToken,
        configuratorType: session.type,
        customerId: session.customerId,
        itemCount: session.items.size,
        totalPrice: session.totalPrice,
        quoteData,
        convertedAt: new Date(),
      });

      this.logger.info('ConvertToQuote: Configuration converted to quote successfully', {
        sessionId: session.id,
        type: session.type,
        customerId: session.customerId,
        itemCount: items.length,
        totalPrice: session.totalPrice,
      });

      return quoteData;
    } catch (error) {
      this.logger.error('ConvertToQuote: Failed to convert configuration to quote', {
        sessionToken: input.sessionToken,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
