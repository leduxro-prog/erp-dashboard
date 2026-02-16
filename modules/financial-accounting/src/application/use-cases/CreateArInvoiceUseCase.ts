import { ArInvoice } from '../../domain/entities/ArInvoice';
import { IArInvoiceRepository } from '../../domain/repositories/IArInvoiceRepository';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { CreateArInvoiceDTO, ArInvoiceResponseDTO } from '../dtos/ArInvoiceDTO';
import { AccountNotFoundError, FinancialAccountingError } from '../errors/FinancialAccountingError';

export class CreateArInvoiceUseCase {
  constructor(
    private arInvoiceRepository: IArInvoiceRepository,
    private accountRepository: IChartOfAccountRepository,
  ) {}

  async execute(input: CreateArInvoiceDTO): Promise<ArInvoiceResponseDTO> {
    const arAccount = await this.accountRepository.findById(input.arAccountId, input.organizationId);
    if (!arAccount) {
      throw new AccountNotFoundError(input.arAccountId);
    }

    const revenueAccount = await this.accountRepository.findById(input.revenueAccountId, input.organizationId);
    if (!revenueAccount) {
      throw new AccountNotFoundError(input.revenueAccountId);
    }

    for (const lineInput of input.lines) {
      const lineAccount = await this.accountRepository.findById(lineInput.revenueAccountId, input.organizationId);
      if (!lineAccount) {
        throw new AccountNotFoundError(lineInput.revenueAccountId);
      }
    }

    const invoiceNumber = await this.arInvoiceRepository.getNextInvoiceNumber(input.organizationId);

    const invoice = new ArInvoice({
      organizationId: input.organizationId,
      customerId: input.customerId,
      invoiceNumber,
      orderId: input.orderId,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      currencyCode: input.currencyCode ?? 'USD',
      discountPercent: input.discountPercent,
      taxCodeId: input.taxCodeId,
      notes: input.notes,
      paymentTerms: input.paymentTerms,
      arAccountId: input.arAccountId,
      revenueAccountId: input.revenueAccountId,
      lines: input.lines,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    invoice.validate();

    const created = await this.arInvoiceRepository.create(invoice);

    return this.toResponseDTO(created);
  }

  private toResponseDTO(invoice: ArInvoice): ArInvoiceResponseDTO {
    return {
      id: invoice.id,
      organizationId: invoice.organizationId,
      customerId: invoice.customerId,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
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
      arAccountId: invoice.arAccountId,
      revenueAccountId: invoice.revenueAccountId,
      journalEntryId: invoice.journalEntryId,
      isPosted: invoice.isPosted,
      lines: invoice.lines.map(line => ({
        id: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        taxAmount: line.taxAmount,
        revenueAccountId: line.revenueAccountId,
        taxCodeId: line.taxCodeId,
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
