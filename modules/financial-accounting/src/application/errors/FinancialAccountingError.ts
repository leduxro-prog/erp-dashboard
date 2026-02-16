export class FinancialAccountingError extends Error {
  constructor(
    message: string,
    public code: string = 'FINANCIAL_ACCOUNTING_ERROR',
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'FinancialAccountingError';
  }
}

export class JournalEntryNotBalancedError extends FinancialAccountingError {
  constructor(message: string = 'Journal entry is not balanced') {
    super(message, 'JOURNAL_ENTRY_NOT_BALANCED', 400);
    this.name = 'JournalEntryNotBalancedError';
  }
}

export class FiscalPeriodClosedError extends FinancialAccountingError {
  constructor(message: string = 'Cannot perform operation on closed fiscal period') {
    super(message, 'FISCAL_PERIOD_CLOSED', 400);
    this.name = 'FiscalPeriodClosedError';
  }
}

export class FiscalPeriodLockedError extends FinancialAccountingError {
  constructor(message: string = 'Cannot perform operation on locked fiscal period') {
    super(message, 'FISCAL_PERIOD_LOCKED', 400);
    this.name = 'FiscalPeriodLockedError';
  }
}

export class AccountNotFoundError extends FinancialAccountingError {
  constructor(accountId: string) {
    super(`Account ${accountId} not found`, 'ACCOUNT_NOT_FOUND', 404);
    this.name = 'AccountNotFoundError';
  }
}

export class InvoiceNotFoundError extends FinancialAccountingError {
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} not found`, 'INVOICE_NOT_FOUND', 404);
    this.name = 'InvoiceNotFoundError';
  }
}

export class InvalidInvoiceStatusError extends FinancialAccountingError {
  constructor(message: string = 'Invalid invoice status for this operation') {
    super(message, 'INVALID_INVOICE_STATUS', 400);
    this.name = 'InvalidInvoiceStatusError';
  }
}

export class InvalidPaymentAmountError extends FinancialAccountingError {
  constructor(message: string = 'Invalid payment amount') {
    super(message, 'INVALID_PAYMENT_AMOUNT', 400);
    this.name = 'InvalidPaymentAmountError';
  }
}

export class TrialBalanceNotBalancedError extends FinancialAccountingError {
  constructor(message: string = 'Trial balance is not balanced') {
    super(message, 'TRIAL_BALANCE_NOT_BALANCED', 400);
    this.name = 'TrialBalanceNotBalancedError';
  }
}

export class ChartOfAccountsError extends FinancialAccountingError {
  constructor(message: string, code: string = 'CHART_OF_ACCOUNTS_ERROR') {
    super(message, code, 400);
    this.name = 'ChartOfAccountsError';
  }
}

export class DuplicateAccountCodeError extends FinancialAccountingError {
  constructor(code: string) {
    super(`Account code ${code} already exists`, 'DUPLICATE_ACCOUNT_CODE', 409);
    this.name = 'DuplicateAccountCodeError';
  }
}

export class ThreeWayMatchError extends FinancialAccountingError {
  constructor(message: string = 'Three-way match failed') {
    super(message, 'THREE_WAY_MATCH_ERROR', 400);
    this.name = 'ThreeWayMatchError';
  }
}
