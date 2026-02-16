/**
 * Quote Event Definitions
 * Defines event constants and payload interfaces for quote-related events
 * communicated via Redis Pub/Sub Event Bus
 */

import type { QuoteStatus } from '../types';

/**
 * Quote event constants
 */
export const QUOTE_EVENTS = {
  CREATED: 'quote.created',
  SENT: 'quote.sent',
  VIEWED: 'quote.viewed',
  ACCEPTED: 'quote.accepted',
  DECLINED: 'quote.declined',
  EXPIRED: 'quote.expired',
  CONVERTED: 'quote.converted_to_order',
  REMINDER_SENT: 'quote.reminder_sent',
} as const;

/**
 * Quote item
 */
export interface QuoteItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Emitted when a new quote is created
 */
export interface QuoteCreatedEvent {
  quoteId: string;
  customerId: string;
  items: QuoteItem[];
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
  timestamp: Date;
}

/**
 * Emitted when quote is sent to customer
 */
export interface QuoteSentEvent {
  quoteId: string;
  customerId: string;
  sentTo: string;
  sentAt: Date;
  timestamp: Date;
}

/**
 * Emitted when customer views a quote
 */
export interface QuoteViewedEvent {
  quoteId: string;
  customerId: string;
  viewedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when quote is accepted by customer
 */
export interface QuoteAcceptedEvent {
  quoteId: string;
  customerId: string;
  acceptedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when quote is declined by customer
 */
export interface QuoteDeclinedEvent {
  quoteId: string;
  customerId: string;
  reason?: string;
  declinedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when quote expires
 */
export interface QuoteExpiredEvent {
  quoteId: string;
  customerId: string;
  expiredAt: Date;
  timestamp: Date;
}

/**
 * Emitted when quote is converted to order
 */
export interface QuoteConvertedEvent {
  quoteId: string;
  orderId: string;
  customerId: string;
  convertedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when reminder is sent for quote
 */
export interface QuoteReminderSentEvent {
  quoteId: string;
  customerId: string;
  sentTo: string;
  sentAt: Date;
  timestamp: Date;
}

/**
 * Union type of all quote event payloads
 */
export type QuoteEventPayload =
  | QuoteCreatedEvent
  | QuoteSentEvent
  | QuoteViewedEvent
  | QuoteAcceptedEvent
  | QuoteDeclinedEvent
  | QuoteExpiredEvent
  | QuoteConvertedEvent
  | QuoteReminderSentEvent;

/**
 * Union type of all quote event names
 */
export type QuoteEventType = typeof QUOTE_EVENTS[keyof typeof QUOTE_EVENTS];
