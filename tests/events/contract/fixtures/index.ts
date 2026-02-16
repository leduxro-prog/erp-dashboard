/**
 * @file Fixtures Index
 * @module tests/events/contract/fixtures
 * @description Central export point for all event fixtures.
 */

// Order events
export {
  validOrderCreatedEvent,
  minimalOrderCreatedEvent,
  b2bOrderCreatedEvent,
  b2cOrderCreatedEvent,
  guestOrderCreatedEvent,
  highPriorityOrderCreatedEvent,
  criticalPriorityOrderCreatedEvent,
  multiItemOrderCreatedEvent,
  orderCreatedPaymentStatuses,
  orderCreatedStatuses,
  invalidOrderCreatedEvents,
  getAllValidOrderEvents,
  getAllInvalidOrderEvents,
} from './OrderEventFixtures';

// Product events
export {
  validProductUpdatedEvent,
  productNameChangedEvent,
  productDescriptionChangedEvent,
  productCategoryChangedEvent,
  productAttributesChangedEvent,
  productImagesChangedEvent,
  productStatusChangedEvents,
  productVisibilityChangedEvents,
  productTypeEvents,
  bulkProductUpdateEvent,
  invalidProductEvents,
  getAllValidProductEvents,
  getAllInvalidProductEvents,
} from './ProductEventFixtures';

// Stock events
export {
  validStockChangedEvent,
  stockAdditionEvents,
  stockRemovalEvents,
  stockAdjustmentEvents,
  stockTransferEvents,
  stockReservedEvent,
  stockReleasedEvent,
  highPriorityStockEvent,
  criticalStockEvent,
  invalidStockEvents,
  getAllValidStockEvents,
  getAllInvalidStockEvents,
} from './StockEventFixtures';

// Price events
export {
  validPriceChangedEvent,
  priceTypeEvents,
  priceCurrencyEvents,
  priceDirectionEvents,
  tierPricingEvents,
  bulkPricingEvents,
  specialPricingEvents,
  highPriorityPriceEvent,
  invalidPriceEvents,
  getAllValidPriceEvents,
  getAllInvalidPriceEvents,
} from './PriceEventFixtures';
