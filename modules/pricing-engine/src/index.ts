// Export ICypherModule implementation (for auto-discovery)
export { default as PricingEngineModule } from './pricing-module';

// Export composition root (for backward compatibility)
export { createPricingEngineRouter } from './infrastructure/composition-root';

// Export domain entities and types
export { Price } from './domain/entities/Price';
export { CustomerTier } from './domain/entities/CustomerTier';
export { Promotion } from './domain/entities/Promotion';
export { VolumeDiscount } from './domain/entities/VolumeDiscount';

// Export application ports
export type { IPriceRepository } from './application/ports/IPriceRepository';
export type { ITierRepository } from './application/ports/ITierRepository';

// Export DTOs
export * from './application/dtos/pricing.dtos';

// Export errors
export * from './application/errors/pricing.errors';

// Export use-cases
export { CalculatePrice } from './application/use-cases/CalculatePrice';
export { CalculateOrderPricing } from './application/use-cases/CalculateOrderPricing';
export { ManagePromotions } from './application/use-cases/ManagePromotions';
export { GetTierPricing } from './application/use-cases/GetTierPricing';
export { ManageTiers, TierLevel } from './application/use-cases/ManageTiers';
