/**
 * Quote/quotation management types
 */

import { BaseEntity, Currency } from './common.types';

/**
 * Quote status enumeration
 */
export const QuoteStatusEnum = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
} as const;

export type QuoteStatus = typeof QuoteStatusEnum[keyof typeof QuoteStatusEnum];

/**
 * Main quote entity
 */
export interface Quote extends BaseEntity {
  /** Quote number/identifier */
  quoteNumber: string;
  /** Customer ID */
  customerId: number;
  /** Quote status */
  status: QuoteStatus;
  /** Currency (always RON) */
  currency: Currency;
  /** Quote date */
  quoteDate: Date;
  /** Quote expiration date */
  expirationDate: Date;
  /** Validity period in days */
  validityDays: number;
  /** Quote template ID (if used) */
  templateId?: number | null;
  /** Billing address */
  billingAddress: string;
  /** Billing city */
  billingCity: string;
  /** Billing zip code */
  billingZipCode: string;
  /** Billing country */
  billingCountry: string;
  /** Shipping address (if different) */
  shippingAddress?: string | null;
  /** Shipping city */
  shippingCity?: string | null;
  /** Shipping zip code */
  shippingZipCode?: string | null;
  /** Shipping country */
  shippingCountry?: string | null;
  /** Subtotal before discounts and VAT */
  subtotal: number;
  /** Total discount amount */
  discountAmount: number;
  /** Discount percentage */
  discountPercentage: number;
  /** VAT amount (19% in Romania) */
  vat: number;
  /** Shipping cost */
  shippingCost: number;
  /** Total quote value */
  total: number;
  /** Payment terms description */
  paymentTerms?: string | null;
  /** Delivery terms */
  deliveryTerms?: string | null;
  /** Internal notes/comments */
  internalNotes?: string | null;
  /** Customer-visible notes */
  customerNotes?: string | null;
  /** Sales representative user ID */
  salesRepId: number;
  /** Quote viewed by customer */
  viewedByCustomer: boolean;
  /** Timestamp when quote was viewed */
  viewedAt?: Date | null;
  /** Quote accepted by customer */
  acceptedByCustomer: boolean;
  /** Timestamp when quote was accepted */
  acceptedAt?: Date | null;
  /** Accepted by user ID (if B2B user) */
  acceptedByUserId?: number | null;
  /** Order ID (created from this quote) */
  orderId?: number | null;
  /** Rejection reason (if declined) */
  rejectionReason?: string | null;
  /** Quote source (web, email, etc.) */
  source?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Quote line item
 */
export interface QuoteItem extends BaseEntity {
  /** Quote ID */
  quoteId: number;
  /** Line item number */
  lineNumber: number;
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Product name */
  productName: string;
  /** Quantity quoted */
  quantity: number;
  /** Unit price (without VAT) */
  unitPrice: number;
  /** Discount per unit amount */
  discountAmount: number;
  /** Discount percentage for this item */
  discountPercentage: number;
  /** VAT rate applied */
  vatRate: number;
  /** VAT amount for this item */
  vat: number;
  /** Line total (quantity * unitPrice - discount + vat) */
  lineTotal: number;
  /** Product description/specification */
  description?: string | null;
  /** Notes for this line item */
  notes?: string | null;
  /** Configuration details (if applicable) */
  configuration?: Record<string, unknown> | null;
}

/**
 * Quote template for repeating quotes
 */
export interface QuoteTemplate extends BaseEntity {
  /** Template name */
  name: string;
  /** Template description */
  description?: string | null;
  /** Category for template */
  category?: string | null;
  /** Whether template is active */
  isActive: boolean;
  /** Whether this is a default template */
  isDefault: boolean;
  /** Template owner (sales rep) user ID */
  createdByUserId: number;
  /** Validity period in days */
  validityDays: number;
  /** Default payment terms */
  paymentTerms?: string | null;
  /** Default delivery terms */
  deliveryTerms?: string | null;
  /** Template notes */
  notes?: string | null;
  /** Default discount percentage */
  defaultDiscountPercentage: number;
  /** Template items JSON (for quick selection) */
  templateItems?: Array<{
    productId: number;
    sku: string;
    name: string;
    defaultQuantity: number;
    defaultDiscount: number;
  }> | null;
  /** Usage count */
  usageCount: number;
  /** Last used date */
  lastUsedAt?: Date | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Quote comparison (for competitive analysis)
 */
export interface QuoteComparison extends BaseEntity {
  /** Quote ID */
  quoteId: number;
  /** Competitor quote ID (external reference) */
  competitorQuoteId: string;
  /** Competitor name */
  competitorName: string;
  /** Competitor total price */
  competitorTotal: number;
  /** Price difference */
  priceDifference: number;
  /** Price difference percentage */
  priceDifferencePercentage: number;
  /** Are we cheaper? */
  weCheaper: boolean;
  /** Notes about comparison */
  notes?: string | null;
}

/**
 * Quote version history
 */
export interface QuoteHistory extends BaseEntity {
  /** Quote ID */
  quoteId: number;
  /** Version number */
  versionNumber: number;
  /** Previous status */
  previousStatus: QuoteStatus;
  /** Change description */
  description?: string | null;
  /** Changed by user ID */
  changedByUserId: number;
  /** Quote data snapshot */
  quoteSnapshot?: Record<string, unknown> | null;
}

/**
 * DTO for creating a quote
 */
export interface CreateQuoteDTO {
  customerId: number;
  templateId?: number;
  validityDays?: number;
  billingAddress: string;
  billingCity: string;
  billingZipCode: string;
  billingCountry?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingZipCode?: string;
  shippingCountry?: string;
  items: {
    productId: number;
    quantity: number;
    discountPercentage?: number;
    customPrice?: number;
    notes?: string;
  }[];
  discountPercentage?: number;
  discountAmount?: number;
  shippingCost?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  internalNotes?: string;
  customerNotes?: string;
  salesRepId: number;
}

/**
 * DTO for updating a quote
 */
export interface UpdateQuoteDTO {
  validityDays?: number;
  billingAddress?: string;
  billingCity?: string;
  billingZipCode?: string;
  billingCountry?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingZipCode?: string;
  shippingCountry?: string;
  items?: {
    productId: number;
    quantity: number;
    discountPercentage?: number;
    customPrice?: number;
    notes?: string;
  }[];
  discountPercentage?: number;
  discountAmount?: number;
  shippingCost?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  internalNotes?: string;
  customerNotes?: string;
}

/**
 * Quote action request (accept, decline, etc.)
 */
export interface QuoteActionDTO {
  action: 'send' | 'accept' | 'decline' | 'expire' | 'convert_to_order';
  reason?: string;
  rejectionReason?: string;
}

/**
 * Quote filters for search
 */
export interface QuoteFilters {
  customerId?: number;
  status?: QuoteStatus;
  salesRepId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  isExpired?: boolean;
  search?: string;
}

/**
 * Quote summary for dashboard
 */
export interface QuoteSummary {
  totalQuotes: number;
  draftQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  declinedQuotes: number;
  expiredQuotes: number;
  totalValue: number;
  acceptanceRate: number;
  avgTimeToAccept: number;
}
