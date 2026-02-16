/**
 * B2B Portal API Client
 * Real HTTP-based client for integrating with external B2B Portal APIs.
 *
 * This client handles:
 * - HTTP requests to external B2B Portal endpoints
 * - Authentication with API keys/tokens
 * - Request/response logging
 * - Retry logic with exponential backoff
 * - Rate limiting
 * - Error handling and mapping
 *
 * @module B2B Portal - Infrastructure Services
 */

import { Logger } from 'winston';
import { createHmac, randomBytes } from 'crypto';

export interface B2BPortalConfig {
  /**
   * Base URL of the B2B Portal API
   */
  baseUrl: string;

  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * API secret for HMAC signature generation (optional)
   */
  apiSecret?: string;

  /**
   * Merchant ID or tenant ID
   */
  merchantId: string;

  /**
   * Timeout in milliseconds for requests
   */
  timeout?: number;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Enable request/response logging
   */
  enableLogging?: boolean;

  /**
   * Custom headers to include in all requests
   */
  headers?: Record<string, string>;
}

export interface B2BPortalOrder {
  /**
   * Unique order identifier in B2B Portal
   */
  id: string;

  /**
   * External order number
   */
  orderNumber: string;

  /**
   * Current status of the order
   */
  status: B2BPortalOrderStatus;

  /**
   * Order items
   */
  items: B2BPortalOrderItem[];

  /**
   * Total order amount
   */
  totalAmount: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Customer reference ID
   */
  customerId: string;

  /**
   * Shipping address
   */
  shippingAddress?: string;

  /**
   * Tracking numbers for shipments
   */
  trackingNumbers?: string[];

  /**
   * Order creation timestamp
   */
  createdAt: string;

  /**
   * Last update timestamp
   */
  updatedAt: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

export interface B2BPortalOrderItem {
  /**
   * Product SKU
   */
  sku: string;

  /**
   * Product name
   */
  name: string;

  /**
   * Quantity ordered
   */
  quantity: number;

  /**
   * Unit price
   */
  unitPrice: number;

  /**
   * Total price for this item
   */
  totalPrice: number;
}

export interface B2BPortalInvoice {
  /**
   * Unique invoice identifier in B2B Portal
   */
  id: string;

  /**
   * Invoice number
   */
  invoiceNumber: string;

  /**
   * Associated order ID
   */
  orderId: string;

  /**
   * Current status of the invoice
   */
  status: B2BPortalInvoiceStatus;

  /**
   * Invoice items
   */
  items: B2BPortalInvoiceItem[];

  /**
   * Subtotal before tax
   */
  subtotal: number;

  /**
   * Tax amount
   */
  taxAmount: number;

  /**
   * Total amount
   */
  totalAmount: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Invoice issue date
   */
  issueDate: string;

  /**
   * Payment due date
   */
  dueDate: string;

  /**
   * Payment date (if paid)
   */
  paidDate?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

export interface B2BPortalInvoiceItem {
  /**
   * Product SKU
   */
  sku: string;

  /**
   * Product name
   */
  name: string;

  /**
   * Quantity
   */
  quantity: number;

  /**
   * Unit price
   */
  unitPrice: number;

  /**
   * Total price
   */
  totalPrice: number;

  /**
   * Tax rate
   */
  taxRate: number;
}

/**
 * B2B Portal order statuses
 */
export type B2BPortalOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED'
  | 'ON_HOLD'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PENDING';

/**
 * B2B Portal invoice statuses
 */
export type B2BPortalInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'SENT'
  | 'VIEWED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'VOID';

export interface OrderQueryOptions {
  /**
   * Order status filter
   */
  status?: B2BPortalOrderStatus;

  /**
   * Customer ID filter
   */
  customerId?: string;

  /**
   * Date range start
   */
  fromDate?: string;

  /**
   * Date range end
   */
  toDate?: string;

  /**
   * Pagination limit
   */
  limit?: number;

  /**
   * Pagination offset
   */
  offset?: number;
}

export interface InvoiceQueryOptions {
  /**
   * Invoice status filter
   */
  status?: B2BPortalInvoiceStatus;

  /**
   * Order ID filter
   */
  orderId?: string;

  /**
   * Customer ID filter
   */
  customerId?: string;

  /**
   * Date range start
   */
  fromDate?: string;

