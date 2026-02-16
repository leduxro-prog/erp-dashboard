/**
 * Banking Module
 * Handles bank statement imports, transaction parsing, and payment reconciliation
 */

import { BankingModuleLoader } from './infrastructure/ModuleLoader';

export * from './domain/entities/BankAccount';
export * from './domain/entities/BankTransaction';
export * from './domain/entities/StatementImport';
export * from './domain/entities/PaymentMatch';

// Default export for ModuleLoader (instance)
export default new BankingModuleLoader();
