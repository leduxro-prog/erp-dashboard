import { randomUUID } from 'crypto';
import { FindOptionsOrder, Repository } from 'typeorm';

import {
  PurchaseRequisition,
  RequisitionApprovalStep,
  RequisitionLine,
  RequisitionStatus,
} from '../../domain/entities/PurchaseRequisition';
import {
  IPaginatedResult,
  IPaginationOptions,
  IRequisitionRepository,
} from '../../domain/repositories/IRequisitionRepository';
import { PurchaseRequisitionEntity } from '../entities/PurchaseRequisitionEntity';

export class TypeOrmRequisitionRepository implements IRequisitionRepository {
  constructor(private readonly repository: Repository<PurchaseRequisitionEntity>) {}

  async create(requisition: PurchaseRequisition): Promise<PurchaseRequisition> {
    requisition.id = requisition.id || randomUUID();
    const saved = await this.repository.save(this.toEntity(requisition));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<PurchaseRequisition | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(requisitionNumber: string): Promise<PurchaseRequisition | null> {
    const entity = await this.repository.findOne({ where: { requisitionNumber } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByDepartment(
    departmentId: string,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseRequisition>> {
    return this.findPaginated({ departmentId }, options);
  }

  async findByStatus(
    status: RequisitionStatus,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseRequisition>> {
    return this.findPaginated({ status }, options);
  }

  async findAll(options: IPaginationOptions): Promise<IPaginatedResult<PurchaseRequisition>> {
    return this.findPaginated({}, options);
  }

  async update(id: string, updates: Partial<PurchaseRequisition>): Promise<void> {
    const requisition = await this.findById(id);
    if (!requisition) {
      throw new Error('Requisition not found');
    }
    Object.assign(requisition, updates, { updatedAt: new Date() });
    await this.repository.save(this.toEntity(requisition));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async addLine(requisitionId: string, line: RequisitionLine): Promise<void> {
    const requisition = await this.findById(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }
    line.id = line.id || randomUUID();
    requisition.lines = requisition.lines || [];
    requisition.lines.push(line);
    requisition.updatedAt = new Date();
    await this.repository.save(this.toEntity(requisition));
  }

  async updateLine(
    requisitionId: string,
    lineId: string,
    updates: Partial<RequisitionLine>,
  ): Promise<void> {
    const requisition = await this.findById(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }
    requisition.lines = (requisition.lines || []).map((line) => {
      if (line.id !== lineId) {
        return line;
      }
      Object.assign(line, updates, { updatedAt: new Date() });
      return line;
    });
    requisition.updatedAt = new Date();
    await this.repository.save(this.toEntity(requisition));
  }

  async removeLine(requisitionId: string, lineId: string): Promise<void> {
    const requisition = await this.findById(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }
    requisition.lines = (requisition.lines || []).filter((line) => line.id !== lineId);
    requisition.updatedAt = new Date();
    await this.repository.save(this.toEntity(requisition));
  }

  async addApprovalStep(
    requisitionId: string,
    approval: RequisitionApprovalStep,
  ): Promise<void> {
    const requisition = await this.findById(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }
    approval.id = approval.id || randomUUID();
    requisition.approvals = requisition.approvals || [];
    requisition.approvals.push(approval);
    requisition.updatedAt = new Date();
    await this.repository.save(this.toEntity(requisition));
  }

  async updateApprovalStep(
    requisitionId: string,
    approvalId: string,
    updates: Partial<RequisitionApprovalStep>,
  ): Promise<void> {
    const requisition = await this.findById(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }
    requisition.approvals = (requisition.approvals || []).map((step) => {
      if (step.id !== approvalId) {
        return step;
      }
      return { ...step, ...updates } as RequisitionApprovalStep;
    });
    requisition.updatedAt = new Date();
    await this.repository.save(this.toEntity(requisition));
  }

  async getApprovalSteps(requisitionId: string): Promise<RequisitionApprovalStep[]> {
    const requisition = await this.findById(requisitionId);
    return requisition?.approvals || [];
  }

  async existsByNumber(requisitionNumber: string): Promise<boolean> {
    return (await this.repository.count({ where: { requisitionNumber } })) > 0;
  }

  async countByDepartment(departmentId: string): Promise<number> {
    return this.repository.count({ where: { departmentId } });
  }

  private async findPaginated(
    where: Partial<PurchaseRequisitionEntity>,
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<PurchaseRequisition>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortKey = this.resolveSortField(options.sortBy);
    const order: FindOptionsOrder<PurchaseRequisitionEntity> = {
      [sortKey]: options.sortOrder || 'DESC',
    };

    const [rows, total] = await this.repository.findAndCount({
      where: where as any,
      order,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => this.toDomain(row)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  private resolveSortField(sortBy?: string): keyof PurchaseRequisitionEntity {
    const allowed: Array<keyof PurchaseRequisitionEntity> = [
      'createdAt',
      'updatedAt',
      'requiredBy',
      'requisitionNumber',
      'status',
    ];
    if (sortBy && allowed.includes(sortBy as keyof PurchaseRequisitionEntity)) {
      return sortBy as keyof PurchaseRequisitionEntity;
    }
    return 'createdAt';
  }

  private toEntity(requisition: PurchaseRequisition): PurchaseRequisitionEntity {
    return this.repository.create({
      id: requisition.id,
      requisitionNumber: requisition.requisitionNumber,
      departmentId: requisition.departmentId,
      status: requisition.status,
      priority: requisition.priority,
      title: requisition.title,
      requiredBy: requisition.requiredBy || null,
      payload: {
        ...requisition,
        lines: (requisition.lines || []).map((line) => ({ ...line })),
        approvals: requisition.approvals || [],
      },
      createdAt: requisition.createdAt,
      updatedAt: requisition.updatedAt,
    });
  }

  private toDomain(entity: PurchaseRequisitionEntity): PurchaseRequisition {
    const payload = (entity.payload || {}) as Record<string, any>;
    return new PurchaseRequisition({
      ...payload,
      id: entity.id,
      requisitionNumber: entity.requisitionNumber,
      departmentId: entity.departmentId,
      status: entity.status as RequisitionStatus,
      priority: entity.priority as any,
      title: entity.title,
      requiredBy: entity.requiredBy || payload.requiredBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lines: (payload.lines || []).map((line: Record<string, any>) => new RequisitionLine(line)),
      approvals: (payload.approvals || []) as RequisitionApprovalStep[],
    });
  }
}
