export class QuoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Quote with id ${id} not found`);
    this.name = 'QuoteNotFoundError';
  }
}

export class QuoteInvalidStatusTransitionError extends Error {
  constructor(currentStatus: string, targetStatus: string) {
    super(`Cannot transition from ${currentStatus} to ${targetStatus}`);
    this.name = 'QuoteInvalidStatusTransitionError';
  }
}

export class QuoteExpiredError extends Error {
  constructor(quoteNumber: string) {
    super(`Quote ${quoteNumber} has expired`);
    this.name = 'QuoteExpiredError';
  }
}

export class QuoteAlreadyProcessedError extends Error {
  constructor(status: string) {
    super(`Quote is already in ${status} state`);
    this.name = 'QuoteAlreadyProcessedError';
  }
}

export class InvalidQuoteItemsError extends Error {
  constructor(message: string = 'Quote must have at least one item') {
    super(message);
    this.name = 'InvalidQuoteItemsError';
  }
}

export class QuotePdfGenerationError extends Error {
  constructor(message: string = 'Failed to generate quote PDF') {
    super(message);
    this.name = 'QuotePdfGenerationError';
  }
}
