import { Logger } from 'winston';
import { ConfiguratorSession } from '../../domain/entities/ConfiguratorSession';
import { PriceCalculationService } from '../../domain/services/PriceCalculationService';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { IPricingPort } from '../ports/IPricingPort';
import {
  SessionExpiredError,
  SessionNotFoundError,
  InvalidSessionStatusError,
  EmptyConfigurationError,
} from '../../domain/errors/configurator.errors';

/**
 * CalculateConfigurationPrice Use-Case
 *
 * Calculates full price breakdown with volume and tier discounts.
 * Queries pricing module for customer tier discounts.
 *
 * Pricing Formula:
 * 1. Component subtotals = quantity × unit_price
 * 2. Volume discount = subtotal × volume_discount_percent
 * 3. Tier discount = (subtotal - volume_discount) × tier_discount_percent
 * 4. Final total = subtotal - volume_discount - tier_discount
 *
 * @class CalculateConfigurationPrice
 */
export class CalculateConfigurationPrice {
  private priceCalculationService: PriceCalculationService;

  /**
   * Create new CalculateConfigurationPrice use-case
   *
   * @param sessionRepository - Session repository
   * @param pricingPort - Pricing module port
   * @param logger - Structured logger
   */
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly pricingPort: IPricingPort,
    private readonly logger: Logger
  ) {
    this.priceCalculationService = new PriceCalculationService();
  }

  /**
   * Execute price calculation use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to price breakdown
   * @throws {SessionExpiredError} If session has expired
   * @throws {SessionNotFoundError} If session not found
   * @throws {InvalidSessionStatusError} If session is not ACTIVE
   * @throws {EmptyConfigurationError} If configuration is empty
   */
  async execute(input: {
    sessionToken: string;
  }): Promise<{
    subtotal: number;
    volumeDiscountPercent: number;
    volumeDiscount: number;
    tierDiscountPercent: number;
    tierDiscount: number;
    total: number;
    breakdown: Array<{
      itemId: string;
      componentType: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      discount: number;
      finalPrice: number;
    }>;
  }> {
    this.logger.debug('CalculateConfigurationPrice: Starting', {
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
        throw new InvalidSessionStatusError(session.status, 'calculate price for');
      }

      // 3. Check session expiry
      if (session.isExpired()) {
        throw new SessionExpiredError(session.id);
      }

      // 4. Check configuration not empty
      if (session.items.size === 0) {
        throw new EmptyConfigurationError();
      }

      // 5. Get items
      const items = session.getItems();

      // 6. Calculate volume discount (based on total quantity)
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const volumeDiscountPercent = this.priceCalculationService.calculateVolumeDiscount(
        totalQuantity
      );

      // 7. Get tier discount from pricing module (if customer exists)
      let tierDiscountPercent = 0;
      if (session.customerId) {
        try {
          tierDiscountPercent = await this.pricingPort.getCustomerTierDiscount(session.customerId);
        } catch (error) {
          this.logger.warn('CalculateConfigurationPrice: Failed to get tier discount', {
            customerId: session.customerId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with 0% tier discount if pricing service fails
        }
      }

      // 8. Calculate prices
      const priceBreakdown = this.priceCalculationService.calculate(
        items,
        volumeDiscountPercent,
        tierDiscountPercent
      );

      this.logger.info('CalculateConfigurationPrice: Price calculated successfully', {
        sessionId: session.id,
        subtotal: priceBreakdown.subtotal,
        volumeDiscount: priceBreakdown.volumeDiscount,
        tierDiscount: priceBreakdown.tierDiscount,
        total: priceBreakdown.total,
        itemCount: items.length,
      });

      return {
        subtotal: priceBreakdown.subtotal,
        volumeDiscountPercent,
        volumeDiscount: priceBreakdown.volumeDiscount,
        tierDiscountPercent,
        tierDiscount: priceBreakdown.tierDiscount,
        total: priceBreakdown.total,
        breakdown: priceBreakdown.breakdown,
      };
    } catch (error) {
      this.logger.error('CalculateConfigurationPrice: Price calculation failed', {
        sessionToken: input.sessionToken,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
