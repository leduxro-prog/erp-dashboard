export class SupplierError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'SupplierError';
  }
}

export class SupplierNotFoundError extends SupplierError {
  constructor(supplierId?: number | string) {
    super(
      `Supplier not found: ${supplierId || 'unknown'}`,
      'SUPPLIER_NOT_FOUND',
    );
    this.name = 'SupplierNotFoundError';
  }
}

export class ScrapeError extends SupplierError {
  constructor(
    message: string,
    public supplierId: number,
    public supplierName: string,
    public originalError?: Error,
  ) {
    super(message, 'SCRAPE_ERROR');
    this.name = 'ScrapeError';
  }
}

export class ScrapeTimeoutError extends ScrapeError {
  constructor(supplierId: number, supplierName: string) {
    super(
      `Scrape timeout for ${supplierName}`,
      supplierId,
      supplierName,
    );
    this.code = 'SCRAPE_TIMEOUT';
    this.name = 'ScrapeTimeoutError';
  }
}

export class ScrapeRetryExhaustedError extends ScrapeError {
  constructor(
    supplierId: number,
    supplierName: string,
    public retries: number,
  ) {
    super(
      `Scrape failed after ${retries} retries for ${supplierName}`,
      supplierId,
      supplierName,
    );
    this.code = 'SCRAPE_RETRY_EXHAUSTED';
    this.name = 'ScrapeRetryExhaustedError';
  }
}

export class SkuMappingError extends SupplierError {
  constructor(message: string) {
    super(message, 'SKU_MAPPING_ERROR');
    this.name = 'SkuMappingError';
  }
}

export class SkuMappingAlreadyExistsError extends SkuMappingError {
  constructor(supplierId: number, supplierSku: string) {
    super(
      `SKU mapping already exists for supplier ${supplierId} with SKU ${supplierSku}`,
    );
    this.code = 'SKU_MAPPING_ALREADY_EXISTS';
    this.name = 'SkuMappingAlreadyExistsError';
  }
}

export class InvalidSkuMappingError extends SkuMappingError {
  constructor(message: string) {
    super(message);
    this.code = 'INVALID_SKU_MAPPING';
    this.name = 'InvalidSkuMappingError';
  }
}

export class InvalidOrderError extends SupplierError {
  constructor(message: string) {
    super(message, 'INVALID_ORDER');
    this.name = 'InvalidOrderError';
  }
}

export class InsufficientStockError extends SupplierError {
  constructor(
    public sku: string,
    public requested: number,
    public available: number,
  ) {
    super(
      `Insufficient stock for ${sku}. Requested: ${requested}, Available: ${available}`,
      'INSUFFICIENT_STOCK',
    );
    this.name = 'InsufficientStockError';
  }
}

export class SupplierNotActiveError extends SupplierError {
  constructor(supplierName: string) {
    super(`Supplier ${supplierName} is not active`, 'SUPPLIER_NOT_ACTIVE');
    this.name = 'SupplierNotActiveError';
  }
}
