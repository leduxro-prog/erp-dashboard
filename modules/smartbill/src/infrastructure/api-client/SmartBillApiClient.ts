import { SmartBillApiError } from '../../application/errors/smartbill.errors';
import { ApiClient } from '@shared/api/api-client';
import { ApiClientFactory } from '@shared/api/api-client-factory';
import { createModuleLogger } from '@shared/utils/logger';
import axios, { AxiosInstance } from 'axios';

const logger = createModuleLogger('smartbill-api-client');

/**
 * SmartBill API response error structure
 */
interface SmartBillErrorResponse {
  message?: string;
  error?: string;
  code?: string;
  errors?: Array<{ message: string; code?: string }>;
}

/**
 * Invoice status from SmartBill
 */
export type SmartBillInvoiceStatus = 'draft' | 'sent' | 'paid' | 'canceled' | 'storno';

/**
 * Proforma status from SmartBill
 */
export type SmartBillProformaStatus = 'draft' | 'sent' | 'converted' | 'canceled';

/**
 * SmartBill status mapping to internal ERP statuses
 */
export class SmartBillStatusMapper {
  /**
   * Map SmartBill invoice status to internal ERP status
   */
  static mapInvoiceStatus(smartbillStatus: SmartBillInvoiceStatus): 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled' {
    const mapping: Record<SmartBillInvoiceStatus, 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled'> = {
      draft: 'draft',
      sent: 'sent',
      paid: 'paid',
      canceled: 'cancelled',
      storno: 'cancelled',
    };
    return mapping[smartbillStatus] || 'draft';
  }

  /**
   * Map SmartBill proforma status to internal ERP status
   */
  static mapProformaStatus(smartbillStatus: SmartBillProformaStatus): 'draft' | 'issued' | 'sent' | 'converted' | 'cancelled' {
    const mapping: Record<SmartBillProformaStatus, 'draft' | 'issued' | 'sent' | 'converted' | 'cancelled'> = {
      draft: 'draft',
      sent: 'sent',
      converted: 'converted',
      canceled: 'cancelled',
    };
    return mapping[smartbillStatus] || 'draft';
  }

  /**
   * Determine if status is final (no further updates expected)
   */
  static isFinalInvoiceStatus(smartbillStatus: SmartBillInvoiceStatus): boolean {
    return smartbillStatus === 'paid' || smartbillStatus === 'canceled' || smartbillStatus === 'storno';
  }

  /**
   * Determine if status is final (no further updates expected)
   */
  static isFinalProformaStatus(smartbillStatus: SmartBillProformaStatus): boolean {
    return smartbillStatus === 'converted' || smartbillStatus === 'canceled';
  }
}

/**
 * SmartBill API client configuration.
 *
 * Now uses the centralized ApiClientFactory for consistent
 * resilience patterns across all API integrations.
 *
 * @deprecated Use ApiClientFactory.getClient('smartbill') instead
 *
 * @example
 * {
 *   baseUrl: 'https://api.smartbill.ro',
 *   username: 'user@example.com',
 *   password: 'api-password',
 *   maxRetries: 3,
 *   rateLimitPerMinute: 10,
 * }
 */
export interface SmartBillApiClientConfig {
  /** SmartBill API base URL */
  baseUrl: string;
  /** API username/email */
  username: string;
  /** API password or token */
  password: string;
  /** Maximum retry attempts on transient errors (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 5000) */
  retryDelayMs?: number;
  /** Rate limit: requests per minute (default: 10) */
  rateLimitPerMinute?: number;
}

/**
 * SmartBill API Client adapter for legacy integration.
 *
 * This implementation provides direct integration with SmartBill API endpoints
 * with proper retry logic, exponential backoff, and error handling.
 *
 * SmartBill API Documentation: https://www.smartbill.ro/api/
 *
 * @example
 * const client = new SmartBillApiClient({
 *   baseUrl: 'https://ws.smartbill.ro/SBORO/api',
 *   username: 'user@example.com',
 *   password: 'api-password',
 * });
 *
 * const invoice = await client.createInvoice(invoiceData);
 */
