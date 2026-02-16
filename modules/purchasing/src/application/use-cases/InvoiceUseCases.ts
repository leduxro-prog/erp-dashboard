import {
  CreateInvoiceDTO,
  VendorInvoiceResponseDTO,
  PaginatedInvoiceResponseDTO,
  DisputeInvoiceDTO,
  ResolveDisputeDTO,
  RecordPaymentDTO,
} from '../dtos/InvoiceDTOs';
import {
  VendorInvoice,
  InvoiceLine,
  InvoiceStatus,
  DisputeStatus,
} from '../../domain/entities/VendorInvoice';
import { InvoiceService } from '../../domain/services/InvoiceService';
import { IInvoiceRepository } from '../../domain/repositories/IInvoiceRepository';
import { InvoiceMapper } from '../../infrastructure/mappers/InvoiceMapper';

export class InvoiceUseCases {
  constructor(
    private invoiceService: InvoiceService,
    private invoiceRepository: IInvoiceRepository
  ) {}

  async registerInvoice(dto: CreateInvoiceDTO): Promise<VendorInvoiceResponseDTO> {
    const invoice = new VendorInvoice({
      invoiceNumber: this.invoiceService.generateInvoiceNumber(),
      invoiceDate: dto.invoiceDate,
      vendorId: dto.vendorId,
      vendorName: dto.vendorName,
      vendorInvoiceNumber: dto.vendorInvoiceNumber,
      vendorInvoiceDate: dto.vendorInvoiceDate,
      poId: dto.poId,
      poNumber: '',
      receivedDate: dto.receivedDate,
      dueDate: dto.dueDate,
      paymentTermsId: dto.paymentTermsId,
      paymentTerms: dto.paymentTerms,
      status: InvoiceStatus.DRAFT,
      currency: dto.currency,
      subtotalAmount: dto.subtotalAmount,
      taxAmount: dto.taxAmount,
      shippingAmount: dto.shippingAmount,
      otherCharges: dto.otherCharges,
      discountAmount: dto.discountAmount,
      totalInvoicedAmount:
        dto.subtotalAmount +
        dto.taxAmount +
        dto.shippingAmount +
        dto.otherCharges -
        dto.discountAmount,
      totalMatchedAmount: 0,
      remainingAmount: 0,
      notes: dto.notes,
      internalNotes: dto.internalNotes,
      registeredBy: dto.registeredBy,
      attachments: dto.attachments,
      paidAmount: 0,
      dispatchStatus: DisputeStatus.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
      matchReferences: [],
    });

    const created = await this.invoiceService.registerInvoice(invoice);

    // Add lines
    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i];
      const line = new InvoiceLine({
        invoiceId: created.id,
        lineNumber: i + 1,
        poLineId: lineDto.poLineId,
        description: lineDto.description,
        quantity: lineDto.quantity,
        unit: lineDto.unit,
        unitPrice: lineDto.unitPrice,
        totalAmount: lineDto.quantity * lineDto.unitPrice,
        taxRate: lineDto.taxRate,
        taxAmount: (lineDto.quantity * lineDto.unitPrice * lineDto.taxRate) / 100,
        matchStatus: 'unmatched',
        matchedQuantity: 0,
        matchedAmount: 0,
        notes: lineDto.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.invoiceRepository.addLine(created.id, line);
    }

    return InvoiceMapper.toDTO(created);
  }

  async disputeInvoice(dto: DisputeInvoiceDTO): Promise<VendorInvoiceResponseDTO> {
    await this.invoiceService.disputeInvoice(dto.invoiceId, dto.reason);
    const invoice = await this.invoiceRepository.findById(dto.invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    return InvoiceMapper.toDTO(invoice);
  }

  async resolveDispute(dto: ResolveDisputeDTO): Promise<VendorInvoiceResponseDTO> {
    await this.invoiceService.resolveDispute(dto.invoiceId, dto.resolution);
    const invoice = await this.invoiceRepository.findById(dto.invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    return InvoiceMapper.toDTO(invoice);
  }

  async approveForPayment(invoiceId: string): Promise<VendorInvoiceResponseDTO> {
    await this.invoiceService.approveForPayment(invoiceId);
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    return InvoiceMapper.toDTO(invoice);
  }

  async recordPayment(dto: RecordPaymentDTO): Promise<VendorInvoiceResponseDTO> {
    await this.invoiceService.recordPayment(dto.invoiceId, dto.paidAmount, dto.paymentDate);
    const invoice = await this.invoiceRepository.findById(dto.invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    return InvoiceMapper.toDTO(invoice);
  }

  async cancelInvoice(invoiceId: string): Promise<void> {
    await this.invoiceService.cancelInvoice(invoiceId);
  }

  async getInvoice(invoiceId: string): Promise<VendorInvoiceResponseDTO> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    return InvoiceMapper.toDTO(invoice);
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<VendorInvoiceResponseDTO> {
    const invoice = await this.invoiceRepository.findByNumber(invoiceNumber);
    if (!invoice) throw new Error('Invoice not found');
    return InvoiceMapper.toDTO(invoice);
  }

  async listByVendor(
    vendorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedInvoiceResponseDTO> {
    const result = await this.invoiceRepository.findByVendor(vendorId, {
      page,
      limit,
      sortBy: 'invoiceDate',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((inv) => InvoiceMapper.toDTO(inv)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async listByStatus(
    status: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedInvoiceResponseDTO> {
    const result = await this.invoiceRepository.findByStatus(status as any, {
      page,
      limit,
      sortBy: 'invoiceDate',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((inv) => InvoiceMapper.toDTO(inv)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async listOverdue(page: number = 1, limit: number = 20): Promise<PaginatedInvoiceResponseDTO> {
    const overdue = await this.invoiceRepository.findOverdue();
    const paged = overdue.slice((page - 1) * limit, page * limit);

    return {
      data: paged.map((inv) => InvoiceMapper.toDTO(inv)),
      total: overdue.length,
      page,
      limit,
      hasMore: overdue.length > page * limit,
    };
  }

  async listDueSoon(
    days: number = 7,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedInvoiceResponseDTO> {
    const dueSoon = await this.invoiceRepository.findDueSoon(days);
    const paged = dueSoon.slice((page - 1) * limit, page * limit);

    return {
      data: paged.map((inv) => InvoiceMapper.toDTO(inv)),
      total: dueSoon.length,
      page,
      limit,
      hasMore: dueSoon.length > page * limit,
    };
  }

  async listAll(page: number = 1, limit: number = 20): Promise<PaginatedInvoiceResponseDTO> {
    const result = await this.invoiceRepository.findAll({
      page,
      limit,
      sortBy: 'invoiceDate',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((inv) => InvoiceMapper.toDTO(inv)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }
}
