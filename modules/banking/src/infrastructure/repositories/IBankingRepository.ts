import { BankAccount } from '../../domain/entities/BankAccount';
import { StatementImport } from '../../domain/entities/StatementImport';
import { BankTransaction } from '../../domain/entities/BankTransaction';
import { PaymentMatch } from '../../domain/entities/PaymentMatch';

export interface IBankingRepository {
  // Bank Accounts
  getBankAccountById(id: number): Promise<BankAccount | null>;
  getBankAccountByIban(iban: string): Promise<BankAccount | null>;
  listBankAccounts(): Promise<BankAccount[]>;
  createBankAccount(account: BankAccount): Promise<BankAccount>;

  // Statement Imports
  getImportById(id: number): Promise<StatementImport | null>;
  getImportByHash(fileHash: string): Promise<StatementImport | null>;
  createImport(importData: StatementImport): Promise<StatementImport>;
  updateImportStatus(id: number, status: string, transactionCount: number): Promise<void>;
  listImports(filters?: { bankAccountId?: number; status?: string }): Promise<StatementImport[]>;

  // Transactions
  getTransactionById(id: number): Promise<BankTransaction | null>;
  createTransaction(transaction: BankTransaction): Promise<BankTransaction>;
  createTransactions(transactions: BankTransaction[]): Promise<BankTransaction[]>;
  listTransactions(filters: {
    importId?: number;
    bankAccountId?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<BankTransaction[]>;
  updateTransactionStatus(id: number, status: string): Promise<void>;

  // Payment Matches
  getMatchById(id: number): Promise<PaymentMatch | null>;
  createMatch(match: PaymentMatch): Promise<PaymentMatch>;
  updateMatchStatus(id: number, status: string): Promise<void>;
  listMatches(transactionId: number): Promise<PaymentMatch[]>;

  // Unmatched transactions for matching
  getUnmatchedTransactions(bankAccountId: number, fromDate?: Date): Promise<BankTransaction[]>;

  // Candidates for matching
  findMatchingInvoices(description: string, amount: number, dateFrom: Date, dateTo: Date): Promise<any[]>;
  findMatchingProformas(description: string, amount: number, dateFrom: Date, dateTo: Date): Promise<any[]>;
  findMatchingOrders(description: string, amount: number, dateFrom: Date, dateTo: Date): Promise<any[]>;
}
