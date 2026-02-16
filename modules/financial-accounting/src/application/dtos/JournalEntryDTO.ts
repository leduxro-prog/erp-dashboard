export interface CreateJournalEntryLineDTO {
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

export interface CreateJournalEntryDTO {
  organizationId: string;
  fiscalPeriodId: string;
  entryDate: Date;
  referenceType?: string;
  referenceId?: string;
  description: string;
  lines: CreateJournalEntryLineDTO[];
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface UpdateJournalEntryDTO {
  entryDate?: Date;
  description?: string;
  lines?: CreateJournalEntryLineDTO[];
  metadata?: Record<string, any>;
  updatedBy: string;
}

export interface JournalEntryLineResponseDTO {
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

export interface JournalEntryResponseDTO {
  id: string;
  organizationId: string;
  fiscalPeriodId: string;
  entryNumber: string;
  entryDate: Date;
  referenceType?: string;
  referenceId?: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
  isPosted: boolean;
  postedDate?: Date;
  postedBy?: string;
  approvalStatus: string;
  approvedBy?: string;
  approvedDate?: Date;
  reversalEntryId?: string;
  lines: JournalEntryLineResponseDTO[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
