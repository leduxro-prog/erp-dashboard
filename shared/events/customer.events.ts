/**
 * Customer Event Definitions
 * Defines event constants and payload interfaces for customer-related events
 * communicated via Redis Pub/Sub Event Bus
 */

/**
 * Customer event constants
 */
export const CUSTOMER_EVENTS = {
  REGISTERED: 'customer.registered',
  B2B_APPROVED: 'customer.b2b_approved',
  B2B_REJECTED: 'customer.b2b_rejected',
  TIER_UPGRADED: 'customer.tier_upgraded',
  CREDIT_LIMIT_CHANGED: 'customer.credit_limit_changed',
} as const;

/**
 * Emitted when new customer registers
 */
export interface CustomerRegisteredEvent {
  customerId: string;
  email: string;
  name: string;
  type: 'B2C' | 'B2B';
  registeredAt: Date;
  timestamp: Date;
}

/**
 * Emitted when B2B customer is approved
 */
export interface B2bApprovedEvent {
  customerId: string;
  companyName: string;
  approvedBy: string;
  approvedAt: Date;
  creditLimit: number;
  timestamp: Date;
}

/**
 * Emitted when B2B customer is rejected
 */
export interface B2bRejectedEvent {
  customerId: string;
  companyName: string;
  reason: string;
  rejectedBy: string;
  rejectedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when customer tier is upgraded
 */
export interface TierUpgradedEvent {
  customerId: string;
  previousTier: string;
  newTier: string;
  upgradedAt: Date;
  upgradedBy: string;
  timestamp: Date;
}

/**
 * Emitted when customer credit limit changes
 */
export interface CreditLimitChangedEvent {
  customerId: string;
  previousLimit: number;
  newLimit: number;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  timestamp: Date;
}

/**
 * Union type of all customer event payloads
 */
export type CustomerEventPayload =
  | CustomerRegisteredEvent
  | B2bApprovedEvent
  | B2bRejectedEvent
  | TierUpgradedEvent
  | CreditLimitChangedEvent;

/**
 * Union type of all customer event names
 */
export type CustomerEventType = typeof CUSTOMER_EVENTS[keyof typeof CUSTOMER_EVENTS];
