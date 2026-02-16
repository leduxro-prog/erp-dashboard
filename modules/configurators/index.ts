/**
 * CONFIGURATORS MODULE
 *
 * Product configurators for Ledux.ro:
 * - Magnetic Track System (custom magnetic track lighting)
 * - LED Strip System (custom LED strip installations)
 *
 * @module configurators
 */

// Main module export
export { default as ConfiguratorsModule } from './src/configurators-module';

// Domain entities
export { ConfiguratorSession, ConfigurationItem } from './src/domain/entities/ConfiguratorSession';
export { CompatibilityRule } from './src/domain/entities/CompatibilityRule';
export { ComponentCatalog } from './src/domain/entities/ComponentCatalog';

// Domain services
export { CompatibilityEngine } from './src/domain/services/CompatibilityEngine';
export { PriceCalculationService } from './src/domain/services/PriceCalculationService';

// Domain repositories (ports)
export type { ISessionRepository } from './src/domain/repositories/ISessionRepository';
export type { IRuleRepository } from './src/domain/repositories/IRuleRepository';
export type { ICatalogRepository } from './src/domain/repositories/ICatalogRepository';

// Application ports
export type { IPricingPort } from './src/application/ports/IPricingPort';
export type { IInventoryPort } from './src/application/ports/IInventoryPort';

// Application use-cases
export { CreateSession } from './src/application/use-cases/CreateSession';
export { AddComponent } from './src/application/use-cases/AddComponent';
export { RemoveComponent } from './src/application/use-cases/RemoveComponent';
export { UpdateComponent } from './src/application/use-cases/UpdateComponent';
export { ValidateConfiguration } from './src/application/use-cases/ValidateConfiguration';
export { CalculateConfigurationPrice } from './src/application/use-cases/CalculateConfigurationPrice';
export { CompleteConfiguration } from './src/application/use-cases/CompleteConfiguration';
export { ConvertToQuote } from './src/application/use-cases/ConvertToQuote';
export { GetSession } from './src/application/use-cases/GetSession';
export { ListSessions } from './src/application/use-cases/ListSessions';
export { GetCatalog } from './src/application/use-cases/GetCatalog';

// Domain errors
export {
  SessionExpiredError,
  IncompatibleComponentError,
  MaxQuantityExceededError,
  InvalidConfigurationError,
  ComponentNotFoundError,
  RuleViolationError,
  SessionNotFoundError,
  InvalidSessionStatusError,
  EmptyConfigurationError,
} from './src/domain/errors/configurator.errors';

// Infrastructure
export { createConfiguratorsRouter } from './src/infrastructure/composition-root';
