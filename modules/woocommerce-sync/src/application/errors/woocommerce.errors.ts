export class WooCommerceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WooCommerceError';
  }
}

export class WooCommerceApiError extends WooCommerceError {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: any
  ) {
    super(message);
    this.name = 'WooCommerceApiError';
  }
}

export class SyncError extends WooCommerceError {
  constructor(
    message: string,
    public productId: string,
    public syncType: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export class MappingNotFoundError extends WooCommerceError {
  constructor(internalProductId: string) {
    super(
      `No WooCommerce mapping found for product: ${internalProductId}`
    );
    this.name = 'MappingNotFoundError';
  }
}

export class NetworkError extends WooCommerceError {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RateLimitError extends WooCommerceError {
  constructor(public retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}ms`);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends WooCommerceError {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
