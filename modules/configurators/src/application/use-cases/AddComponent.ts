import { Logger } from 'winston';
import { ConfigurationItem, ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { CompatibilityEngine } from '../../domain/services/CompatibilityEngine';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IRuleRepository } from '../../domain/repositories/IRuleRepository';
import { ICatalogRepository } from '../../domain/repositories/ICatalogRepository';
import {
  SessionExpiredError,
  ComponentNotFoundError,
  IncompatibleComponentError,
  MaxQuantityExceededError,
  SessionNotFoundError,
  InvalidSessionStatusError,
} from '../../domain/errors/configurator.errors';

/**
 * AddComponent Use-Case
 *
 * Adds a component to an existing configuration session.
 *
 * Business Rules:
 * - Session must exist and be ACTIVE
 * - Component must exist in catalog
 * - Component must be compatible with existing items
 * - Component must not exceed per-config limits
 * - Session must not be expired
 *
 * @class AddComponent
 */
export class AddComponent {
  private compatibilityEngine: CompatibilityEngine;

  /**
   * Create new AddComponent use-case
   *
   * @param sessionRepository - Session repository
   * @param ruleRepository - Rule repository
   * @param catalogRepository - Catalog repository
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly ruleRepository: IRuleRepository,
    private readonly catalogRepository: ICatalogRepository,
    private readonly logger: Logger
  ) {
    this.compatibilityEngine = new CompatibilityEngine();
  }

  /**
   * Execute add component use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to updated session
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {ComponentNotFoundError} If component not found
   * @throws {IncompatibleComponentError} If component violates rules
   * @throws {MaxQuantityExceededError} If quantity exceeds limit
   */
  async execute(input: {
    sessionToken: string;
    componentType: string;
    quantity: number;
    properties?: Record<string, unknown>;
  }): Promise<ConfiguratorSession> {
    this.logger.debug('AddComponent: Starting', {
      sessionToken: input.sessionToken,
      componentType: input.componentType,
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
        throw new InvalidSessionStatusError(session.status, 'add components to');
      }

      // 3. Check session expiry
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Find component in catalog
      const components = await this.catalogRepository.findByComponentType(input.componentType);
      if (components.length === 0) {
        throw new ComponentNotFoundError(input.componentType);
      }

      const component = components[0];

      // 5. Check component max per config
      const existingItem = session.items.get(input.componentType);
      const totalQuantity = (existingItem?.quantity ?? 0) + input.quantity;

      if (totalQuantity > component.maxPerConfig) {
        throw new MaxQuantityExceededError(
          input.componentType,
          totalQuantity,
          component.maxPerConfig
        );
      }

      // 6. Create new item or update existing
      let item: ConfigurationItem;
      if (existingItem) {
        existingItem.updateQuantity(totalQuantity);
        item = existingItem;
      } else {
        item = new ConfigurationItem(
          session.id,
          component.id as unknown as number,
          input.componentType,
          input.quantity,
          component.basePrice
        );

        if (input.properties) {
          item.properties = input.properties;
        }

        session.addItem(item);
      }

      // 7. Validate compatibility with all rules
      const rules = await this.ruleRepository.findByConfiguratorType(session.type);
      const items = session.getItems();
      const validation = this.compatibilityEngine.evaluate(items, rules);

      if (!validation.isValid) {
        const errorMessages = validation.violations
          .filter((v) => v.severity === 'error')
          .map((v) => v.message);

        throw new IncompatibleComponentError(
          input.componentType,
          errorMessages.join('; ')
        );
      }

      // 8. Save session
      const savedSession = await this.sessionRepository.save(session);

      this.logger.info('AddComponent: Component added successfully', {
        sessionId: savedSession.id,
        componentType: input.componentType,
        quantity: input.quantity,
        totalItems: savedSession.items.size,
      });

      return savedSession;
    } catch (error) {
      this.logger.error('AddComponent: Failed to add component', {
        sessionToken: input.sessionToken,
        componentType: input.componentType,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
