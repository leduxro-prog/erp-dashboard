import { ChartOfAccount, AccountType } from '../../domain/entities/ChartOfAccount';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { CreateChartOfAccountDTO, ChartOfAccountResponseDTO } from '../dtos/ChartOfAccountDTO';
import { DuplicateAccountCodeError } from '../errors/FinancialAccountingError';

export class CreateChartOfAccountUseCase {
  constructor(private accountRepository: IChartOfAccountRepository) {}

  async execute(input: CreateChartOfAccountDTO): Promise<ChartOfAccountResponseDTO> {
    const existingAccount = await this.accountRepository.findByCode(input.code, input.organizationId);
    if (existingAccount) {
      throw new DuplicateAccountCodeError(input.code);
    }

    const account = new ChartOfAccount({
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      description: input.description,
      accountType: input.accountType as AccountType,
      parentAccountId: input.parentAccountId,
      isHeader: input.isHeader ?? false,
      costCenterCode: input.costCenterCode,
      taxApplicable: input.taxApplicable ?? false,
      accumulatedDepreciation: input.accumulatedDepreciation ?? false,
      isActive: true,
      balance: 0,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    account.validate();

    const created = await this.accountRepository.create(account);

    return this.toResponseDTO(created);
  }

  private toResponseDTO(account: ChartOfAccount): ChartOfAccountResponseDTO {
    return {
      id: account.id,
      organizationId: account.organizationId,
      code: account.code,
      name: account.name,
      description: account.description,
      accountType: account.accountType,
      parentAccountId: account.parentAccountId,
      isHeader: account.isHeader,
      isActive: account.isActive,
      costCenterCode: account.costCenterCode,
      taxApplicable: account.taxApplicable,
      accumulatedDepreciation: account.accumulatedDepreciation,
      balance: account.balance,
      metadata: account.metadata,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      createdBy: account.createdBy,
      updatedBy: account.updatedBy,
    };
  }
}
