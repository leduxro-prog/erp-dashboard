export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface JournalEntryLine {
  id?: string;
  lineNumber: number;
  accountId: string;
  costCenterId?: string;
  taxCodeId?: string;
  description?: string;
  debitAmount: number;
  creditAmount: number;
  quantity?: number;
  unitPrice?: number;
  referenceNumber?: string;
  metadata?: Record<string, any>;
}

export class JournalEntry {
  id!: string;
  organizationId!: string;
  fiscalPeriodId!: string;
  entryNumber!: string;
  entryDate!: Date;
  referenceType?: string;
  referenceId?: string;
  description!: string;
  totalDebit!: number;
  totalCredit!: number;
  status!: JournalEntryStatus;
  isPosted!: boolean;
  postedDate?: Date;
  postedBy?: string;
  approvalStatus!: ApprovalStatus;
  approvedBy?: string;
  approvedDate?: Date;
  reversalEntryId?: string;
  lines!: JournalEntryLine[];
  metadata!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: string;
  updatedBy!: string;

  constructor(data: Partial<JournalEntry>) {
    Object.assign(this, data);
    this.status = this.status ?? JournalEntryStatus.DRAFT;
    this.approvalStatus = this.approvalStatus ?? ApprovalStatus.PENDING;
    this.isPosted = this.isPosted ?? false;
    this.totalDebit = this.totalDebit ?? 0;
    this.totalCredit = this.totalCredit ?? 0;
    this.lines = this.lines ?? [];
    this.metadata = this.metadata ?? {};
  }

  validate(): void {
    if (!this.organizationId) throw new Error('Organization ID is required');
    if (!this.fiscalPeriodId) throw new Error('Fiscal period ID is required');
    if (!this.entryNumber) throw new Error('Entry number is required');
    if (!this.entryDate) throw new Error('Entry date is required');
    if (!this.description) throw new Error('Description is required');
    if (!this.lines || this.lines.length === 0) throw new Error('Journal entry must have at least one line');
    if (this.lines.length < 2) throw new Error('Journal entry must have at least two lines');

    let calculatedDebit = 0;
    let calculatedCredit = 0;

    this.lines.forEach((line, index) => {
      if (!line.accountId) throw new Error(`Line ${index + 1}: Account ID is required`);
      if (line.debitAmount < 0) throw new Error(`Line ${index + 1}: Debit amount cannot be negative`);
      if (line.creditAmount < 0) throw new Error(`Line ${index + 1}: Credit amount cannot be negative`);
      if (line.debitAmount > 0 && line.creditAmount > 0) {
        throw new Error(`Line ${index + 1}: A line cannot have both debit and credit amounts`);
      }
      if (line.debitAmount === 0 && line.creditAmount === 0) {
        throw new Error(`Line ${index + 1}: A line must have either debit or credit amount`);
      }

      calculatedDebit += line.debitAmount;
      calculatedCredit += line.creditAmount;
    });

    this.totalDebit = calculatedDebit;
    this.totalCredit = calculatedCredit;

    if (Math.abs(calculatedDebit - calculatedCredit) > 0.01) {
      throw new Error('Journal entry is not balanced. Debits must equal credits.');
    }
  }

  canBePosted(): boolean {
    return (
      this.status === JournalEntryStatus.APPROVED &&
      this.approvalStatus === ApprovalStatus.APPROVED &&
      !this.isPosted
    );
  }

  canBeApproved(): boolean {
    return this.status === JournalEntryStatus.PENDING_APPROVAL && this.approvalStatus === ApprovalStatus.PENDING;
  }

  canBeReversed(): boolean {
    return this.status === JournalEntryStatus.POSTED && !this.reversalEntryId;
  }

  canBeCancelled(): boolean {
    return this.status === JournalEntryStatus.DRAFT || this.status === JournalEntryStatus.PENDING_APPROVAL;
  }

  addLine(line: JournalEntryLine): void {
    line.lineNumber = (this.lines?.length ?? 0) + 1;
    this.lines = this.lines ?? [];
    this.lines.push(line);
  }

  removeLine(lineNumber: number): void {
    this.lines = this.lines?.filter(l => l.lineNumber !== lineNumber) ?? [];
  }

  getDebitLines(): JournalEntryLine[] {
    return this.lines?.filter(l => l.debitAmount > 0) ?? [];
  }

  getCreditLines(): JournalEntryLine[] {
    return this.lines?.filter(l => l.creditAmount > 0) ?? [];
  }

  getLinesByAccount(accountId: string): JournalEntryLine[] {
    return this.lines?.filter(l => l.accountId === accountId) ?? [];
  }

  getNetAmountForAccount(accountId: string): number {
    const lines = this.getLinesByAccount(accountId);
    return lines.reduce((sum, line) => sum + (line.debitAmount - line.creditAmount), 0);
  }
}
