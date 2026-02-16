import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

/**
 * ListSessions Use-Case
 *
 * Retrieves paginated list of sessions for a customer.
 *
 * Business Rules:
 * - Only returns sessions for authenticated customer
 * - Returns paginated results
 * - Includes expired sessions in results
 *
 * @class ListSessions
 */
export class ListSessions {
  /**
   * Create new ListSessions use-case
   *
   * @param sessionRepository - Session repository
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Execute list sessions use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to paginated sessions
   */
  async execute(input: {
    customerId: number;
    page?: number;
    limit?: number;
  }): Promise<{
    items: ConfiguratorSession[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = input.page ?? 0;
    const limit = Math.min(input.limit ?? 20, 100); // Max 100 per page

    this.logger.debug('ListSessions: Starting', {
      customerId: input.customerId,
      page,
      limit,
    });

    try {
      // 1. Find sessions for customer
      const result = await this.sessionRepository.findByCustomer(input.customerId, page, limit);

      // 2. Calculate hasMore flag
      const hasMore = result.total > (page + 1) * limit;

      this.logger.info('ListSessions: Sessions retrieved successfully', {
        customerId: input.customerId,
        page,
        limit,
        total: result.total,
        returned: result.items.length,
      });

      return {
        items: result.items,
        total: result.total,
        page,
        limit,
        hasMore,
      };
    } catch (error) {
      this.logger.error('ListSessions: Failed to list sessions', {
        customerId: input.customerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