export class SmartBillApiClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly companyVat: string;

  /**
   * Create a new SmartBill API client.
   *
   * @param config - Client configuration
   */
  constructor(private readonly config: SmartBillApiClientConfig) {
    this.maxRetries = config.maxRetries || 3;
    this.baseDelayMs = config.retryDelayMs || 1000;
    this.companyVat = process.env.SMARTBILL_COMPANY_VAT || '';

    // Create axios instance with authentication
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    logger.info('SmartBill API client initialized', {
      baseUrl: config.baseUrl,
      username: config.username.substring(0, 3) + '***',
      companyVat: this.companyVat,
    });
  }

  /**
   * Create an invoice in SmartBill.
   *
   * SmartBill API Endpoint: POST /invoice
   *
   * @param payload - Invoice data according to SmartBill schema
   * @returns Created invoice with internal ID and number
   * @throws {SmartBillApiError} If API call fails
   *
   * @example
   * const invoice = await client.createInvoice({
   *   clientCif: 'RO12345678',
   *   clientName: 'Company Name',
   *   issueDate: '2024-01-15',
   *   dueDate: '2024-02-15',
   *   seriesName: 'FL',
   *   products: [...]
   * });
   */
  async createInvoice(payload: any): Promise<{ id: string; number: string; status: SmartBillInvoiceStatus }> {
    return this.withRetry(async () => {
      try {
        logger.info('Creating SmartBill invoice', {
          clientCif: payload.clientCif || payload.companyCif,
          seriesName: payload.seriesName,
        });

        const response = await this.axiosInstance.post('/invoice', {
          ...payload,
          companyVat: this.companyVat,
        });

        const result = response.data;

        // Handle different response formats from SmartBill
        const smartBillId = result.smartbillInvoiceId || result.id || result.invoiceId;
        const invoiceNumber = result.invoiceNumber || result.number;

        logger.info('SmartBill invoice created successfully', {
          smartBillId,
          invoiceNumber,
        });

        return {
          id: smartBillId,
          number: invoiceNumber,
          status: result.status || 'sent',
        };
      } catch (error) {
        throw this.handleApiError(error, 'createInvoice');
      }
    });
  }

  /**
   * Create a proforma invoice in SmartBill.
   *
   * SmartBill API Endpoint: POST /proforma
   *
   * @param payload - Proforma data according to SmartBill schema
   * @returns Created proforma with internal ID and number
   * @throws {SmartBillApiError} If API call fails
   *
   * @example
   * const proforma = await client.createProforma({
   *   clientCif: 'RO12345678',
   *   clientName: 'Company Name',
   *   issueDate: '2024-01-15',
   *   dueDate: '2024-02-15',
   *   seriesName: 'PF',
   *   products: [...]
   * });
   */
  async createProforma(payload: any): Promise<{ id: string; number: string; status: SmartBillProformaStatus }> {
    return this.withRetry(async () => {
      try {
        logger.info('Creating SmartBill proforma', {
          clientCif: payload.clientCif || payload.companyCif,
          seriesName: payload.seriesName,
        });

        const response = await this.axiosInstance.post('/proforma', {
          ...payload,
          companyVat: this.companyVat,
        });

        const result = response.data;

        // Handle different response formats from SmartBill
        const smartBillId = result.smartbillProformaId || result.id || result.proformaId;
        const proformaNumber = result.proformaNumber || result.number;

        logger.info('SmartBill proforma created successfully', {
          smartBillId,
          proformaNumber,
        });

        return {
          id: smartBillId,
          number: proformaNumber,
          status: result.status || 'sent',
        };
      } catch (error) {
        throw this.handleApiError(error, 'createProforma');
      }
    });
  }

  /**
   * Get invoice details from SmartBill.
   *
   * SmartBill API Endpoint: GET /invoice/{seriesName}/{number}
   *
   * @param seriesName - Invoice series name (e.g., 'FL')
   * @param number - Invoice number
   * @returns Invoice details with products
   * @throws {SmartBillApiError} If API call fails
   */
  async getInvoice(seriesName: string, number: string): Promise<any> {
    return this.withRetry(async () => {
      try {
        const params = new URLSearchParams({
          cif: this.companyVat,
          seriesName,
          number,
        });

        const response = await this.axiosInstance.get(`/invoice?${params.toString()}`);

        logger.debug('SmartBill invoice retrieved', { seriesName, number });

        return response.data;
      } catch (error) {
        throw this.handleApiError(error, 'getInvoice');
      }
    });
  }

  /**
   * Get proforma details from SmartBill.
   *
   * SmartBill API Endpoint: GET /proforma/{seriesName}/{number}
   *
   * @param seriesName - Proforma series name (e.g., 'PF')
   * @param number - Proforma number
   * @returns Proforma details with products
   * @throws {SmartBillApiError} If API call fails
   */
  async getProforma(seriesName: string, number: string): Promise<any> {
    return this.withRetry(async () => {
      try {
        const params = new URLSearchParams({
          cif: this.companyVat,
          seriesName,
          number,
        });

        const response = await this.axiosInstance.get(`/proforma?${params.toString()}`);

        logger.debug('SmartBill proforma retrieved', { seriesName, number });

        return response.data;
      } catch (error) {
        throw this.handleApiError(error, 'getProforma');
      }
    });
  }

  /**
   * Get list of invoices within a date range.
   *
   * SmartBill API Endpoint: GET /invoice/list
   *
   * @param params - Date range parameters
   * @returns Array of invoices
   * @throws {SmartBillApiError} If API call fails
   */
  async listInvoices(params: { startDate: string; endDate: string }): Promise<any[]> {
    return this.withRetry(async () => {
      try {
        const queryParams = new URLSearchParams({
          cif: this.companyVat,
          startDate: params.startDate,
          endDate: params.endDate,
        });

        const response = await this.axiosInstance.get(`/invoice/list?${queryParams.toString()}`);

        logger.debug('SmartBill invoice list retrieved', {
          startDate: params.startDate,
          endDate: params.endDate,
          count: response.data?.length || 0,
        });

        return response.data || [];
      } catch (error) {
        throw this.handleApiError(error, 'listInvoices');
      }
    });
  }

  /**
   * Get payment status for an invoice.
   *
   * SmartBill API Endpoint: GET /invoice/{smartBillId}/status
   *
   * @param smartBillId - SmartBill invoice ID
   * @returns Payment status with amounts
   * @throws {SmartBillApiError} If API call fails
   */
  async getPaymentStatus(smartBillId: string): Promise<{
    status: string;
    paidAmount: number;
    totalAmount: number;
    paymentDate: Date | null;
  }> {
    return this.withRetry(async () => {
      try {
        const params = new URLSearchParams({ cif: this.companyVat });
        const response = await this.axiosInstance.get(`/invoice/status?${params.toString()}&smartbillInvoiceId=${smartBillId}`);

        const result = response.data || {};
        return {
          status: result.status || result.state || 'unknown',
          paidAmount: result.paidAmount || result.invoicePaidAmount || 0,
          totalAmount: result.totalAmount || result.invoiceTotal || 0,
          paymentDate: result.paymentDate ? new Date(result.paymentDate) : null,
        };
      } catch (error) {
        throw this.handleApiError(error, 'getPaymentStatus');
      }
    });
  }

  /**
   * Get all stocks for all warehouses in a single call.
   *
   * SmartBill API Endpoint: GET /warehouse
   *
   * @returns Array of warehouses with their products
   * @throws {SmartBillApiError} If API call fails
   */
  async getStocks(): Promise<Array<{ warehouseName: string; products: Array<{ sku: string; name?: string; quantity: number; price?: number; measuringUnit?: string; vat?: number }> }>> {
    return this.withRetry(async () => {
      try {
        const params = new URLSearchParams({ cif: this.companyVat });
        const response = await this.axiosInstance.get(`/warehouse?${params.toString()}`);

        const data = response.data || [];
        const list = Array.isArray(data) ? data : (data.warehouses || []);

        const result = list.map((entry: any) => {
          const warehouseName = entry.warehouseName || entry.name || 'unknown';

          return {
            warehouseName,
            products: (entry.products || []).map((p: any) => {
              const price = p.priceWithoutVat ?? p.price ?? null;
              const sku = p.productCode || p.code || p.sku;

              if (!sku) {
                logger.error('SmartBill product missing SKU/productCode', {
                  product: JSON.stringify(p).substring(0, 200),
                });
              }

              return {
                sku: sku || `unknown_${Date.now()}`,
                name: p.productName || p.name || null,
                quantity: typeof p.quantity === 'number' ? p.quantity : 0,
                price: price !== null ? price : undefined,
                measuringUnit: p.measuringUnit || p.um || 'buc',
                vat: typeof p.vat === 'number' ? p.vat : (typeof p.vatRate === 'number' ? p.vatRate : 19),
              };
            }),
          };
        });

        logger.info(`Retrieved ${result.length} warehouses with stocks from SmartBill`);
        return result;
      } catch (error) {
        throw this.handleApiError(error, 'getStocks');
      }
    });
  }

  /**
   * Get stock levels for a specific warehouse.
   *
   * @param warehouseId - Warehouse name
   * @returns Array of SKUs with quantities and product details
   * @throws {SmartBillApiError} If API call fails
   */
  async getStock(warehouseId: string): Promise<Array<{ sku: string; name?: string; quantity: number; price?: number; measuringUnit?: string; vat?: number }>> {
    const stocks = await this.getStocks();
    const entry = stocks.find(s => s.warehouseName === warehouseId);
    return entry ? entry.products : [];
  }

  /**
   * Get list of all warehouses.
   *
   * @returns Array of warehouse information
   * @throws {SmartBillApiError} If API call fails
   */
  async getWarehouses(): Promise<Array<{ id: string; name: string }>> {
    const stocks = await this.getStocks();
    return stocks.map(s => ({
      id: s.warehouseName,
      name: s.warehouseName,
    }));
  }

  /**
   * Cancel an invoice in SmartBill.
   *
   * SmartBill API Endpoint: POST /invoice/cancel
   *
   * @param seriesName - Invoice series name
   * @param number - Invoice number
   * @returns Cancellation result
   * @throws {SmartBillApiError} If API call fails
   */
  async cancelInvoice(seriesName: string, number: string): Promise<{ success: boolean; message?: string }> {
    return this.withRetry(async () => {
      try {
        const response = await this.axiosInstance.post('/invoice/cancel', {
          companyVat: this.companyVat,
          seriesName,
          number,
        });

        logger.info('SmartBill invoice cancelled', { seriesName, number });

        return {
          success: true,
          message: response.data?.message,
        };
      } catch (error) {
        throw this.handleApiError(error, 'cancelInvoice');
      }
    });
  }

  /**
   * Cancel a proforma in SmartBill.
   *
   * SmartBill API Endpoint: POST /proforma/cancel
   *
   * @param seriesName - Proforma series name
   * @param number - Proforma number
   * @returns Cancellation result
   * @throws {SmartBillApiError} If API call fails
   */
  async cancelProforma(seriesName: string, number: string): Promise<{ success: boolean; message?: string }> {
    return this.withRetry(async () => {
      try {
        const response = await this.axiosInstance.post('/proforma/cancel', {
          companyVat: this.companyVat,
          seriesName,
          number,
        });

        logger.info('SmartBill proforma cancelled', { seriesName, number });

        return {
          success: true,
          message: response.data?.message,
        };
      } catch (error) {
        throw this.handleApiError(error, 'cancelProforma');
      }
    });
  }

  /**
   * Convert a proforma to an invoice in SmartBill.
   *
   * SmartBill API Endpoint: POST /proforma/convert
   *
   * @param seriesName - Proforma series name
   * @param number - Proforma number
   * @returns The created invoice details
   * @throws {SmartBillApiError} If API call fails
   */
  async convertProformaToInvoice(seriesName: string, number: string): Promise<{ id: string; number: string; invoiceSeries: string; invoiceNumber: string }> {
    return this.withRetry(async () => {
      try {
        const response = await this.axiosInstance.post('/proforma/convert', {
          companyVat: this.companyVat,
          seriesName,
          number,
        });

        logger.info('SmartBill proforma converted to invoice', { seriesName, number });

        return {
          id: response.data.smartbillInvoiceId || response.data.id,
          number: response.data.invoiceNumber || response.data.number,
          invoiceSeries: response.data.invoiceSeries,
          invoiceNumber: response.data.invoiceNumber,
        };
      } catch (error) {
        throw this.handleApiError(error, 'convertProformaToInvoice');
      }
    });
  }

  /**
   * Execute a function with retry logic and exponential backoff.
   *
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws {SmartBillApiError} If all retry attempts fail
   *
   * @internal
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let delay = this.baseDelayMs;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === this.maxRetries) {
          // On last attempt or non-retryable error, throw
          break;
        }

        // Calculate delay with exponential backoff
        const actualDelay = this.calculateDelay(error, delay);
        delay = Math.min(delay * 2, 30000); // Max 30 seconds

        logger.warn(`SmartBill API request failed, retrying...`, {
          attempt,
          maxAttempts: this.maxRetries,
          delay: actualDelay,
          error: error instanceof Error ? error.message : String(error),
          status: (error as { response?: { status?: number } })?.response?.status,
        });

        await this.sleep(actualDelay);
      }
    }

    throw lastError;
  }

  /**
   * Calculate delay before retry, considering rate limit headers.
   *
   * @param error - The error that occurred
   * @param defaultDelay - Default delay in milliseconds
   * @returns Delay in milliseconds
   *
   * @internal
   */
  private calculateDelay(error: any, defaultDelay: number): number {
    // Check for Retry-After header (rate limiting)
    const retryAfter = error?.response?.headers?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return Math.max(seconds * 1000, defaultDelay);
      }
    }

    return defaultDelay;
  }

  /**
   * Determine if error is retryable.
   *
   * @param error - Error to check
   * @returns True if error should trigger retry
   *
   * @internal
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ENETUNREACH' ||
        error?.code === 'EAI_AGAIN') {
      return true;
    }

    // No response (network issue)
    if (!error?.response) {
      return true;
    }

    const status = error.response.status;

    // Server errors (5xx) - likely transient
    if (status >= 500 && status < 600) {
      return true;
    }

    // Rate limiting (429)
    if (status === 429) {
      return true;
    }

    // Service unavailable (503)
    if (status === 503) {
      return true;
    }

    // Gateway timeout (504)
    if (status === 504) {
      return true;
    }

    // Don't retry client errors (4xx)
    return false;
  }

  /**
   * Handle and normalize API errors to SmartBillApiError.
   *
   * @param error - The error to handle
   * @param operation - Operation that failed
   * @returns Normalized SmartBillApiError
   *
   * @internal
   */
  private handleApiError(error: any, operation: string): SmartBillApiError {
    if (error instanceof SmartBillApiError) {
      return error;
    }

    let message = `SmartBill API error during ${operation}`;
    let statusCode = 0;
    let apiResponse: any = {};

    if (axios.isAxiosError(error)) {
      statusCode = error.response?.status || 0;
      const responseData = error.response?.data as SmartBillErrorResponse | undefined;

      // Extract error message from SmartBill response
      if (responseData) {
        message = responseData.message || responseData.error || message;

        // Handle multiple errors
        if (responseData.errors && Array.isArray(responseData.errors)) {
          message = responseData.errors.map(e => e.message).join(', ');
        }

        apiResponse = responseData;
      } else if (error.message) {
        message = error.message;
      }
    } else if (error instanceof Error) {
      message = error.message;
    }

    logger.error('SmartBill API error', {
      operation,
      message,
      statusCode,
      apiResponse,
    });

    return new SmartBillApiError(
      message,
      statusCode,
      apiResponse,
    );
  }

  /**
   * Sleep for specified milliseconds.
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   *
   * @internal
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
