import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@shared/utils/response';
import { getAuditLogger } from '@shared/utils/audit-logger';
import { createModuleLogger } from '@shared/utils/logger';
import { TypeOrmBankingRepository } from '../../infrastructure/repositories/TypeOrmBankingRepository';
import { MatchingService } from '../../application/services/MatchingService';
import { ParserFactory } from '../../services/ParserFactory';
import { StatementImport, BankTransaction, PaymentMatch, BankAccount } from '../../domain/entities';

const logger = createModuleLogger('banking-controller');

export interface StatementImportRequest {
  bank: 'ING' | 'BT';
  bank_account_id: number;
  from?: string;
  to?: string;
}

export interface TransactionsFilters {
  import_id?: number;
  bank_account_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export class BankingController {
  private readonly repository: TypeOrmBankingRepository;
  private readonly matchingService: MatchingService;

  constructor(private readonly dataSource: DataSource) {
    this.repository = new TypeOrmBankingRepository(dataSource);
    this.matchingService = new MatchingService(this.repository);
  }

  /**
   * POST /api/v1/banking/statements/import
   * Upload and parse a bank statement PDF
   */
  async importStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json(errorResponse('MISSING_FILE', 'No file uploaded', 400));
        return;
      }

      const { bank, bank_account_id, from, to } = req.body;

      if (!bank || !['ING', 'BT'].includes(bank.toUpperCase())) {
        res.status(400).json(errorResponse('INVALID_BANK', 'Bank must be ING or BT', 400));
        return;
      }

      if (!bank_account_id) {
        res.status(400).json(errorResponse('MISSING_ACCOUNT', 'Bank account ID is required', 400));
        return;
      }

      // Verify bank account exists
      const bankAccount = await this.repository.getBankAccountById(parseInt(bank_account_id));
      if (!bankAccount) {
        res.status(404).json(errorResponse('ACCOUNT_NOT_FOUND', 'Bank account not found', 404));
        return;
      }

      // Extract text from PDF (simplified - using the buffer directly for now)
      // In production, you'd use a PDF library like pdf-parse
      const rawText = file.buffer.toString('utf-8');

      // Check for duplicate import
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const existingImport = await this.repository.getImportByHash(fileHash);
      if (existingImport) {
        res.status(409).json(errorResponse('DUPLICATE_IMPORT', 'This statement has already been imported', 409));
        return;
      }

      // Get appropriate parser
      const parser = ParserFactory.getParserByBank(bank);
      if (!parser) {
        res.status(400).json(errorResponse('UNSUPPORTED_BANK', `Bank ${bank} is not supported`, 400));
        return;
      }

      // Parse the statement
      const parseResult = parser.parseText(rawText, parseInt(bank_account_id));

      if (parseResult.errors.length > 0) {
        logger.warn('Statement parsing completed with errors', { errors: parseResult.errors });
      }

      // Create import record
      const importData = new StatementImport(
        undefined,
        parseInt(bank_account_id),
        file.originalname,
        fileHash,
        'processed',
        (req as any).user?.id?.toString() || null,
        new Date(),
        from ? new Date(from) : null,
        to ? new Date(to) : null,
        parseResult.transactions.length,
      );

      const savedImport = await this.repository.createImport(importData);

      // Create transactions with fingerprints
      const transactions = parseResult.transactions.map((t: any) => {
        const fingerprint = this.createTransactionFingerprint(t);
        return new BankTransaction(
          undefined,
          savedImport.id!,
          parseInt(bank_account_id),
          t.date,
          t.amount,
          t.currency,
          t.description,
          t.reference,
          t.partnerName,
          t.partnerIban,
          fingerprint,
          'unmatched',
          new Date(),
          t.rawText,
        );
      });

      const savedTransactions = await this.repository.createTransactions(transactions);

