import { ApInvoice } from '../../domain/entities/ApInvoice';
import { IApInvoiceRepository } from '../../domain/repositories/IApInvoiceRepository';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { CreateApInvoiceDTO, ApInvoiceResponseDTO } from '../dtos/ApInvoiceDTO';
import { AccountNotFoundError, FinancialAccountingError } from '../errors/FinancialAccountingError';

export class CreateApInvoiceUseCase {
  constructor(
    private apInvoiceRepository: IApInvoiceRepository,
    private accountRepository: IChartOfAccountRepository,
  ) {}

  async execute(input: CreateApInvoiceDTO): Promise<ApInvoiceResponseDTO> {
    const apAccount = await this.accountRepository.findById(input.apAccountId, input.organizationId);
    if (!apAccount) {
      throw new AccountNotFoundError(input.apAccountId);
    }

    const expenseAccount = await this.accountRepository.findById(input.expenseAccountId, input.organizationId);
    if (!expenseAccount) {
      throw new AccountNotFoundError(input.expenseAccountId);
    }

    for (const lineInput of input.lines) {
      const lineAccount = await this.accountRepository.findById(lineInput.expenseAccountId, input.organizationId);
      if (!lineAccount) {
        throw new AccountNotFoundError(lineInput.expenseAccountId);
      }
    }

    const invoiceNumber = await this.apInvoiceRepository.getNextInvoiceNumber(input.organizationId);

    const invoice = new ApInvoice({
      organizationId: input.organizationId,
      vendorId: input.vendorId,
      invoiceNumber,
      poNumber: input.poNumber,
      grnNumber: input.grnNumber,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      currencyCode: input.currencyCode ?? 'USD',
      discountPercent: input.discountPercent,
      taxCodeId: input.taxCodeId,
      notes: input.notes,
      paymentTerms: input.paymentTerms,
      apAccountId: input.apAccountId,
      expenseAccountId: input.expenseAccountId,
      lines: input.lines,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    invoice.validate();

    const created = await this.apInvoiceRepository.create(invoice);

    return this.toResponseDTO(created);
  }

  private toResponseDTO(invoice: ApInvoice): ApInvoiceResponseDTO {
    return {
      id: invoice.id,
      organizationId: invoice.organizationId,
      vendorId: invoice.vendorId,
      invoiceNumber: invoice.invoiceNumber,
      poNumber: invoice.poNumber,
      grnNumber: invoice.grnNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currencyCode: invoice.currencyCode,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      status: invoice.status,
      paymentTerms: invoice.paymentTerms,
      discountPercent: invoice.discountPercent,
      taxCodeId: invoice.taxCodeId,
      notes: invoice.notes,
      apAccountId: invoice.apAccountId,
      expenseAccountId: invoice.expenseAccountId,
      journalEntryId: invoice.journalEntryId,
      threeWayMatchStatus: invoice.threeWayMatchStatus,
      matchVariancePercent: invoice.matchVariancePercent,
      isPosted: invoice.isPosted,
      lines: invoice.lines.map(line => ({
        id: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        taxAmount: line.taxAmount,
        expenseAccountId: line.expenseAccountId,
        taxCodeId: line.taxCodeId,
        costCenterId: line.costCenterId,
        poLineId: line.poLineId,
        grnLineId: line.grnLineId,
        metadata: line.metadata,
      })),
      metadata: invoice.metadata,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy,
    };
  }
}
