/**
 * Pagination Utilities
 *
 * Provides cursor-based and offset-based pagination support with validation.
 * Cursor-based pagination (keyset) is recommended for large datasets as it's
 * more efficient and doesn't suffer from offset-based pagination issues.
 *
 * @module shared/utils/pagination
 * @example
 * // Cursor-based pagination
 * const request: CursorPaginationRequest = {
 *   cursor: undefined,
 *   limit: 20,
 *   sortBy: 'id',
 *   sortOrder: 'ASC'
 * };
 *
 * // Offset-based pagination
 * const offsetRequest: OffsetPaginationRequest = {
 *   page: 1,
 *   limit: 50,
 *   sortBy: 'createdAt',
 *   sortOrder: 'DESC'
 * };
 */

import Joi from 'joi';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('pagination');

/**
 * Maximum page size to prevent abuse.
 * Enforced in all pagination endpoints.
 */
export const MAX_PAGE_SIZE = 200;

/**
 * Default page size for pagination.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Cursor-based pagination request.
 * Used for keyset-based pagination with cursor-derived position tracking.
 *
 * @example
 * const request: CursorPaginationRequest = {
 *   cursor: 'eyJza3kiOiAiMTIzNDU2IiwgImlkIjogNDJ9',
 *   limit: 20,
 *   sortBy: 'id',
 *   sortOrder: 'ASC',
 * };
 */
export interface CursorPaginationRequest {
  /** Base64-encoded cursor containing last item's sort key and ID */
  cursor?: string;
  /** Maximum items per page (default 20, max 200) */
  limit: number;
  /** Field name to sort results by */
  sortBy: string;
  /** Sort direction: ascending or descending */
  sortOrder: 'ASC' | 'DESC';
}

/**
 * Cursor-based pagination response.
 * Provides cursor-based pointers for efficient pagination through large datasets.
 *
 * @typeParam T - Type of items in the paginated result
 *
 * @example
 * const response: CursorPaginatedResult<Product> = {
 *   data: [...products],
 *   pagination: {
 *     nextCursor: 'eyJza3kiOiAiNzg5MDEyIiwgImlkIjogNzh9',
 *     previousCursor: 'eyJza3kiOiAiNDU2Nzg5IiwgImlkIjogNDV9',
 *     hasMore: true,
 *     limit: 20,
 *     total: 5432,
 *   },
 * };
 */
export interface CursorPaginatedResult<T> {
  /** Array of items in current page */
  data: T[];
  /** Pagination metadata and cursor pointers */
  pagination: {
    /** Cursor for fetching next page (null if at end) */
    nextCursor: string | null;
    /** Cursor for fetching previous page (null if at start) */
    previousCursor: string | null;
    /** Whether more items are available after current page */
    hasMore: boolean;
    /** Number of items in current page */
    limit: number;
    /** Total count of all items (optional; expensive for large datasets) */
    total?: number;
  };
}

/**
 * Offset-based pagination request.
 * Traditional page-based pagination using offset and limit.
 * Maintained for backward compatibility.
 *
 * @example
 * const request: OffsetPaginationRequest = {
 *   page: 2,
 *   limit: 50,
 *   sortBy: 'createdAt',
 *   sortOrder: 'DESC',
 * };
 */
export interface OffsetPaginationRequest {
  /** Page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Field name to sort results by */
  sortBy: string;
  /** Sort direction: ascending or descending */
  sortOrder: 'ASC' | 'DESC';
}

/**
 * Offset-based pagination response.
 * Traditional pagination response with page numbers and total count.
 *
 * @typeParam T - Type of items in the paginated result
 *
 * @example
 * const response: OffsetPaginatedResult<Product> = {
 *   data: [...products],
 *   pagination: {
 *     page: 2,
 *     limit: 50,
 *     total: 2500,
 *     totalPages: 50,
 *     hasNext: true,
 *     hasPrevious: true,
 *   },
 * };
 */
export interface OffsetPaginatedResult<T> {
  /** Array of items in current page */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number (1-indexed) */
    page: number;
    /** Items per page */
    limit: number;
    /** Total count of all items */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNext: boolean;
    /** Whether there is a previous page */
    hasPrevious: boolean;
  };
}

/**
 * Decoded cursor data containing sort key and record ID.
 *
 * @example
 * const decoded: DecodedCursor = {
 *   value: '12345',
 *   id: 42,
 * };
 */
interface DecodedCursor {
  /** The sort key value (e.g., timestamp, ID, or custom field) */
  value: string;
  /** The unique record ID */
  id: number;
}

