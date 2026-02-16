import { JournalEntry, JournalEntryStatus, ApprovalStatus } from '../entities/JournalEntry';
import { ChartOfAccount } from '../entities/ChartOfAccount';
import { FiscalPeriod } from '../entities/FiscalPeriod';
import { IJournalEntryRepository } from '../repositories/IJournalEntryRepository';
import { IChartOfAccountRepository } from '../repositories/IChartOfAccountRepository';
import { IFiscalPeriodRepository } from '../repositories/IFiscalPeriodRepository';

export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitBalance: number;
  creditBalance: number;
}

export interface IncomeStatementEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  currentPeriod: number;
  previousPeriod?: number;
  variance?: number;
}

export interface BalanceSheetEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  asOfDate: Date;
  balance: number;
}

export class GeneralLedgerService {
  constructor(
    private journalEntryRepository: IJournalEntryRepository,
    private accountRepository: IChartOfAccountRepository,
    private fiscalPeriodRepository: IFiscalPeriodRepository,
  ) {}

  async postJournalEntry(entry: JournalEntry, userId: string): Promise<JournalEntry> {
    if (!entry.canBePosted()) {
      throw new Error('Journal entry cannot be posted in its current status');
    }

    const fiscalPeriod = await this.fiscalPeriodRepository.findById(
      entry.fiscalPeriodId,
      entry.organizationId,
    );
    if (!fiscalPeriod) {
      throw new Error('Fiscal period not found');
    }

    if (!fiscalPeriod.isOpen) {
      throw new Error('Cannot post to a closed fiscal period');
    }

    if (fiscalPeriod.isLocked) {
      throw new Error('Cannot post to a locked fiscal period');
    }

    for (const line of entry.lines) {
      const account = await this.accountRepository.findById(line.accountId, entry.organizationId);
      if (!account) {
        throw new Error(`Account ${line.accountId} not found`);
      }
    }

    return this.journalEntryRepository.postEntryAndUpdateBalances({
      entryId: entry.id,
      organizationId: entry.organizationId,
      userId,
      postedDate: new Date(),
      lines: entry.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
      })),
    });
  }

  async reverseJournalEntry(
    entry: JournalEntry,
    userId: string,
    reason?: string,
  ): Promise<JournalEntry> {
    if (!entry.canBeReversed()) {
      throw new Error('Journal entry cannot be reversed in its current status');
    }

    const reversalEntry = new JournalEntry({
      organizationId: entry.organizationId,
      fiscalPeriodId: entry.fiscalPeriodId,
      entryNumber: await this.journalEntryRepository.getNextEntryNumber(entry.organizationId),
      entryDate: new Date(),
      description: `Reversal of ${entry.entryNumber}${reason ? `: ${reason}` : ''}`,
      lines: entry.lines.map((line) => ({
        ...line,
        debitAmount: line.creditAmount,
        creditAmount: line.debitAmount,
      })),
      createdBy: userId,
      updatedBy: userId,
    });

    reversalEntry.validate();

    const createdReversal = await this.journalEntryRepository.create(reversalEntry);
    reversalEntry.status = JournalEntryStatus.PENDING_APPROVAL;
    reversalEntry.approvalStatus = ApprovalStatus.PENDING;
    reversalEntry.updatedBy = userId;

    entry.reversalEntryId = createdReversal.id;
    entry.updatedBy = userId;
    entry.status = JournalEntryStatus.REVERSED;

    await this.journalEntryRepository.update(entry);

    return createdReversal;
  }

  async approveJournalEntry(entry: JournalEntry, userId: string): Promise<JournalEntry> {
    if (!entry.canBeApproved()) {
      throw new Error('Journal entry cannot be approved in its current status');
    }

    entry.approvalStatus = ApprovalStatus.APPROVED;
    entry.approvedBy = userId;
    entry.approvedDate = new Date();
    entry.status = JournalEntryStatus.APPROVED;
    entry.updatedBy = userId;

    return this.journalEntryRepository.update(entry);
  }

  async rejectJournalEntry(
    entry: JournalEntry,
    userId: string,
    reason: string,
  ): Promise<JournalEntry> {
    if (entry.status !== JournalEntryStatus.PENDING_APPROVAL) {
      throw new Error('Only pending entries can be rejected');
    }

    entry.approvalStatus = ApprovalStatus.REJECTED;
    entry.approvedBy = userId;
    entry.approvedDate = new Date();
    entry.status = JournalEntryStatus.DRAFT;
    entry.metadata = { ...entry.metadata, rejectionReason: reason };
    entry.updatedBy = userId;

    return this.journalEntryRepository.update(entry);
  }

  async generateTrialBalance(
    organizationId: string,
    fiscalPeriodId: string,
  ): Promise<TrialBalanceEntry[]> {
    const accounts = await this.accountRepository.findAll(organizationId, { isActive: true });
    const entries = await this.journalEntryRepository.findByFiscalPeriod(
      fiscalPeriodId,
      organizationId,
    );

    const trialBalance: Map<string, TrialBalanceEntry> = new Map();

    for (const account of accounts) {
      if (account.isHeader) continue;

      const accountEntries = entries.filter((je) =>
        je.lines.some((line) => line.accountId === account.id),
      );

      let debitTotal = 0;
      let creditTotal = 0;

      for (const entry of accountEntries) {
        const lines = entry.lines.filter((line) => line.accountId === account.id);
        for (const line of lines) {
          debitTotal += line.debitAmount;
          creditTotal += line.creditAmount;
        }
      }

      if (debitTotal > 0 || creditTotal > 0) {
        trialBalance.set(account.id, {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          debitBalance: debitTotal,
          creditBalance: creditTotal,
        });
      }
    }

    const totalDebits = Array.from(trialBalance.values()).reduce(
      (sum, tb) => sum + tb.debitBalance,
      0,
    );
    const totalCredits = Array.from(trialBalance.values()).reduce(
      (sum, tb) => sum + tb.creditBalance,
      0,
    );

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Trial balance is not balanced');
    }

    return Array.from(trialBalance.values());
  }

  async generateIncomeStatement(
    organizationId: string,
    fromDate: Date,
    toDate: Date,
    comparisionFromDate?: Date,
    comparisionToDate?: Date,
  ): Promise<IncomeStatementEntry[]> {
    const accounts = await this.accountRepository.findAll(organizationId);
    const currentEntries = await this.journalEntryRepository.findByDateRange(
      fromDate,
      toDate,
      organizationId,
    );

    let comparisonEntries: JournalEntry[] = [];
    if (comparisionFromDate && comparisionToDate) {
      comparisonEntries = await this.journalEntryRepository.findByDateRange(
        comparisionFromDate,
        comparisionToDate,
        organizationId,
      );
    }

    const incomeStatement: IncomeStatementEntry[] = [];

    const incomeStatementAccounts = accounts.filter((a) =>
      ['REVENUE', 'EXPENSE'].includes(a.accountType),
    );

    for (const account of incomeStatementAccounts) {
      if (account.isHeader) continue;

      let currentAmount = 0;
      let comparisonAmount = 0;

      const currentLines = currentEntries.flatMap((je) =>
        je.lines.filter((l) => l.accountId === account.id),
      );
      for (const line of currentLines) {
        if (account.isRevenueAccount()) {
          currentAmount += line.creditAmount - line.debitAmount;
        } else {
          currentAmount += line.debitAmount - line.creditAmount;
        }
      }

      if (comparisonEntries.length > 0) {
        const comparisonLines = comparisonEntries.flatMap((je) =>
          je.lines.filter((l) => l.accountId === account.id),
        );
        for (const line of comparisonLines) {
          if (account.isRevenueAccount()) {
            comparisonAmount += line.creditAmount - line.debitAmount;
          } else {
            comparisonAmount += line.debitAmount - line.creditAmount;
          }
        }
      }

      incomeStatement.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        currentPeriod: currentAmount,
        previousPeriod: comparisonEntries.length > 0 ? comparisonAmount : undefined,
        variance: comparisonEntries.length > 0 ? currentAmount - comparisonAmount : undefined,
      });
    }

    return incomeStatement;
  }

  async generateBalanceSheet(
    organizationId: string,
    asOfDate: Date,
  ): Promise<{
    assets: BalanceSheetEntry[];
    liabilities: BalanceSheetEntry[];
    equity: BalanceSheetEntry[];
  }> {
    const accounts = await this.accountRepository.findAll(organizationId);
    const entries = await this.journalEntryRepository.findByDateRange(
      new Date(0),
      asOfDate,
      organizationId,
    );

    const assets: BalanceSheetEntry[] = [];
    const liabilities: BalanceSheetEntry[] = [];
    const equity: BalanceSheetEntry[] = [];

    const balanceSheetAccounts = accounts.filter((a) =>
      ['ASSET', 'LIABILITY', 'EQUITY', 'CONTRA_ASSET', 'CONTRA_LIABILITY'].includes(a.accountType),
    );

    for (const account of balanceSheetAccounts) {
      if (account.isHeader) continue;

      let balance = 0;
      const accountLines = entries.flatMap((je) =>
        je.lines.filter((l) => l.accountId === account.id),
      );
      for (const line of accountLines) {
        if (account.getNormalBalance() === 'DEBIT') {
          balance += line.debitAmount - line.creditAmount;
        } else {
          balance += line.creditAmount - line.debitAmount;
        }
      }

      const entry: BalanceSheetEntry = {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        asOfDate,
        balance,
      };

      if (account.isAssetAccount()) {
        assets.push(entry);
      } else if (account.isLiabilityAccount()) {
        liabilities.push(entry);
      } else if (account.isEquityAccount()) {
        equity.push(entry);
      }
    }

    return { assets, liabilities, equity };
  }
}
