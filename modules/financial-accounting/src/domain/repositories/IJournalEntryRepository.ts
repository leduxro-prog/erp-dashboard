import { JournalEntry, JournalEntryStatus, ApprovalStatus } from '../entities/JournalEntry';

export interface IJournalEntryRepository {
  create(entry: JournalEntry): Promise<JournalEntry>;
  update(entry: JournalEntry): Promise<JournalEntry>;
  postEntryAndUpdateBalances(params: {
    entryId: string;
    organizationId: string;
    userId: string;
    postedDate: Date;
    lines: Array<{ accountId: string; debitAmount: number; creditAmount: number }>;
  }): Promise<JournalEntry>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<JournalEntry | null>;
  findByNumber(entryNumber: string, organizationId: string): Promise<JournalEntry | null>;
  findByFiscalPeriod(fiscalPeriodId: string, organizationId: string): Promise<JournalEntry[]>;
  findByStatus(status: JournalEntryStatus, organizationId: string): Promise<JournalEntry[]>;
  findByApprovalStatus(
    approvalStatus: ApprovalStatus,
    organizationId: string,
  ): Promise<JournalEntry[]>;
  findByAccount(accountId: string, organizationId: string): Promise<JournalEntry[]>;
  findByDateRange(startDate: Date, endDate: Date, organizationId: string): Promise<JournalEntry[]>;
  findPosted(organizationId: string): Promise<JournalEntry[]>;
  findByReference(
    referenceType: string,
    referenceId: string,
    organizationId: string,
  ): Promise<JournalEntry | null>;
  getNextEntryNumber(organizationId: string): Promise<string>;
}
