import {
  CreateRequisitionDTO,
  RequisitionResponseDTO,
  PaginatedRequisitionResponseDTO,
  ApproveRequisitionDTO,
  SubmitRequisitionDTO,
  RejectRequisitionDTO,
} from '../dtos/RequisitionDTOs';
import { PurchaseRequisition, RequisitionLine } from '../../domain/entities/PurchaseRequisition';
import { RequisitionService } from '../../domain/services/RequisitionService';
import { IRequisitionRepository } from '../../domain/repositories/IRequisitionRepository';
import { RequisitionMapper } from '../../infrastructure/mappers/RequisitionMapper';

export class RequisitionUseCases {
  constructor(
    private requisitionService: RequisitionService,
    private requisitionRepository: IRequisitionRepository
  ) {}

  async createRequisition(dto: CreateRequisitionDTO): Promise<RequisitionResponseDTO> {
    const requisition = new PurchaseRequisition({
      requisitionNumber: this.requisitionService.generateRequisitionNumber(),
      departmentId: dto.departmentId,
      departmentName: dto.departmentName,
      requestedById: dto.requestedById,
      requestedByName: dto.requestedByName,
      requestedByEmail: dto.requestedByEmail,
      status: 'draft' as any,
      priority: dto.priority as any,
      title: dto.title,
      description: dto.description,
      justification: dto.justification,
      budgetCode: dto.budgetCode,
      costCenter: dto.costCenter,
      requiredBy: dto.requiredBy,
      notes: dto.notes,
      currency: dto.currency,
      totalAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
      approvals: [],
    });

    const created = await this.requisitionRepository.create(requisition);

    // Add lines
    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i];
      const line = new RequisitionLine({
        requisitionId: created.id,
        lineNumber: i + 1,
        productId: lineDto.productId,
        productCode: lineDto.productCode,
        productName: lineDto.productName,
        description: lineDto.description,
        quantity: lineDto.quantity,
        unit: lineDto.unit,
        estimatedUnitPrice: lineDto.estimatedUnitPrice,
        estimatedTotalPrice: lineDto.quantity * lineDto.estimatedUnitPrice,
        notes: lineDto.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const validation = line.validate();
      if (!validation.valid) {
        throw new Error(`Line ${i + 1} validation failed: ${validation.errors.join(', ')}`);
      }

      await this.requisitionRepository.addLine(created.id, line);
    }

    return RequisitionMapper.toDTO(created);
  }

  async submitRequisition(dto: SubmitRequisitionDTO): Promise<RequisitionResponseDTO> {
    await this.requisitionService.submitRequisition(dto.requisitionId, dto.submittedBy);
    const requisition = await this.requisitionRepository.findById(dto.requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    return RequisitionMapper.toDTO(requisition);
  }

  async approveRequisition(dto: ApproveRequisitionDTO): Promise<RequisitionResponseDTO> {
    const isFullyApproved = await this.requisitionService.approveRequisition(
      dto.requisitionId,
      dto.approverId,
      dto.approverName,
      dto.approvalLevel,
      dto.comments
    );

    const requisition = await this.requisitionRepository.findById(dto.requisitionId);
    if (!requisition) throw new Error('Requisition not found');

    return RequisitionMapper.toDTO(requisition);
  }

  async rejectRequisition(dto: RejectRequisitionDTO): Promise<RequisitionResponseDTO> {
    await this.requisitionService.rejectRequisition(
      dto.requisitionId,
      dto.approverId,
      dto.approverName,
      dto.rejectionReason
    );

    const requisition = await this.requisitionRepository.findById(dto.requisitionId);
    if (!requisition) throw new Error('Requisition not found');

    return RequisitionMapper.toDTO(requisition);
  }

  async getRequisition(requisitionId: string): Promise<RequisitionResponseDTO> {
    const requisition = await this.requisitionRepository.findById(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    return RequisitionMapper.toDTO(requisition);
  }

  async getRequisitionByNumber(requisitionNumber: string): Promise<RequisitionResponseDTO> {
    const requisition = await this.requisitionRepository.findByNumber(requisitionNumber);
    if (!requisition) throw new Error('Requisition not found');
    return RequisitionMapper.toDTO(requisition);
  }

  async listByDepartment(
    departmentId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedRequisitionResponseDTO> {
    const result = await this.requisitionRepository.findByDepartment(departmentId, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((r) => RequisitionMapper.toDTO(r)),
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
  ): Promise<PaginatedRequisitionResponseDTO> {
    const result = await this.requisitionRepository.findByStatus(status as any, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((r) => RequisitionMapper.toDTO(r)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async listAll(page: number = 1, limit: number = 20): Promise<PaginatedRequisitionResponseDTO> {
    const result = await this.requisitionRepository.findAll({
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((r) => RequisitionMapper.toDTO(r)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async cancelRequisition(requisitionId: string): Promise<void> {
    await this.requisitionService.cancelRequisition(requisitionId);
  }
}