  /**
   * Date range end
   */
  toDate?: string;

  /**
   * Pagination limit
   */
  limit?: number;

  /**
   * Pagination offset
   */
  offset?: number;
}

export interface CreateOrderRequest {
  /**
   * Internal ERP order ID
   */
  erpOrderId: string;

  /**
   * External order number
   */
  orderNumber: string;

  /**
   * Customer reference ID
   */
  customerId: string;

  /**
   * Order items
   */
  items: B2BPortalOrderItem[];

  /**
   * Total amount
   */
  totalAmount: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Shipping address
   */
  shippingAddress: string;

  /**
   * Billing address
   */
  billingAddress?: string;

  /**
   * Contact name
   */
  contactName: string;

  /**
   * Contact phone
   */
  contactPhone?: string;

  /**
   * Notes
   */
  notes?: string;

  /**
   * Purchase order number
   */
  purchaseOrderNumber?: string;
}

export interface CreateInvoiceRequest {
  /**
   * Internal ERP invoice ID
   */
  erpInvoiceId: string;

  /**
   * External order ID
   */
  orderId: string;

  /**
   * Invoice number
   */
  invoiceNumber: string;

  /**
   * Customer reference ID
   */
  customerId: string;

  /**
   * Invoice items
   */
  items: B2BPortalInvoiceItem[];

  /**
   * Subtotal amount
   */
  subtotal: number;

  /**
   * Tax amount
   */
  taxAmount: number;

  /**
   * Total amount
   */
  totalAmount: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Issue date
   */
  issueDate: string;

  /**
   * Due date
   */
  dueDate: string;
}

export interface B2BPortalApiError extends Error {
  /**
   * HTTP status code
   */
  statusCode?: number;

  /**
   * Error code from B2B Portal
   */
  code?: string;

  /**
   * Error details
   */
  details?: Record<string, unknown>;

  /**
   * Whether the error is retryable
   */
  retryable?: boolean;
}

export interface IdempotencyKey {
  /**
   * Unique key for idempotent requests
   */
  key: string;

  /**
   * Timestamp when the key was generated
   */
  timestamp: string;
}

/**
 * B2B Portal API Client
 *
 * Provides methods for:
 * - Querying order status from B2B Portal
 * - Querying invoice status from B2B Portal
 * - Creating orders in B2B Portal
 * - Creating invoices in B2B Portal
 * - Listing orders with filters
 * - Listing invoices with filters
 */
export class B2BPortalApiClient {
  private readonly config: Required<Omit<B2BPortalConfig, 'apiSecret' | 'headers'>> & {
    apiSecret?: string;
    headers?: Record<string, string>;
  };

  private readonly logger: Logger;

  /**
   * Request counter for rate limiting
   */
  private requestCount = 0;

  /**
   * Last request timestamp
   */
  private lastRequestTime = Date.now();

  constructor(config: B2BPortalConfig, logger?: Logger) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      merchantId: config.merchantId,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableLogging: config.enableLogging ?? true,
      headers: config.headers ?? {},
    };

    this.logger = logger ?? this.createDefaultLogger();
  }

