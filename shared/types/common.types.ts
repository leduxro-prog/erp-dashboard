/**
 * Common types used across the CYPHER ERP system
 */

/**
 * Base entity with audit fields
 * Extended by all domain entities
 */
export interface BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Language enum with const assertion for type safety
 */
export const LanguageEnum = {
  RO: 'ro',
  EN: 'en',
} as const;

export type Language = typeof LanguageEnum[keyof typeof LanguageEnum];

/**
 * Currency enum (RON is the only supported currency)
 * VAT rate in Romania: 19%
 */
export const CurrencyEnum = {
  RON: 'RON',
} as const;

export type Currency = typeof CurrencyEnum[keyof typeof CurrencyEnum];

/**
 * Sorting order enum
 */
export const SortOrderEnum = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortOrder = typeof SortOrderEnum[keyof typeof SortOrderEnum];

/**
 * Pagination request parameters
 */
export interface PaginationRequest {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

/**
 * Pagination metadata in response
 */
export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Generic paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationResponse;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  path?: string;
  statusCode: number;
}

/**
 * Generic API response wrapper
 * Used for all API responses to maintain consistency
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  timestamp: Date;
  requestId?: string;
}

/**
 * VAT constant (19% in Romania)
 */
export const VAT_RATE = 0.21;

/**
 * Standard page size limits
 */
export const PAGINATION_LIMITS = {
  MIN: 1,
  MAX: 1000,
  DEFAULT: 20,
} as const;
