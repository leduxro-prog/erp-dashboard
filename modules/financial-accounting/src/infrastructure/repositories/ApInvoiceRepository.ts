import { In, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { ApInvoice, ApInvoiceLine, ApInvoiceStatus, ThreeWayMatchStatus } from '../../domain/entities/ApInvoice';
import { IApInvoiceRepository } from '../../domain/repositories/IApInvoiceRepository';
import { ApInvoiceEntity } from '../entities/ApInvoiceEntity';
import { ApInvoiceLineEntity } from '../entities/ApInvoiceLineEntity';

export class ApInvoiceRepository implements IApInvoiceRepository {
  constructor(private readonly ormRepository: Repository<ApInvoiceEntity>) {}

  async create(invoice: ApInvoice): Promise<ApInvoice> {
    const id = invoice.id || randomUUID();
    const entity = this.ormRepository.create({
      ...this.toEntityShape(invoice, id),
      lines: this.toLineEntities(invoice.lines, id),
    } as any);

    const saved = await this.ormRepository.save(entity as any);
    return this.toDomain(saved);
  }

  async update(invoice: ApInvoice): Promise<ApInvoice> {
    const current = await this.ormRepository.findOne({
      where: { id: invoice.id, organizationId: invoice.organizationId },
      relations: ['lines'],
    });
    if (!current) {
      throw new Error('AP Invoice not found');
    }

    const merged = this.ormRepository.merge(current, {
      ...this.toEntityShape(invoice, invoice.id),
      lines: this.toLineEntities(invoice.lines, invoice.id),
    } as any);

    const saved = await this.ormRepository.save(merged as any);
    return this.toDomain(saved);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.ormRepository.delete({ id, organizationId });
  }

  async findById(id: string, organizationId: string): Promise<ApInvoice | null> {
    const entity = await this.ormRepository.findOne({
      where: { id, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(invoiceNumber: string, organizationId: string): Promise<ApInvoice | null> {
    const entity = await this.ormRepository.findOne({
      where: { invoiceNumber, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByVendor(vendorId: string, organizationId: string): Promise<ApInvoice[]> {
    const entities = await this.ormRepository.find({
      where: { vendorId, organizationId },
      relations: ['lines'],
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByStatus(status: ApInvoiceStatus, organizationId: string): Promise<ApInvoice[]> {
    const entities = await this.ormRepository.find({
      where: { status, organizationId },
      relations: ['lines'],
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByDateRange(startDate: Date, endDate: Date, organizationId: string): Promise<ApInvoice[]> {
    const entities = await this.ormRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :orgId', { orgId: organizationId })
      .andWhere('invoice.invoiceDate >= :startDate', { startDate })
      .andWhere('invoice.invoiceDate <= :endDate', { endDate })
      .leftJoinAndSelect('invoice.lines', 'lines')
      .getMany();

    return entities.map((entity) => this.toDomain(entity));
  }

  async findOverdue(organizationId: string, asOfDate: Date = new Date()): Promise<ApInvoice[]> {
    const entities = await this.ormRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :orgId', { orgId: organizationId })
      .andWhere('invoice.dueDate < :asOfDate', { asOfDate })
      .andWhere('invoice.amountDue > 0')
      .andWhere('invoice.status NOT IN (:...excluded)', {
        excluded: [ApInvoiceStatus.PAID, ApInvoiceStatus.CANCELLED],
      })
      .leftJoinAndSelect('invoice.lines', 'lines')
      .getMany();

    return entities.map((entity) => this.toDomain(entity));
  }

  async findUnpaid(organizationId: string): Promise<ApInvoice[]> {
    const entities = await this.ormRepository.find({
      where: {
        organizationId,
        status: In([
          ApInvoiceStatus.MATCHED,
          ApInvoiceStatus.UNMATCHED,
          ApInvoiceStatus.PARTIALLY_PAID,
          ApInvoiceStatus.OVERDUE,
          ApInvoiceStatus.RECEIVED,
        ]),
      },
      relations: ['lines'],
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findUnmatched(organizationId: string): Promise<ApInvoice[]> {
    const entities = await this.ormRepository.find({
      where: {
        organizationId,
        threeWayMatchStatus: Not(ThreeWayMatchStatus.COMPLETE),
        status: Not(In([ApInvoiceStatus.PAID, ApInvoiceStatus.CANCELLED])),
      },
      relations: ['lines'],
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByPoNumber(poNumber: string, organizationId: string): Promise<ApInvoice[]> {
    const entities = await this.ormRepository.find({
      where: { poNumber, organizationId },
      relations: ['lines'],
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async getNextInvoiceNumber(organizationId: string): Promise<string> {
    const prefix = `${organizationId.substring(0, 4)}-AP-INV-`;
    const lastInvoice = await this.ormRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :orgId', { orgId: organizationId })
      .orderBy('invoice.createdAt', 'DESC')
      .limit(1)
      .getOne();

    if (!lastInvoice) {
      return `${prefix}0001`;
    }

    const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
    const nextNumber = String((match ? parseInt(match[1], 10) : 0) + 1).padStart(4, '0');
    return `${prefix}${nextNumber}`;
  }

  async getAgeingSummary(organizationId: string, asOfDate: Date = new Date()): Promise<Map<string, number>> {
    const overdueInvoices = await this.findOverdue(organizationId, asOfDate);
    const summary = new Map<string, number>();

    for (const invoice of overdueInvoices) {
      const bucket = invoice.getAgingBucket(asOfDate);
      summary.set(bucket, (summary.get(bucket) || 0) + invoice.amountDue);
    }

    return summary;
  }

  private toEntityShape(invoice: ApInvoice, id: string): Partial<ApInvoiceEntity> {
    return {
      id,
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
      metadata: invoice.metadata || {},
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy,
    };
  }

  private toLineEntities(lines: ApInvoiceLine[], invoiceId: string): Partial<ApInvoiceLineEntity>[] {
    return (lines || []).map((line, index) => ({
      id: line.id || `${invoiceId}-line-${index + 1}`,
      apInvoiceId: invoiceId,
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      taxAmount: line.taxAmount || 0,
      expenseAccountId: line.expenseAccountId,
      taxCodeId: line.taxCodeId,
      costCenterId: line.costCenterId,
      poLineId: line.poLineId,
      grnLineId: line.grnLineId,
      metadata: line.metadata || {},
    }));
  }

  private toDomain(entity: ApInvoiceEntity): ApInvoice {
    return new ApInvoice({
      id: entity.id,
      organizationId: entity.organizationId,
      vendorId: entity.vendorId,
      invoiceNumber: entity.invoiceNumber,
      poNumber: entity.poNumber ?? undefined,
      grnNumber: entity.grnNumber ?? undefined,
      invoiceDate: entity.invoiceDate,
      dueDate: entity.dueDate,
      currencyCode: entity.currencyCode,
      subtotal: parseFloat(entity.subtotal.toString()),
      taxAmount: parseFloat(entity.taxAmount.toString()),
      discountAmount: parseFloat(entity.discountAmount.toString()),
      totalAmount: parseFloat(entity.totalAmount.toString()),
      amountPaid: parseFloat(entity.amountPaid.toString()),
      amountDue: parseFloat(entity.amountDue.toString()),
      status: entity.status as ApInvoiceStatus,
      paymentTerms: entity.paymentTerms ?? undefined,
      discountPercent: entity.discountPercent ? parseFloat(entity.discountPercent.toString()) : undefined,
      taxCodeId: entity.taxCodeId ?? undefined,
      notes: entity.notes ?? undefined,
      apAccountId: entity.apAccountId,
      expenseAccountId: entity.expenseAccountId,
      journalEntryId: entity.journalEntryId ?? undefined,
      threeWayMatchStatus: entity.threeWayMatchStatus as ThreeWayMatchStatus,
      matchVariancePercent: entity.matchVariancePercent
        ? parseFloat(entity.matchVariancePercent.toString())
        : undefined,
      isPosted: entity.isPosted,
      lines: (entity.lines || []).map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: parseFloat(line.quantity.toString()),
        unitPrice: parseFloat(line.unitPrice.toString()),
        amount: parseFloat(line.amount.toString()),
        taxAmount: parseFloat(line.taxAmount.toString()),
        expenseAccountId: line.expenseAccountId,
        taxCodeId: line.taxCodeId ?? undefined,
        costCenterId: line.costCenterId ?? undefined,
        poLineId: line.poLineId ?? undefined,
        grnLineId: line.grnLineId ?? undefined,
        metadata: line.metadata,
      })),
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    });
  }
}
