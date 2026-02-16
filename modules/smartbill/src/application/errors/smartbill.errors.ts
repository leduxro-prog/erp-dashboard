/**
 * SmartBill API error codes
 */
export enum SmartBillErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_COMPANY_VAT = 'INVALID_COMPANY_VAT',
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  PROFORMA_NOT_FOUND = 'PROFORMA_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base SmartBill error class
 */
export class SmartBillError extends Error {
  constructor(message: string, public readonly code: SmartBillErrorCode | string) {
    super(message);
    this.name = 'SmartBillError';
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      SmartBillErrorCode.RATE_LIMIT_EXCEEDED,
      SmartBillErrorCode.SERVER_ERROR,
      SmartBillErrorCode.NETWORK_ERROR,
      SmartBillErrorCode.TIMEOUT_ERROR,
    ].includes(this.code as SmartBillErrorCode);
  }
}

/**
 * SmartBill API error
 */
export class SmartBillApiError extends SmartBillError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly apiResponse?: any,
    code?: SmartBillErrorCode,
  ) {
    // Auto-determine error code from status code if not provided
    const errorCode = code || SmartBillApiError.determineErrorCode(message, statusCode);
    super(message, errorCode);
    this.name = 'SmartBillApiError';
  }

  /**
   * Determine error code from status code and message
   */
  private static determineErrorCode(message: string, statusCode: number): SmartBillErrorCode {
    if (statusCode === 401 || statusCode === 403) {
      return SmartBillErrorCode.AUTHENTICATION_FAILED;
    }
    if (statusCode === 400) {
      if (message.toLowerCase().includes('cif') || message.toLowerCase().includes('vat')) {
        return SmartBillErrorCode.INVALID_COMPANY_VAT;
      }
      if (message.toLowerCase().includes('validation') || message.toLowerCase().includes('invalid')) {
        return SmartBillErrorCode.VALIDATION_ERROR;
      }
      return SmartBillErrorCode.INVALID_REQUEST;
    }
    if (statusCode === 404) {
      if (message.toLowerCase().includes('proforma')) {
        return SmartBillErrorCode.PROFORMA_NOT_FOUND;
      }
      return SmartBillErrorCode.INVOICE_NOT_FOUND;
    }
    if (statusCode === 429) {
      return SmartBillErrorCode.RATE_LIMIT_EXCEEDED;
    }
    if (statusCode >= 500) {
      return SmartBillErrorCode.SERVER_ERROR;
    }
    return SmartBillErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Get recommended retry delay in milliseconds
   */
  getRetryDelay(): number {
    if (this.code === SmartBillErrorCode.RATE_LIMIT_EXCEEDED) {
      // Check for Retry-After header in apiResponse
      const retryAfter = this.apiResponse?.retryAfter;
      if (retryAfter && typeof retryAfter === 'number') {
        return retryAfter * 1000;
      }
      return 60000; // Default to 1 minute for rate limit
    }
    if (this.statusCode >= 500) {
      return 5000; // 5 seconds for server errors
    }
    return 2000; // 2 seconds default
  }
}

/**
 * Invoice creation error
 */
export class InvoiceCreationError extends SmartBillError {
  constructor(
    message: string,
    public readonly orderId?: string,
  ) {
    super(message, 'INVOICE_CREATION_ERROR');
    this.name = 'InvoiceCreationError';
  }
}

/**
 * Proforma creation error
 */
export class ProformaCreationError extends SmartBillError {
  constructor(
    message: string,
    public readonly orderId?: string,
  ) {
    super(message, 'PROFORMA_CREATION_ERROR');
    this.name = 'ProformaCreationError';
  }
}

/**
 * Stock sync error
 */
export class StockSyncError extends SmartBillError {
  constructor(
    message: string,
    public readonly failedWarehouses?: string[],
  ) {
    super(message, 'STOCK_SYNC_ERROR');
    this.name = 'StockSyncError';
  }
}

/**
 * Repository error
 */
export class RepositoryError extends SmartBillError {
  constructor(message: string) {
    super(message, 'REPOSITORY_ERROR');
    this.name = 'RepositoryError';
  }
}
