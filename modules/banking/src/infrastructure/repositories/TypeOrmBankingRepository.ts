import { DataSource } from 'typeorm';
import { IBankingRepository } from './IBankingRepository';
import {
  BankAccountEntity,
  BankTransactionEntity,
  StatementImportEntity,
  PaymentMatchEntity,
} from '../entities';
import { BankAccount, StatementImport, BankTransaction, PaymentMatch } from '../../domain/entities';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('banking-repository');

export class TypeOrmBankingRepository implements IBankingRepository {
  constructor(private readonly dataSource: DataSource) {}

  // Bank Accounts
  async getBankAccountById(id: number): Promise<BankAccount | null> {
    const repo = this.dataSource.getRepository(BankAccountEntity);
    const entity = await repo.findOne({ where: { id } });
    return entity ? this.mapBankAccountEntityToDomain(entity) : null;
  }

  async getBankAccountByIban(iban: string): Promise<BankAccount | null> {
    const repo = this.dataSource.getRepository(BankAccountEntity);
    const entity = await repo.findOne({ where: { iban } });
    return entity ? this.mapBankAccountEntityToDomain(entity) : null;
  }

  async listBankAccounts(): Promise<BankAccount[]> {
    const repo = this.dataSource.getRepository(BankAccountEntity);
    const entities = await repo.find();
    return entities.map(e => this.mapBankAccountEntityToDomain(e));
  }

  async createBankAccount(account: BankAccount): Promise<BankAccount> {
    const repo = this.dataSource.getRepository(BankAccountEntity);
    const entity = repo.create({
      name: account.name,
      iban: account.iban,
      bankName: account.bankName,
      currency: account.currency,
    });
    const saved = await repo.save(entity);
    return this.mapBankAccountEntityToDomain(saved);
  }

  // Statement Imports
  async getImportById(id: number): Promise<StatementImport | null> {
    const repo = this.dataSource.getRepository(StatementImportEntity);
    const entity = await repo.findOne({ where: { id } });
    return entity ? this.mapStatementImportEntityToDomain(entity) : null;
  }

  async getImportByHash(fileHash: string): Promise<StatementImport | null> {
    const repo = this.dataSource.getRepository(StatementImportEntity);
    const entity = await repo.findOne({ where: { fileHash } });
    return entity ? this.mapStatementImportEntityToDomain(entity) : null;
  }

  async createImport(importData: StatementImport): Promise<StatementImport> {
    const repo = this.dataSource.getRepository(StatementImportEntity);
    const entity = repo.create();
    entity.bankAccountId = importData.bankAccountId;
    entity.filename = importData.filename;
    entity.fileHash = importData.fileHash;
    entity.status = importData.status as any;
    entity.importedBy = importData.importedBy;
    entity.importDate = importData.importDate;
    entity.periodStart = importData.periodStart;
    entity.periodEnd = importData.periodEnd;
    entity.transactionCount = importData.transactionCount;
    const saved = await repo.save(entity);
    // save returns array when given array, single entity when given single entity
    const savedEntity = Array.isArray(saved) ? saved[0] : saved;
    return this.mapStatementImportEntityToDomain(savedEntity);
  }

