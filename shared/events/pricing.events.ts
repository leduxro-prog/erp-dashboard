/**
 * Pricing Event Definitions
 * Defines event constants and payload interfaces for pricing-related events
 * communicated via Redis Pub/Sub Event Bus
 */

/**
 * Pricing event constants
 */
export const PRICING_EVENTS = {
  PRICE_UPDATED: 'pricing.price_updated',
  PROMOTION_STARTED: 'pricing.promotion_started',
  PROMOTION_ENDED: 'pricing.promotion_ended',
  TIER_CHANGED: 'pricing.tier_changed',
  VOLUME_DISCOUNT_APPLIED: 'pricing.volume_discount_applied',
} as const;

/**
 * Emitted when product price is updated
 */
export interface PriceUpdatedEvent {
  productId: string;
  previousPrice: number;
  newPrice: number;
  currency: string;
  effectiveAt: Date;
  updatedBy: string;
  timestamp: Date;
}

/**
 * Emitted when promotion starts
 */
export interface PromotionStartedEvent {
  promotionId: string;
  productId?: string;
  discountPercentage: number;
  discountAmount?: number;
  startDate: Date;
  endDate: Date;
  timestamp: Date;
}

/**
 * Emitted when promotion ends
 */
export interface PromotionEndedEvent {
  promotionId: string;
  productId?: string;
  endedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when customer pricing tier changes
 */
export interface TierChangedEvent {
  customerId: string;
  previousTier: string;
  newTier: string;
  changedAt: Date;
  changedBy: string;
  timestamp: Date;
}

/**
 * Emitted when volume discount is applied
 */
export interface VolumeDiscountAppliedEvent {
  orderId: string;
  customerId: string;
  productId: string;
  quantity: number;
  discountPercentage: number;
  discountAmount: number;
  appliedAt: Date;
  timestamp: Date;
}

/**
 * Union type of all pricing event payloads
 */
export type PricingEventPayload =
  | PriceUpdatedEvent
  | PromotionStartedEvent
  | PromotionEndedEvent
  | TierChangedEvent
  | VolumeDiscountAppliedEvent;

/**
 * Union type of all pricing event names
 */
export type PricingEventType = typeof PRICING_EVENTS[keyof typeof PRICING_EVENTS];
