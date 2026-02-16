/**
 * Pricing Engine - Application Layer
 * Use cases, DTOs, errors, and ports
 */

// Re-export use cases
export { CalculatePrice } from './use-cases/CalculatePrice';
export { CalculateOrderPricing, OrderItem } from './use-cases/CalculateOrderPricing';
export { ManagePromotions, Promotion } from './use-cases/ManagePromotions';
export { ManageTiers, TierLevel } from './use-cases/ManageTiers';
export { GetTierPricing } from './use-cases/GetTierPricing';

// Re-export DTOs
export type {
  PriceCalculationResult,
  LineItemResult,
  OrderPricingResult,
  CreatePromotionDTO,
  CustomerTierDTO,
  TierPricingDTO,
} from './dtos/pricing.dtos';

// Re-export errors
export {
  PricingError,
  ProductNotFoundError,
  InvalidPromotionError,
  MarginBelowMinimumError,
  CustomerTierNotFoundError,
  PromotionDateError,
} from './errors/pricing.errors';

// Re-export ports/interfaces
export type {
  IPriceRepository,
  ProductPrice,
  PromotionRecord,
  VolumeDiscountRule,
} from './ports/IPriceRepository';

export type {
  ITierRepository,
  CustomerTierRecord,
} from './ports/ITierRepository';