  /**
   * Get order status from B2B Portal
   *
   * @param b2bOrderId - B2B Portal order ID
   * @returns Promise resolving to order details
   */
  async getOrder(b2bOrderId: string): Promise<B2BPortalOrder> {
    return this.withRetry(async () => {
      this.logger.debug('Fetching order from B2B Portal', { b2bOrderId });

      const response = await this.fetch<B2BPortalOrder>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/orders/${b2bOrderId}`,
      );

      this.logger.info('Order fetched successfully from B2B Portal', {
        b2bOrderId,
        status: response.status,
      });

      return response;
    });
  }

  /**
   * Query orders with filters
   *
   * @param options - Query options for filtering orders
   * @returns Promise resolving to array of orders
   */
  async listOrders(options?: OrderQueryOptions): Promise<B2BPortalOrder[]> {
    return this.withRetry(async () => {
      this.logger.debug('Listing orders from B2B Portal', { options });

      const params = this.buildQueryParams(options);
      const response = await this.fetch<{ orders: B2BPortalOrder[] }>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/orders`,
        {
          params,
        },
      );

      this.logger.info('Orders listed successfully from B2B Portal', {
        count: response.orders.length,
      });

      return response.orders;
    });
  }

  /**
   * Create order in B2B Portal
   *
   * @param request - Order creation request
   * @param idempotencyKey - Optional idempotency key for safe retries
   * @returns Promise resolving to created order
   */
  async createOrder(request: CreateOrderRequest, idempotencyKey?: string): Promise<B2BPortalOrder> {
    return this.withRetry(async () => {
      this.logger.debug('Creating order in B2B Portal', {
        erpOrderId: request.erpOrderId,
        orderNumber: request.orderNumber,
      });

      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const response = await this.fetch<B2BPortalOrder>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/orders`,
        {
          method: 'POST',
          body: JSON.stringify({
            external_ref_id: request.erpOrderId,
            order_number: request.orderNumber,
            customer_ref_id: request.customerId,
            items: request.items,
            total_amount: request.totalAmount,
            currency: request.currency,
            shipping_address: request.shippingAddress,
            billing_address: request.billingAddress,
            contact_name: request.contactName,
            contact_phone: request.contactPhone,
            notes: request.notes,
            purchase_order_number: request.purchaseOrderNumber,
          }),
          headers,
        },
      );

      this.logger.info('Order created successfully in B2B Portal', {
        b2bOrderId: response.id,
        erpOrderId: request.erpOrderId,
      });

      return response;
    });
  }

  /**
   * Update order status in B2B Portal
   *
   * @param b2bOrderId - B2B Portal order ID
   * @param status - New status
   * @param notes - Optional notes about the status change
   * @returns Promise resolving to updated order
   */
  async updateOrderStatus(
    b2bOrderId: string,
    status: B2BPortalOrderStatus,
    notes?: string,
  ): Promise<B2BPortalOrder> {
    return this.withRetry(async () => {
      this.logger.debug('Updating order status in B2B Portal', {
        b2bOrderId,
        status,
      });

      const response = await this.fetch<B2BPortalOrder>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/orders/${b2bOrderId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, notes }),
        },
      );

      this.logger.info('Order status updated successfully in B2B Portal', {
        b2bOrderId,
        status,
      });

      return response;
    });
  }

  /**
   * Get invoice status from B2B Portal
   *
   * @param b2bInvoiceId - B2B Portal invoice ID
   * @returns Promise resolving to invoice details
   */
  async getInvoice(b2bInvoiceId: string): Promise<B2BPortalInvoice> {
    return this.withRetry(async () => {
      this.logger.debug('Fetching invoice from B2B Portal', { b2bInvoiceId });

      const response = await this.fetch<B2BPortalInvoice>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/invoices/${b2bInvoiceId}`,
      );

      this.logger.info('Invoice fetched successfully from B2B Portal', {
        b2bInvoiceId,
        status: response.status,
      });

      return response;
    });
  }

  /**
   * Query invoices with filters
   *
   * @param options - Query options for filtering invoices
   * @returns Promise resolving to array of invoices
   */
  async listInvoices(options?: InvoiceQueryOptions): Promise<B2BPortalInvoice[]> {
    return this.withRetry(async () => {
      this.logger.debug('Listing invoices from B2B Portal', { options });

      const params = this.buildQueryParams(options);
      const response = await this.fetch<{ invoices: B2BPortalInvoice[] }>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/invoices`,
        {
          params,
        },
      );

      this.logger.info('Invoices listed successfully from B2B Portal', {
        count: response.invoices.length,
      });

      return response.invoices;
    });
  }

  /**
   * Create invoice in B2B Portal
   *
   * @param request - Invoice creation request
   * @param idempotencyKey - Optional idempotency key for safe retries
   * @returns Promise resolving to created invoice
   */
  async createInvoice(
    request: CreateInvoiceRequest,
    idempotencyKey?: string,
  ): Promise<B2BPortalInvoice> {
    return this.withRetry(async () => {
      this.logger.debug('Creating invoice in B2B Portal', {
        erpInvoiceId: request.erpInvoiceId,
        invoiceNumber: request.invoiceNumber,
      });

      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const response = await this.fetch<B2BPortalInvoice>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/invoices`,
        {
          method: 'POST',
          body: JSON.stringify({
            external_ref_id: request.erpInvoiceId,
            order_ref_id: request.orderId,
            invoice_number: request.invoiceNumber,
            customer_ref_id: request.customerId,
            items: request.items,
            subtotal: request.subtotal,
            tax_amount: request.taxAmount,
            total_amount: request.totalAmount,
            currency: request.currency,
            issue_date: request.issueDate,
            due_date: request.dueDate,
          }),
          headers,
        },
      );

      this.logger.info('Invoice created successfully in B2B Portal', {
        b2bInvoiceId: response.id,
        erpInvoiceId: request.erpInvoiceId,
      });

      return response;
    });
  }

  /**
   * Update invoice status in B2B Portal
   *
   * @param b2bInvoiceId - B2B Portal invoice ID
   * @param status - New status
   * @param notes - Optional notes about the status change
   * @returns Promise resolving to updated invoice
   */
  async updateInvoiceStatus(
    b2bInvoiceId: string,
    status: B2BPortalInvoiceStatus,
    notes?: string,
  ): Promise<B2BPortalInvoice> {
    return this.withRetry(async () => {
      this.logger.debug('Updating invoice status in B2B Portal', {
        b2bInvoiceId,
        status,
      });

      const response = await this.fetch<B2BPortalInvoice>(
        `${this.config.baseUrl}/api/v1/merchant/${this.config.merchantId}/invoices/${b2bInvoiceId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, notes }),
        },
      );

      this.logger.info('Invoice status updated successfully in B2B Portal', {
        b2bInvoiceId,
        status,
      });

      return response;
    });
  }

  /**
   * Verify webhook signature
   *
   * @param payload - Raw webhook payload
   * @param signature - Signature header value
   * @returns True if signature is valid
   */
  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    if (!this.config.apiSecret) {
      this.logger.warn('Cannot verify webhook signature: no API secret configured');
      return false;
    }

    try {
      const expectedSignature = createHmac('sha256', this.config.apiSecret)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison
      const actual = Buffer.from(signature);
      const expected = Buffer.from(expectedSignature);

      if (actual.length !== expected.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < actual.length; i++) {
        result |= actual[i] ^ expected[i];
      }

      const isValid = result === 0;
      this.logger.debug('Webhook signature verification result', { isValid });

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', { error });
      return false;
    }
  }

  /**
   * Generate idempotency key
   *
   * @param prefix - Optional prefix for the key
   * @returns Generated idempotency key
   */
  generateIdempotencyKey(prefix = 'b2b'): IdempotencyKey {
    const key = `${prefix}_${Date.now()}_${randomBytes(16).toString('hex')}`;
    return {
      key,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test connectivity to B2B Portal API
   *
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.debug('Testing B2B Portal API connection');

      const response = await this.fetch<{ status: string }>(`${this.config.baseUrl}/api/v1/health`);

      this.logger.info('B2B Portal API connection test successful', {
        status: response.status,
      });

      return true;
    } catch (error) {
      this.logger.error('B2B Portal API connection test failed', { error });
      return false;
    }
  }

  /**
   * Core fetch method with authentication and error handling
   */
  private async fetch<T>(
    url: string,
    options: RequestInit & { params?: Record<string, unknown> } = {},
  ): Promise<T> {
    // Apply rate limiting
    await this.applyRateLimit();

    const { params, ...fetchOptions } = options;

    // Build URL with query parameters
    let fetchUrl = url;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      fetchUrl = `${url}?${searchParams.toString()}`;
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      'X-Merchant-ID': this.config.merchantId,
      ...this.config.headers,
      ...this.normalizeHeaders(fetchOptions.headers),
    };

    // Add request ID for tracing
    headers['X-Request-ID'] = `b2b_${Date.now()}_${this.requestCount}`;

    // Add timestamp header for HMAC
    if (this.config.apiSecret) {
      headers['X-Timestamp'] = Date.now().toString();
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();

    const startTime = Date.now();

    if (this.config.enableLogging) {
      this.logger.debug('B2B Portal API request', {
        method: options.method || 'GET',
        url: fetchUrl,
        requestId: headers['X-Request-ID'],
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(fetchUrl, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      if (this.config.enableLogging) {
        this.logger.debug('B2B Portal API response', {
          requestId: headers['X-Request-ID'],
          status: response.status,
          duration,
        });
      }

      // Handle non-success responses
      if (!response.ok) {
        const errorBody = await response.text();
        let errorData: Record<string, unknown> = {};

        try {
          errorData = JSON.parse(errorBody);
        } catch {
          // If not JSON, use raw text
          errorData = { message: errorBody };
        }

        const error: B2BPortalApiError = new Error(
          `B2B Portal API error: ${response.status} ${response.statusText}`,
        ) as B2BPortalApiError;
        error.name = 'B2BPortalApiError';
        error.statusCode = response.status;
        error.code = String(errorData['code'] || errorData['error']);
        error.details = errorData;
        error.retryable = this.isErrorRetryable(response.status);

        this.logger.error('B2B Portal API error', {
          requestId: headers['X-Request-ID'],
          status: response.status,
          errorData,
          duration,
        });

        throw error;
      }

      // Parse successful response
      const data = await response.json();

      // Check for B2B Portal-level errors in response
      if (typeof data === 'object' && data !== null && ('error' in data || 'errors' in data)) {
        const errorData = data as Record<string, unknown>;
        const error: B2BPortalApiError = new Error(
          `B2B Portal business error: ${String(errorData['error'] || 'Unknown error')}`,
        ) as B2BPortalApiError;
        error.name = 'B2BPortalApiError';
        error.code =
          typeof errorData['errorCode'] === 'string' ? errorData['errorCode'] : 'BUSINESS_ERROR';
        error.details = errorData;

        this.logger.error('B2B Portal business error', {
          requestId: headers['X-Request-ID'],
          errorData,
          duration,
        });

        throw error;
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError: B2BPortalApiError = new Error(
          `B2B Portal API request timeout after ${this.config.timeout}ms`,
        ) as B2BPortalApiError;
        timeoutError.name = 'B2BPortalApiError';
        timeoutError.retryable = true;
        throw timeoutError;
      }

      // Re-throw B2BPortalApiError as-is
      if (error instanceof Error && error.name === 'B2BPortalApiError') {
        throw error;
      }

      // Wrap other errors
      const wrappedError: B2BPortalApiError = new Error(
        `B2B Portal API request failed: ${error instanceof Error ? error.message : String(error)}`,
      ) as B2BPortalApiError;
      wrappedError.name = 'B2BPortalApiError';
      wrappedError.retryable = true;

      this.logger.error('B2B Portal API request failed', {
        requestId: headers['X-Request-ID'],
        error: error instanceof Error ? error.message : String(error),
      });

      throw wrappedError;
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async withRetry<T>(operation: () => Promise<T>, attempt = 1): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const apiError = error as B2BPortalApiError;

      // Don't retry if error is not retryable or max retries reached
      if (!apiError.retryable || attempt >= this.config.maxRetries) {
        throw error;
      }

      const delay = this.config.retryDelay * Math.pow(2, attempt - 1);

      this.logger.warn('Retrying B2B Portal API request', {
        attempt,
        maxRetries: this.config.maxRetries,
        delay,
        error: apiError.message,
      });

      await this.sleep(delay);

      return this.withRetry(operation, attempt + 1);
    }
  }

  /**
   * Apply simple rate limiting
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Enforce minimum 100ms between requests (10 requests per second)
    const minInterval = 100;

    if (timeSinceLastRequest < minInterval) {
      const sleepTime = minInterval - timeSinceLastRequest;
      await this.sleep(sleepTime);
    }
  }

  /**
   * Build query parameters from options object
   */
  private buildQueryParams(
    options?: OrderQueryOptions | InvoiceQueryOptions,
  ): Record<string, string> {
    const params: Record<string, string> = {};

    if (!options) {
      return params;
    }

    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== null) {
        // Handle array values
        if (Array.isArray(value)) {
          params[key] = value.join(',');
        } else {
          params[key] = String(value);
        }
      }
    }

    return params;
  }

  /**
   * Check if HTTP status code is retryable
   */
  private isErrorRetryable(statusCode: number): boolean {
    // Retry on: 429 (rate limit), 500, 502, 503, 504
    return statusCode === 429 || statusCode >= 500;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeHeaders(headers?: unknown): Record<string, string> {
    if (!headers) {
      return {};
    }

    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }

    if (Array.isArray(headers)) {
      return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]));
    }

    if (typeof headers === 'object' && headers !== null) {
      return Object.fromEntries(
        Object.entries(headers as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value),
        ]),
      );
    }

    return {};
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    // Minimal logger if none provided
    const winston = require('winston');
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }
}