/**
 * Encode a cursor from sort key value and record ID.
 * Creates a Base64-encoded cursor for use in pagination requests.
 *
 * @param value - The sort key value (string representation)
 * @param id - The unique record ID
 * @returns Base64-encoded cursor string
 *
 * @example
 * const cursor = encodeCursor('2025-02-07T10:30:00Z', 123);
 * // Returns: 'eyJ2YWx1ZSI6IjIwMjUtMDItMDdUMTA6MzA6MDBaIiwiaWQiOjEyM30='
 *
 * @throws {Error} If encoding fails
 */
export function encodeCursor(value: string | number, id: number): string {
  try {
    const cursor: DecodedCursor = {
      value: String(value),
      id,
    };
    const json = JSON.stringify(cursor);
    return Buffer.from(json).toString('base64');
  } catch (error) {
    logger.error('Failed to encode cursor', {
      value,
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to encode pagination cursor');
  }
}

/**
 * Decode a Base64-encoded cursor to retrieve sort key and record ID.
 *
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor object with value and ID
 *
 * @example
 * const decoded = decodeCursor('eyJ2YWx1ZSI6IjIwMjUtMDItMDdUMTA6MzA6MDBaIiwiaWQiOjEyM30=');
 * // Returns: { value: '2025-02-07T10:30:00Z', id: 123 }
 *
 * @throws {Error} If cursor is invalid or cannot be decoded
 */
export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const decoded = JSON.parse(json) as DecodedCursor;

    if (typeof decoded.value !== 'string' || typeof decoded.id !== 'number') {
      throw new Error('Invalid cursor structure');
    }

    return decoded;
  } catch (error) {
    logger.error('Failed to decode cursor', {
      cursor: cursor.substring(0, 20) + '...',
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Invalid pagination cursor');
  }
}

/**
 * Build a TypeORM WHERE clause for cursor-based pagination.
 * Constructs query conditions to fetch items after (or before) the cursor position.
 *
 * @param cursor - Decoded cursor from decodeCursor()
 * @param sortBy - Field name to sort by
 * @param sortOrder - Sort direction
 * @returns WHERE clause object for TypeORM query builder
 *
 * @example
 * const decoded = decodeCursor(request.cursor);
 * const whereClause = buildCursorQuery(decoded, 'createdAt', 'DESC');
 * // Returns: { createdAt: LessThan('2025-02-07T10:30:00Z') }
 *
 * @internal
 */
export interface CursorWhereClause {
  [key: string]: any;
}

export function buildCursorQuery(
  cursor: DecodedCursor,
  sortBy: string,
  sortOrder: 'ASC' | 'DESC'
): CursorWhereClause {
  // For keyset-based pagination:
  // - If ASC: fetch rows where sortBy > cursor value
  // - If DESC: fetch rows where sortBy < cursor value
  const operator = sortOrder === 'ASC' ? '>' : '<';

  const whereClause: CursorWhereClause = {};
  whereClause[sortBy] = {
    [operator === '>' ? 'MoreThan' : 'LessThan']: cursor.value,
  };

  logger.debug('Built cursor query', {
    sortBy,
    sortOrder,
    operator,
    cursorValue: cursor.value,
  });

  return whereClause;
}

/**
 * Build skip/take parameters for offset-based pagination.
 * Calculates the skip and take values for TypeORM query builder.
 *
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Object with skip and take properties
 *
 * @example
 * const { skip, take } = buildOffsetQuery(2, 50);
 * // Returns: { skip: 50, take: 50 }
 *
 * @throws {Error} If page or limit are invalid
 */
export function buildOffsetQuery(
  page: number,
  limit: number
): { skip: number; take: number } {
  if (page < 1 || !Number.isInteger(page)) {
    throw new Error('Page number must be a positive integer');
  }

  if (limit < 1 || limit > MAX_PAGE_SIZE || !Number.isInteger(limit)) {
    throw new Error(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }

  const skip = (page - 1) * limit;

  logger.debug('Built offset query', { page, limit, skip, maxPageSize: MAX_PAGE_SIZE });

  return { skip, take: limit };
}

/**
 * Create a cursor-based paginated response from result items.
 * Generates next and previous cursors based on the returned data.
 *
 * @typeParam T - Type of items in the result
 *
 * @param items - Array of items to return (includes one extra item to determine hasMore)
 * @param total - Total count of items matching the query (optional)
 * @param request - Original pagination request
 * @returns Formatted cursor-based paginated response
 *
 * @example
 * const items = await repository.find({ take: 21 }); // Extra item to check hasMore
 * const result = createCursorPaginatedResponse(
 *   items,
 *   5432,
 *   { limit: 20, sortBy: 'id', sortOrder: 'ASC' }
 * );
 *
 * @internal
 */
export function createCursorPaginatedResponse<T extends { id: number; [key: string]: any }>(
  items: T[],
  total: number | undefined,
  request: Omit<CursorPaginationRequest, 'cursor'> & { cursor?: DecodedCursor }
): CursorPaginatedResult<T> {
  const hasMore = items.length > request.limit;
  const dataItems = hasMore ? items.slice(0, request.limit) : items;

  let nextCursor: string | null = null;
  let previousCursor: string | null = null;

  if (dataItems.length > 0) {
    const firstItem = dataItems[0];
    const lastItem = dataItems[dataItems.length - 1];

    // Generate next cursor if there are more items
    if (hasMore) {
      const sortKeyValue = lastItem[request.sortBy];
      nextCursor = encodeCursor(String(sortKeyValue), lastItem.id);
    }

    // Generate previous cursor if we have a reference cursor
    if (request.cursor) {
      const sortKeyValue = firstItem[request.sortBy];
      previousCursor = encodeCursor(String(sortKeyValue), firstItem.id);
    }
  }

  logger.debug('Created cursor paginated response', {
    itemsCount: dataItems.length,
    hasMore,
    hasNextCursor: nextCursor !== null,
    hasPreviousCursor: previousCursor !== null,
    total,
  });

  return {
    data: dataItems,
    pagination: {
      nextCursor,
      previousCursor,
      hasMore,
      limit: request.limit,
      total,
    },
  };
}

/**
 * Create an offset-based paginated response from result items.
 * Calculates page metadata based on total count and pagination parameters.
 *
 * @typeParam T - Type of items in the result
 *
 * @param items - Array of items to return
 * @param total - Total count of items matching the query
 * @param request - Original pagination request
 * @returns Formatted offset-based paginated response
 *
 * @example
 * const [items, total] = await repository.findAndCount({ skip: 50, take: 50 });
 * const result = createOffsetPaginatedResponse(
 *   items,
 *   total,
 *   { page: 2, limit: 50, sortBy: 'name', sortOrder: 'ASC' }
 * );
 *
 * @internal
 */
export function createOffsetPaginatedResponse<T>(
  items: T[],
  total: number,
  request: OffsetPaginationRequest
): OffsetPaginatedResult<T> {
  const totalPages = Math.ceil(total / request.limit);
  const hasNext = request.page < totalPages;
  const hasPrevious = request.page > 1;

  logger.debug('Created offset paginated response', {
    page: request.page,
    limit: request.limit,
    total,
    totalPages,
    hasNext,
    hasPrevious,
  });

  return {
    data: items,
    pagination: {
      page: request.page,
      limit: request.limit,
      total,
      totalPages,
      hasNext,
      hasPrevious,
    },
  };
}

/**
 * Joi validation schema for cursor-based pagination requests.
 * Validates limit, sortBy, and sortOrder parameters.
 *
 * @example
 * const { error, value } = cursorPaginationSchema.validate(req.query);
 *
 * @internal
 */
export const cursorPaginationSchema = Joi.object<CursorPaginationRequest>({
  cursor: Joi.string().base64().optional(),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .required()
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': `Limit must not exceed ${MAX_PAGE_SIZE}`,
    }),
  sortBy: Joi.string()
    .alphanum()
    .regex(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'SortBy must contain only alphanumeric characters and underscores',
    }),
  sortOrder: Joi.string()
    .valid('ASC', 'DESC')
    .required()
    .messages({
      'any.only': 'SortOrder must be either ASC or DESC',
    }),
}).strict();

/**
 * Joi validation schema for offset-based pagination requests.
 * Validates page, limit, sortBy, and sortOrder parameters.
 *
 * @example
 * const { error, value } = offsetPaginationSchema.validate(req.query);
 *
 * @internal
 */
export const offsetPaginationSchema = Joi.object<OffsetPaginationRequest>({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .required()
    .messages({
      'number.min': 'Page must be at least 1',
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .required()
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': `Limit must not exceed ${MAX_PAGE_SIZE}`,
    }),
  sortBy: Joi.string()
    .alphanum()
    .regex(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'SortBy must contain only alphanumeric characters and underscores',
    }),
  sortOrder: Joi.string()
    .valid('asc', 'desc', 'ASC', 'DESC')
    .default('ASC')
    .messages({
      'any.only': 'SortOrder must be one of: asc, desc, ASC, DESC',
    }),
}).strict();
