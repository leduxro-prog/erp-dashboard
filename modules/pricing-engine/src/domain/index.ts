/**
 * Pricing Engine Domain Layer - Main Export
 *
 * Exports all domain entities, services, and repository interfaces.
 * This is the public API of the domain layer.
 *
 * Pure business logic with no external dependencies.
 */

// ============================================================================
// ENTITIES - Domain Models
// ============================================================================

export { Price } from './entities/Price';
export { CustomerTier } from './entities/CustomerTier';
export { VolumeDiscount } from './entities/VolumeDiscount';
export { Promotion } from './entities/Promotion';

// ============================================================================
// SERVICES - Business Logic
// ============================================================================

export { PriceCalculator } from './services/PriceCalculator';
export { VolumeDiscountCalculator } from './services/VolumeDiscountCalculator';

// ============================================================================
// REPOSITORIES - Persistence Ports
// ============================================================================

export { type IPriceRepository } from './repositories/IPriceRepository';
export { type ITierRepository } from './repositories/ITierRepository';

