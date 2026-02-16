import {
  CreateGRNDTO,
  GRNResponseDTO,
  PaginatedGRNResponseDTO,
  InspectGRNDTO,
  RequestReturnDTO,
} from '../dtos/GRNDTOs';
import { GoodsReceiptNote, GRNLine, GRNStatus } from '../../domain/entities/GoodsReceiptNote';
import { GRNService } from '../../domain/services/GRNService';
import { IGRNRepository } from '../../domain/repositories/IGRNRepository';
import { GRNMapper } from '../../infrastructure/mappers/GRNMapper';

export class GRNUseCases {
  constructor(private grnService: GRNService, private grnRepository: IGRNRepository) {}

  async createGRN(dto: CreateGRNDTO): Promise<GRNResponseDTO> {
    const grn = new GoodsReceiptNote({
      grnNumber: this.grnService.generateGRNNumber(),
      poId: dto.poId,
      poNumber: '',
      vendorId: dto.vendorId,
      vendorName: dto.vendorName,
      grn_date: new Date(),
      receiveDate: dto.receiveDate,
      status: GRNStatus.DRAFT,
      waybillNumber: dto.waybillNumber,
      containerNumber: dto.containerNumber,
      totalQuantity: dto.totalQuantity,
      totalWeight: dto.totalWeight,
      totalVolume: dto.totalVolume,
      currency: dto.currency,
      totalReceivedAmount: 0,
      notes: dto.notes,
      receivingDetails: dto.receivingDetails,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
      returnedItems: [],
    });

    const created = await this.grnService.createGRN(grn);

    // Add lines
    for (const lineDto of dto.lines) {
      const line = new GRNLine({
        grnId: created.id,
        poLineId: lineDto.poLineId,
        lineNumber: lineDto.lineNumber,
        productId: lineDto.productId,
        productCode: lineDto.productCode,
        productName: lineDto.productName,
        quantityOrdered: lineDto.quantityOrdered,
        quantityReceived: lineDto.quantityReceived,
        quantityRejected: lineDto.quantityRejected,
        unit: lineDto.unit,
        priceOrdered: lineDto.priceOrdered,
        priceReceived: lineDto.priceReceived,
        status: 'pending' as any,
        batchNumber: lineDto.batchNumber,
        expiryDate: lineDto.expiryDate,
        serialNumbers: lineDto.serialNumbers,
        remarks: lineDto.remarks,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await this.grnRepository.addLine(created.id, line);
    }

    return GRNMapper.toDTO(created);
  }

  async submitGRN(grnId: string): Promise<GRNResponseDTO> {
    await this.grnService.submitGRN(grnId);
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async inspectGRN(dto: InspectGRNDTO): Promise<GRNResponseDTO> {
    await this.grnService.inspectGRN(
      dto.grnId,
      dto.inspectorId,
      dto.inspectorName,
      dto.qualityOk,
      dto.remarks,
      dto.defectDetails
    );

    const grn = await this.grnRepository.findById(dto.grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async acceptGRN(grnId: string): Promise<GRNResponseDTO> {
    await this.grnService.acceptGRN(grnId);
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async rejectGRN(grnId: string, reason: string): Promise<GRNResponseDTO> {
    await this.grnService.rejectGRN(grnId, reason);
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async requestReturn(dto: RequestReturnDTO): Promise<GRNResponseDTO> {
    await this.grnService.requestReturn(
      dto.grnId,
      dto.grnLineId,
      dto.quantityToReturn,
      dto.reason
    );

    const grn = await this.grnRepository.findById(dto.grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async approveReturn(grnId: string, returnId: string, approvedBy: string): Promise<GRNResponseDTO> {
    await this.grnService.approveReturn(grnId, returnId, approvedBy);
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async getGRN(grnId: string): Promise<GRNResponseDTO> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async getGRNByNumber(grnNumber: string): Promise<GRNResponseDTO> {
    const grn = await this.grnRepository.findByNumber(grnNumber);
    if (!grn) throw new Error('GRN not found');
    return GRNMapper.toDTO(grn);
  }

  async listByPO(poId: string): Promise<GRNResponseDTO[]> {
    const grns = await this.grnRepository.findByPO(poId);
    return grns.map((grn) => GRNMapper.toDTO(grn));
  }

  async listByVendor(
    vendorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedGRNResponseDTO> {
    const result = await this.grnRepository.findByVendor(vendorId, {
      page,
      limit,
      sortBy: 'receiveDate',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((grn) => GRNMapper.toDTO(grn)),
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
  ): Promise<PaginatedGRNResponseDTO> {
    const result = await this.grnRepository.findByStatus(status as any, {
      page,
      limit,
      sortBy: 'receiveDate',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((grn) => GRNMapper.toDTO(grn)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async listAll(page: number = 1, limit: number = 20): Promise<PaginatedGRNResponseDTO> {
    const result = await this.grnRepository.findAll({
      page,
      limit,
      sortBy: 'receiveDate',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((grn) => GRNMapper.toDTO(grn)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }
}
