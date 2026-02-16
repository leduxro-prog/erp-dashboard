import { JournalEntry } from '../../domain/entities/JournalEntry';
import { IJournalEntryRepository } from '../../domain/repositories/IJournalEntryRepository';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { IFiscalPeriodRepository } from '../../domain/repositories/IFiscalPeriodRepository';
import { CreateJournalEntryDTO, JournalEntryResponseDTO } from '../dtos/JournalEntryDTO';
import { AccountNotFoundError, FinancialAccountingError } from '../errors/FinancialAccountingError';

export class CreateJournalEntryUseCase {
  constructor(
    private journalEntryRepository: IJournalEntryRepository,
    private accountRepository: IChartOfAccountRepository,
    private fiscalPeriodRepository: IFiscalPeriodRepository,
  ) {}

  async execute(input: CreateJournalEntryDTO): Promise<JournalEntryResponseDTO> {
    const fiscalPeriod = await this.fiscalPeriodRepository.findById(input.fiscalPeriodId, input.organizationId);
    if (!fiscalPeriod) {
      throw new FinancialAccountingError('Fiscal period not found', 'FISCAL_PERIOD_NOT_FOUND', 404);
    }

    for (const lineInput of input.lines) {
      const account = await this.accountRepository.findById(lineInput.accountId, input.organizationId);
      if (!account) {
        throw new AccountNotFoundError(lineInput.accountId);
      }
    }

    const entryNumber = await this.journalEntryRepository.getNextEntryNumber(input.organizationId);

    const entry = new JournalEntry({
      organizationId: input.organizationId,
      fiscalPeriodId: input.fiscalPeriodId,
      entryNumber,
      entryDate: input.entryDate,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
      lines: input.lines,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    entry.validate();

    const created = await this.journalEntryRepository.create(entry);

    return this.toResponseDTO(created);
  }

  private toResponseDTO(entry: JournalEntry): JournalEntryResponseDTO {
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
      lines: entry.lines.map(line => ({
        id: line.id,
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        costCenterId: line.costCenterId,
        taxCodeId: line.taxCodeId,
        description: line.description,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        referenceNumber: line.referenceNumber,
        metadata: line.metadata,
      })),
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      createdBy: entry.createdBy,
      updatedBy: entry.updatedBy,
    };
  }
}