  async updateImportStatus(id: number, status: string, transactionCount: number): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(StatementImportEntity)
      .set({ status: status as any, transactionCount })
      .where('id = :id', { id })
      .execute();
  }

  async listImports(filters?: { bankAccountId?: number; status?: string }): Promise<StatementImport[]> {
    const repo = this.dataSource.getRepository(StatementImportEntity);
    let query = repo.createQueryBuilder('imp');
    if (filters?.bankAccountId) {
      query = query.andWhere('imp.bankAccountId = :bankAccountId', { bankAccountId: filters.bankAccountId });
    }
    if (filters?.status) {
      query = query.andWhere('imp.status = :status', { status: filters.status });
    }
    const entities = await query.orderBy('imp.importDate', 'DESC').getMany();
    return entities.map(e => this.mapStatementImportEntityToDomain(e));
  }

  // Transactions
  async getTransactionById(id: number): Promise<BankTransaction | null> {
    const repo = this.dataSource.getRepository(BankTransactionEntity);
    const entity = await repo.findOne({ where: { id } });
    return entity ? this.mapBankTransactionEntityToDomain(entity) : null;
  }

  async createTransaction(transaction: BankTransaction): Promise<BankTransaction> {
    const repo = this.dataSource.getRepository(BankTransactionEntity);
    const entity = repo.create({
      importId: transaction.importId,
      bankAccountId: transaction.bankAccountId,
      date: transaction.date,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      reference: transaction.reference,
      partnerName: transaction.partnerName,
      partnerIban: transaction.partnerIban,
      fingerprint: transaction.fingerprint,
      status: transaction.status,
      rawText: transaction.rawText,
    });
    const saved = await repo.save(entity);
    return this.mapBankTransactionEntityToDomain(saved);
  }

  async createTransactions(transactions: BankTransaction[]): Promise<BankTransaction[]> {
    const repo = this.dataSource.getRepository(BankTransactionEntity);
    const entities = transactions.map((t: any) => ({
      importId: t.importId,
      bankAccountId: t.bankAccountId,
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      reference: t.reference,
      partnerName: t.partnerName,
      partnerIban: t.partnerIban,
      fingerprint: t.fingerprint,
      status: t.status,
      rawText: t.rawText,
    }));
    const saved = await repo.save(entities);
    return saved.map(e => this.mapBankTransactionEntityToDomain(e));
  }

  async listTransactions(filters: {
    importId?: number;
    bankAccountId?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<BankTransaction[]> {
    let query = this.dataSource
      .getRepository(BankTransactionEntity)
      .createQueryBuilder('t');

    if (filters.importId) {
      query = query.andWhere('t.importId = :importId', { importId: filters.importId });
    }
    if (filters.bankAccountId) {
      query = query.andWhere('t.bankAccountId = :bankAccountId', { bankAccountId: filters.bankAccountId });
    }
    if (filters.status) {
      query = query.andWhere('t.status = :status', { status: filters.status });
    }
    if (filters.dateFrom) {
      query = query.andWhere('t.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      query = query.andWhere('t.date <= :dateTo', { dateTo: filters.dateTo });
    }

    const entities = await query.orderBy('t.date', 'DESC').getMany();
    return entities.map(e => this.mapBankTransactionEntityToDomain(e));
  }

  async updateTransactionStatus(id: number, status: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(BankTransactionEntity)
      .set({ status: status as any })
      .where('id = :id', { id })
      .execute();
  }

  // Payment Matches
  async getMatchById(id: number): Promise<PaymentMatch | null> {
    const repo = this.dataSource.getRepository(PaymentMatchEntity);
    const entity = await repo.findOne({ where: { id } });
    return entity ? this.mapPaymentMatchEntityToDomain(entity) : null;
  }

  async createMatch(match: PaymentMatch): Promise<PaymentMatch> {
    const repo = this.dataSource.getRepository(PaymentMatchEntity);
    const entity = repo.create({
      transactionId: match.transactionId,
      matchType: match.matchType,
      matchId: match.matchId,
      amount: match.amount,
      confidence: match.confidence,
      status: match.status,
      matchedBy: match.matchedBy,
      matchedAt: match.matchedAt,
    });
    const saved = await repo.save(entity);
    return this.mapPaymentMatchEntityToDomain(saved);
  }

  async updateMatchStatus(id: number, status: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(PaymentMatchEntity)
      .set({ status: status as any })
      .where('id = :id', { id })
      .execute();
  }

  async listMatches(transactionId: number): Promise<PaymentMatch[]> {
    const repo = this.dataSource.getRepository(PaymentMatchEntity);
    const entities = await repo.find({ where: { transactionId } });
    return entities.map(e => this.mapPaymentMatchEntityToDomain(e));
  }

  // Unmatched transactions for matching
  async getUnmatchedTransactions(bankAccountId: number, fromDate?: Date): Promise<BankTransaction[]> {
    let query = this.dataSource
      .getRepository(BankTransactionEntity)
      .createQueryBuilder('t')
      .where('t.bankAccountId = :bankAccountId', { bankAccountId })
      .andWhere('t.status = :status', { status: 'unmatched' })
      .andWhere('t.amount > 0'); // Only consider incoming payments (credits)

    if (fromDate) {
      query = query.andWhere('t.date >= :fromDate', { fromDate });
    }

    const entities = await query.orderBy('t.date', 'DESC').getMany();
    return entities.map(e => this.mapBankTransactionEntityToDomain(e));
  }

  // Candidates for matching
  async findMatchingInvoices(
    description: string,
    amount: number,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    // Extract invoice number pattern from description (INV-XXX, Invoice XXX, etc.)
    const patterns = [
      /INV[-\s]*(\d+)/i,
      /Factura[-\s]*:?[-\s]*(\d+)/i,
      /Invoice[-\s]*:?[-\s]*(\d+)/i,
    ];

    let possibleInvoiceNumbers: string[] = [];
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        possibleInvoiceNumbers.push(match[1]);
      }
    }

    const results: any[] = [];

    // Try SmartBill invoices first
    try {
      const smartBillResult = await this.dataSource.query(
        `SELECT id, 'smartbill' as source, invoiceNumber, totalWithVat, status
         FROM smartbill_invoices
         WHERE status != 'paid'
         AND ABS(totalWithVat - $1) <= 0.01
         AND created_at >= $2 AND created_at <= $3`,
        [amount, dateFrom, dateTo]
      );
      results.push(...smartBillResult);
    } catch (e) {
      logger.warn('Error querying smartbill_invoices', { error: e instanceof Error ? e.message : String(e) });
    }

    // Try B2B orders
    try {
      const b2bOrderResult = await this.dataSource.query(
        `SELECT id, 'b2b_order' as source, order_number as invoiceNumber, total, status
         FROM b2b_orders
         WHERE payment_status != 'PAID'
         AND ABS(total - $1) <= 0.01
         AND created_at >= $2 AND created_at <= $3`,
        [amount, dateFrom, dateTo]
      );
      results.push(...b2bOrderResult);
    } catch (e) {
      logger.warn('Error querying b2b_orders', { error: e instanceof Error ? e.message : String(e) });
    }

    return results;
  }

  async findMatchingProformas(
    description: string,
    amount: number,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    try {
      return await this.dataSource.query(
        `SELECT id, 'smartbill' as source, proformaNumber, totalWithVat, status
         FROM smartbill_proformas
         WHERE status != 'paid'
         AND ABS(totalWithVat - $1) <= 0.01
         AND created_at >= $2 AND created_at <= $3`,
        [amount, dateFrom, dateTo]
      );
    } catch (e) {
      logger.warn('Error querying smartbill_proformas', { error: e instanceof Error ? e.message : String(e) });
      return [];
    }
  }

  async findMatchingOrders(
    description: string,
    amount: number,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<any[]> {
    // Extract order number pattern
    const patterns = [/B2B[-\s]*(\d+)/i, /Order[-\s]*:?[-\s]*(\d+)/i, /COMANDA[-\s]*(\d+)/i];

    let possibleOrderNumbers: string[] = [];
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        possibleOrderNumbers.push(match[1]);
      }
    }

    try {
      return await this.dataSource.query(
        `SELECT id, 'b2b_order' as source, order_number, total, status
         FROM b2b_orders
         WHERE payment_status != 'PAID'
         AND ABS(total - $1) <= 0.01
         AND created_at >= $2 AND created_at <= $3`,
        [amount, dateFrom, dateTo]
      );
    } catch (e) {
      logger.warn('Error querying b2b_orders', { error: e instanceof Error ? e.message : String(e) });
      return [];
    }
  }

  // Mapping functions
  private mapBankAccountEntityToDomain(entity: BankAccountEntity): BankAccount {
    return new BankAccount(
      entity.id,
      entity.name,
      entity.iban,
      entity.bankName,
      entity.currency,
      entity.createdAt,
    );
  }

  private mapStatementImportEntityToDomain(entity: StatementImportEntity): StatementImport {
    return new StatementImport(
      entity.id,
      entity.bankAccountId,
      entity.filename,
      entity.fileHash,
      entity.status as any,
      entity.importedBy,
      entity.importDate,
      entity.periodStart,
      entity.periodEnd,
      entity.transactionCount,
    );
  }

  private mapBankTransactionEntityToDomain(entity: BankTransactionEntity): BankTransaction {
    return new BankTransaction(
      entity.id,
      entity.importId,
      entity.bankAccountId,
      entity.date,
      entity.amount,
      entity.currency,
      entity.description,
      entity.reference,
      entity.partnerName,
      entity.partnerIban,
      entity.fingerprint,
      entity.status as any,
      entity.createdAt,
      entity.rawText,
    );
  }

  private mapPaymentMatchEntityToDomain(entity: PaymentMatchEntity): PaymentMatch {
    return new PaymentMatch(
      entity.id,
      entity.transactionId,
      entity.matchType,
      entity.matchId,
      entity.amount,
      entity.confidence,
      entity.status as any,
      entity.matchedBy,
      entity.matchedAt,
    );
  }
}
