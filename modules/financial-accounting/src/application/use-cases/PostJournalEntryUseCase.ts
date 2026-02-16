import { IJournalEntryRepository } from '../../domain/repositories/IJournalEntryRepository';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { IFiscalPeriodRepository } from '../../domain/repositories/IFiscalPeriodRepository';
import { GeneralLedgerService } from '../../domain/services/GeneralLedgerService';
import { FinancialAccountingError } from '../errors/FinancialAccountingError';
import { JournalEntryResponseDTO } from '../dtos/JournalEntryDTO';

export class PostJournalEntryUseCase {
  private glService: GeneralLedgerService;

  constructor(
    private journalEntryRepository: IJournalEntryRepository,
    private accountRepository: IChartOfAccountRepository,
    private fiscalPeriodRepository: IFiscalPeriodRepository,
  ) {
    this.glService = new GeneralLedgerService(
      journalEntryRepository,
      accountRepository,
      fiscalPeriodRepository,
    );
  }

  async execute(entryId: string, organizationId: string, userId: string): Promise<JournalEntryResponseDTO> {
    const entry = await this.journalEntryRepository.findById(entryId, organizationId);
    if (!entry) {
      throw new FinancialAccountingError('Journal entry not found', 'JOURNAL_ENTRY_NOT_FOUND', 404);
    }

    const posted = await this.glService.postJournalEntry(entry, userId);

    return this.toResponseDTO(posted);
  }

  private toResponseDTO(entry: any): JournalEntryResponseDTO {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      fiscalPeriodId: entry.fiscalPeriodId,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      status: entry.status,
      isPosted: entry.isPosted,
      postedDate: entry.postedDate,
      postedBy: entry.postedBy,
      approvalStatus: entry.approvalStatus,
      approvedBy: entry.approvedBy,
      approvedDate: entry.approvedDate,
      reversalEntryId: entry.reversalEntryId,
      lines: entry.lines,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      createdBy: entry.createdBy,
      updatedBy: entry.updatedBy,
    };
  }
}
