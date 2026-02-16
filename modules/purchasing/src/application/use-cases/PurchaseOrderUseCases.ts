import {
  CreatePurchaseOrderDTO,
  PurchaseOrderResponseDTO,
  PaginatedPOResponseDTO,
  ApprovePurchaseOrderDTO,
  SendPurchaseOrderDTO,
  AmendPurchaseOrderDTO,
  UpdatePOLineDTO,
} from '../dtos/PurchaseOrderDTOs';
import { PurchaseOrder, POLine, POStatus } from '../../domain/entities/PurchaseOrder';
import { PurchaseOrderService } from '../../domain/services/PurchaseOrderService';
import { IPurchaseOrderRepository } from '../../domain/repositories/IPurchaseOrderRepository';
import { PurchaseOrderMapper } from '../../infrastructure/mappers/PurchaseOrderMapper';

export class PurchaseOrderUseCases {
  constructor(
    private poService: PurchaseOrderService,
    private poRepository: IPurchaseOrderRepository
  ) {}

  async createPurchaseOrder(dto: CreatePurchaseOrderDTO): Promise<PurchaseOrderResponseDTO> {
    const po = new PurchaseOrder({
      poNumber: this.poService.generatePONumber(),
      requisitionId: dto.requisitionId,
      vendorId: dto.vendorId,
      vendorName: dto.vendorName,
      vendorCode: dto.vendorCode,
      status: POStatus.DRAFT,
      type: 'standard' as any,
      issuedDate: dto.issuedDate,
      requiredByDate: dto.requiredByDate,
      paymentTermsId: dto.paymentTermsId,
      paymentTerms: dto.paymentTerms,
      incoTerms: dto.incoTerms,
      shippingDetails: dto.shippingDetails,
      contact: dto.contact,
      currency: dto.currency,
      totalAmount: 0,
      taxAmount: dto.taxAmount,
      shippingCost: dto.shippingCost,
      discountAmount: dto.discountAmount,
      discountPercentage: dto.discountPercentage,
      notes: dto.notes,
      internalNotes: dto.internalNotes,
      createdBy: dto.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
      revisions: [],
      grnReferences: [],
      invoiceReferences: [],
    });

    const created = await this.poRepository.create(po);

    // Add lines
    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i];
      const line = new POLine({
        poId: created.id,
        lineNumber: i + 1,
        productId: lineDto.productId,
        productCode: lineDto.productCode,
        productName: lineDto.productName,
        description: lineDto.description,
        quantity: lineDto.quantity,
        unit: lineDto.unit,
        unitPrice: lineDto.unitPrice,
        totalPrice: lineDto.quantity * lineDto.unitPrice,
        status: 'pending' as any,
        taxRate: lineDto.taxRate,
        taxAmount: (lineDto.quantity * lineDto.unitPrice * lineDto.taxRate) / 100,
        notes: lineDto.notes,
        glAccountCode: lineDto.glAccountCode,
        costCenter: lineDto.costCenter,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const validation = line.validate();
      if (!validation.valid) {
        throw new Error(`Line ${i + 1} validation failed: ${validation.errors.join(', ')}`);
      }

      await this.poRepository.addLine(created.id, line);
    }

    // Calculate and update totals
    const totals = this.poService.calculatePOTotals(created);
    await this.poRepository.update(created.id, { totalAmount: totals.total });

    return PurchaseOrderMapper.toDTO(created);
  }

  async approvePO(dto: ApprovePurchaseOrderDTO): Promise<PurchaseOrderResponseDTO> {
    await this.poService.approvePO(dto.poId, dto.approvedBy);
    const po = await this.poRepository.findById(dto.poId);
    if (!po) throw new Error('Purchase Order not found');
    return PurchaseOrderMapper.toDTO(po);
  }

  async sendPO(dto: SendPurchaseOrderDTO): Promise<PurchaseOrderResponseDTO> {
    await this.poService.sendPO(dto.poId);
    const po = await this.poRepository.findById(dto.poId);
    if (!po) throw new Error('Purchase Order not found');
    return PurchaseOrderMapper.toDTO(po);
  }

  async amendPO(dto: AmendPurchaseOrderDTO): Promise<PurchaseOrderResponseDTO> {
    await this.poService.amendPO(dto.poId, dto.changes, dto.reason, dto.amendedBy);
    const po = await this.poRepository.findById(dto.poId);
    if (!po) throw new Error('Purchase Order not found');
    return PurchaseOrderMapper.toDTO(po);
  }

  async updatePOLine(dto: UpdatePOLineDTO): Promise<PurchaseOrderResponseDTO> {
    await this.poService.updatePOLine(dto.poId, dto.lineId, dto.updates as any);
    const po = await this.poRepository.findById(dto.poId);
    if (!po) throw new Error('Purchase Order not found');
    return PurchaseOrderMapper.toDTO(po);
  }

  async getPurchaseOrder(poId: string): Promise<PurchaseOrderResponseDTO> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');
    return PurchaseOrderMapper.toDTO(po);
  }

  async getPOByNumber(poNumber: string): Promise<PurchaseOrderResponseDTO> {
    const po = await this.poRepository.findByNumber(poNumber);
    if (!po) throw new Error('Purchase Order not found');
    return PurchaseOrderMapper.toDTO(po);
  }

  async listByVendor(
    vendorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedPOResponseDTO> {
    const result = await this.poRepository.findByVendor(vendorId, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((po) => PurchaseOrderMapper.toDTO(po)),
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
  ): Promise<PaginatedPOResponseDTO> {
    const result = await this.poRepository.findByStatus(status as any, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((po) => PurchaseOrderMapper.toDTO(po)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async listAll(page: number = 1, limit: number = 20): Promise<PaginatedPOResponseDTO> {
    const result = await this.poRepository.findAll({
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((po) => PurchaseOrderMapper.toDTO(po)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async cancelPO(poId: string): Promise<void> {
    await this.poService.cancelPO(poId);
  }

  async closePO(poId: string): Promise<void> {
    await this.poService.closePO(poId);
  }
}