      // Log audit event
      const auditLogger = getAuditLogger();
      try {
        await auditLogger.logEvent({
          id: `${Date.now()}-import-${savedImport.id}`,
          timestamp: new Date(),
          requestId: (req as any).requestId || 'no-request-id',
          userId: typeof (req as any).user?.id === 'string' ? undefined : (req as any).user?.id,
          action: 'CREATE',
          resource: 'BankStatementImport',
          resourceId: String(savedImport.id),
          changes: {
            after: {
              bankAccountId: parseInt(bank_account_id),
              transactionsCount: savedTransactions.length,
              errors: parseResult.errors,
            },
          },
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
        });
      } catch (auditError) {
        logger.warn('Failed to log audit event', { error: auditError instanceof Error ? auditError.message : String(auditError) });
      }

      res.json(successResponse({
        importId: savedImport.id,
        filename: file.originalname,
        bank,
        bankAccountId: parseInt(bank_account_id),
        transactionsProcessed: savedTransactions.length,
        periodStart: parseResult.accountInfo?.periodStart,
        periodEnd: parseResult.accountInfo?.periodEnd,
        parseErrors: parseResult.errors,
      }));
    } catch (error) {
      logger.error('Error importing bank statement', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }

  /**
   * GET /api/v1/banking/transactions
   * List bank transactions with filters
   */
  async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: any = {};

      if (req.query.import_id) filters.importId = parseInt(req.query.import_id as string);
      if (req.query.bank_account_id) filters.bankAccountId = parseInt(req.query.bank_account_id as string);
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.date_from) filters.dateFrom = new Date(req.query.date_from as string);
      if (req.query.date_to) filters.dateTo = new Date(req.query.date_to as string);

      const transactions = await this.repository.listTransactions(filters);

      res.json(successResponse({
        items: transactions.map(t => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          currency: t.currency,
          description: t.description,
          reference: t.reference,
          partnerName: t.partnerName,
          partnerIban: t.partnerIban,
          status: t.status,
          isCredit: t.isCredit(),
          isDebit: t.isDebit(),
        })),
        total: transactions.length,
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/banking/matches/suggest
   * Suggest matches for unmatched transactions
   */
  async suggestMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bank_account_id, transaction_id, limit = 20 } = req.body;

      let transactions: BankTransaction[];

      if (transaction_id) {
        const transaction = await this.repository.getTransactionById(parseInt(transaction_id));
        if (!transaction) {
          res.status(404).json(errorResponse('TRANSACTION_NOT_FOUND', 'Transaction not found', 404));
          return;
        }
        transactions = [transaction];
      } else if (bank_account_id) {
        transactions = await this.repository.getUnmatchedTransactions(parseInt(bank_account_id));
      } else {
        res.status(400).json(errorResponse('MISSING_PARAMETER', 'Either bank_account_id or transaction_id is required', 400));
        return;
      }

      const suggestions: any[] = [];

      for (const transaction of transactions.slice(0, limit)) {
        const matches = await this.matchingService.suggestMatches(transaction);
        if (matches.length > 0) {
          suggestions.push({
            transactionId: transaction.id,
            date: transaction.date,
            amount: transaction.amount,
            description: transaction.description,
            matches: matches,
          });
        }
      }

      res.json(successResponse({
        transactions: suggestions.length,
        suggestions,
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/banking/matches/:matchId/confirm
   * Confirm a suggested match
   */
  async confirmMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchIdParam = req.params.matchId;
      const matchId = matchIdParam ? parseInt(matchIdParam) : 0;
      const { transaction_id, match_type, match_id, amount } = req.body;

      // Get existing match or create new one
      let match: PaymentMatch | null = null;

      if (matchId > 0) {
        match = await this.repository.getMatchById(matchId);
      }

      if (!match) {
        // Create new match
        match = new PaymentMatch(
          undefined,
          parseInt(transaction_id),
          match_type,
          parseInt(match_id),
          parseFloat(amount),
          100, // Manually confirmed = 100% confidence
          'confirmed',
          (req as any).user?.id?.toString() || 'user',
          new Date(),
        );
        match = await this.repository.createMatch(match);
      } else {
        // Update existing match status is readonly in domain model, we update in DB directly
        await this.repository.updateMatchStatus(matchId, 'confirmed');
      }

      // Update transaction status
      if (match.transactionId) {
        await this.repository.updateTransactionStatus(match.transactionId, 'matched');
      }

      // Log audit event
      const auditLogger = getAuditLogger();
      try {
        await auditLogger.logEvent({
          id: `${Date.now()}-match-confirm-${matchId}`,
          timestamp: new Date(),
          requestId: (req as any).requestId || 'no-request-id',
          userId: typeof (req as any).user?.id === 'string' ? undefined : (req as any).user?.id,
          action: 'UPDATE',
          resource: 'PaymentMatch',
          resourceId: String(matchId),
          changes: {
            after: {
              status: 'confirmed',
              matchType: match.matchType,
              matchId: match.matchId,
              amount: match.amount,
            },
          },
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
        });
      } catch (auditError) {
        logger.warn('Failed to log audit event', { error: auditError instanceof Error ? auditError.message : String(auditError) });
      }

      res.json(successResponse({
        matchId: match.id,
        message: 'Match confirmed successfully',
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/banking/matches/:matchId/reject
   * Reject a suggested match
   */
  async rejectMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchIdParam = req.params.matchId;
      const matchId = matchIdParam ? parseInt(matchIdParam) : 0;

      const match = await this.repository.getMatchById(matchId);
      if (!match) {
        res.status(404).json(errorResponse('MATCH_NOT_FOUND', 'Match not found', 404));
        return;
      }

      const previousStatus = match.status;
      await this.repository.updateMatchStatus(matchId, 'rejected');

      // Log audit event
      const auditLogger = getAuditLogger();
      try {
        await auditLogger.logEvent({
          id: `${Date.now()}-match-reject-${matchId}`,
          timestamp: new Date(),
          requestId: (req as any).requestId || 'no-request-id',
          userId: typeof (req as any).user?.id === 'string' ? undefined : (req as any).user?.id,
          action: 'UPDATE',
          resource: 'PaymentMatch',
          resourceId: String(matchId),
          changes: {
            before: {
              status: previousStatus,
            },
            after: {
              status: 'rejected',
            },
          },
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
        });
      } catch (auditError) {
        logger.warn('Failed to log audit event', { error: auditError instanceof Error ? auditError.message : String(auditError) });
      }

      res.json(successResponse({
        matchId,
        message: 'Match rejected successfully',
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/banking/accounts
   * List all bank accounts
   */
  async listAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await this.repository.listBankAccounts();

      res.json(successResponse({
        items: accounts.map(a => ({
          id: a.id,
          name: a.name,
          iban: a.iban,
          bankName: a.bankName,
          currency: a.currency,
        })),
        total: accounts.length,
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/banking/accounts
   * Create a new bank account
   */
  async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, iban, bankName, currency } = req.body;

      if (!name || !iban || !bankName) {
        res.status(400).json(errorResponse('MISSING_FIELDS', 'name, iban, and bankName are required', 400));
        return;
      }

      const account = new BankAccount(
        undefined,
        name,
        iban,
        bankName,
        currency || 'RON',
      );

      const saved = await this.repository.createBankAccount(account);

      res.status(201).json(successResponse({
        id: saved.id,
        name: saved.name,
        iban: saved.iban,
        bankName: saved.bankName,
        currency: saved.currency,
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a fingerprint for deduplication
   */
  private createTransactionFingerprint(transaction: any): string {
    const data = [
      transaction.date?.toISOString?.() || '',
      transaction.amount?.toFixed?.(2) || '0',
      transaction.currency || '',
      (transaction.description || '').substring(0, 100),
      transaction.reference || '',
      transaction.partnerIban || '',
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
