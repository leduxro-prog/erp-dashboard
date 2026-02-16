import { IJournalEntryRepository } from '../../domain/repositories/IJournalEntryRepository';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { IFiscalPeriodRepository } from '../../domain/repositories/IFiscalPeriodRepository';
import { GeneralLedgerService, TrialBalanceEntry } from '../../domain/services/GeneralLedgerService';
import { FinancialAccountingError } from '../errors/FinancialAccountingError';

export class GenerateTrialBalanceUseCase {
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

  async execute(
    organizationId: string,
    fiscalPeriodId: string,
  ): Promise<{
    trialBalance: TrialBalanceEntry[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    const fiscalPeriod = await this.fiscalPeriodRepository.findById(fiscalPeriodId, organizationId);
    if (!fiscalPeriod) {
      throw new FinancialAccountingError('Fiscal period not found', 'FISCAL_PERIOD_NOT_FOUND', 404);
    }

    const trialBalance = await this.glService.generateTrialBalance(organizationId, fiscalPeriodId);

    const totalDebits = trialBalance.reduce((sum, tb) => sum + tb.debitBalance, 0);
    const totalCredits = trialBalance.reduce((sum, tb) => sum + tb.creditBalance, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return {
      trialBalance,
      totalDebits,
      totalCredits,
      isBalanced,
    };
  }
}
