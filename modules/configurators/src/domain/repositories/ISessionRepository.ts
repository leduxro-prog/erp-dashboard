import { ConfiguratorSession } from '../entities/ConfiguratorSession';

/**
 * Session Repository Port
 *
 * Defines the contract for persisting and retrieving ConfiguratorSession entities.
 * Implementations handle database interactions (TypeORM, MongoDB, etc.).
 *
 * @interface ISessionRepository
 */
export interface ISessionRepository {
  /**
   * Save a session (create or update)
   *
   * @param session - Session to save
   * @returns Promise resolving to saved session
   * @throws {Error} If persistence fails
   */
  save(session: ConfiguratorSession): Promise<ConfiguratorSession>;

  /**
   * Find session by ID
   *
   * @param id - Session ID
   * @returns Promise resolving to session or undefined
   */
  findById(id: string): Promise<ConfiguratorSession | undefined>;

  /**
   * Find session by unique token
   *
   * @param token - Session token
   * @returns Promise resolving to session or undefined
   */
  findByToken(token: string): Promise<ConfiguratorSession | undefined>;

  /**
   * Find all sessions for a customer (paginated)
   *
   * @param customerId - Customer ID
   * @param page - Page number (0-indexed)
   * @param limit - Items per page
   * @returns Promise resolving to paginated sessions
   */
  findByCustomer(
    customerId: number,
    page: number,
    limit: number
  ): Promise<{
    items: ConfiguratorSession[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Find all active sessions (not completed or expired)
   *
   * @returns Promise resolving to all active sessions
   */
  findActive(): Promise<ConfiguratorSession[]>;

  /**
   * Delete sessions that have expired
   *
   * @returns Promise resolving to number of deleted sessions
   */
  deleteExpired(): Promise<number>;
}
