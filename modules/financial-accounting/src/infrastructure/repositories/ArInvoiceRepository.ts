import { Repository, In } from 'typeorm';
import { ArInvoice, ArInvoiceStatus } from '../../domain/entities/ArInvoice';
import { IArInvoiceRepository } from '../../domain/repositories/IArInvoiceRepository';
import { ArInvoiceEntity } from '../entities/ArInvoiceEntity';

export class ArInvoiceRepository implements IArInvoiceRepository {
  constructor(private ormRepository: Repository<ArInvoiceEntity>) { }

  async create(invoice: ArInvoice): Promise<ArInvoice> {
    const entity = this.ormRepository.create({
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
      metadata: invoice.metadata,
      createdBy: invoice.createdBy,
      updatedBy: invoice.updatedBy,
      lines: invoice.lines.map((line, index) => ({
        id: line.id || `${invoice.id}-line-${index}`,
        arInvoiceId: invoice.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        taxAmount: line.taxAmount || 0,
        revenueAccountId: line.revenueAccountId,
        taxCodeId: line.taxCodeId,
        metadata: line.metadata || {},
      })),
    });

    const saved = await this.ormRepository.save(entity);
    return this.toDomain(saved);
  }

  async update(invoice: ArInvoice): Promise<ArInvoice> {
    await this.ormRepository.update(invoice.id, {
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      status: invoice.status,
      discountPercent: invoice.discountPercent,
      notes: invoice.notes,
      isPosted: invoice.isPosted,
      journalEntryId: invoice.journalEntryId,
      metadata: invoice.metadata,
      updatedBy: invoice.updatedBy,
    });

    const updated = await this.ormRepository.findOne({
      where: { id: invoice.id },
      relations: ['lines'],
    });
    if (!updated) throw new Error('AR Invoice not found after update');
    return this.toDomain(updated);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.ormRepository.delete({ id, organizationId });
  }

  async findById(id: string, organizationId: string): Promise<ArInvoice | null> {
    const entity = await this.ormRepository.findOne({
      where: { id, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(invoiceNumber: string, organizationId: string): Promise<ArInvoice | null> {
    const entity = await this.ormRepository.findOne({
      where: { invoiceNumber, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCustomer(customerId: string, organizationId: string): Promise<ArInvoice[]> {
    const entities = await this.ormRepository.find({
      where: { customerId, organizationId },
      relations: ['lines'],
    });
    return entities.map(e => this.toDomain(e));
  }

  async findByStatus(status: ArInvoiceStatus, organizationId: string): Promise<ArInvoice[]> {
    const entities = await this.ormRepository.find({
      where: { status, organizationId },
      relations: ['lines'],
    });
    return entities.map(e => this.toDomain(e));
  }

  async findByDateRange(startDate: Date, endDate: Date, organizationId: string): Promise<ArInvoice[]> {
    const entities = await this.ormRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :orgId', { orgId: organizationId })
      .andWhere('invoice.invoiceDate >= :startDate', { startDate })
      .andWhere('invoice.invoiceDate <= :endDate', { endDate })
      .leftJoinAndSelect('invoice.lines', 'lines')
      .getMany();

    return entities.map(e => this.toDomain(e));
  }

  async findOverdue(organizationId: string, asOfDate: Date = new Date()): Promise<ArInvoice[]> {
    const entities = await this.ormRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :orgId', { orgId: organizationId })
      .andWhere('invoice.dueDate < :asOfDate', { asOfDate })
      .andWhere('invoice.amountDue > 0')
      .leftJoinAndSelect('invoice.lines', 'lines')
      .getMany();

    return entities.map(e => this.toDomain(e));
  }

  async findUnpaid(organizationId: string): Promise<ArInvoice[]> {
    const entities = await this.ormRepository.find({
      where: {
        organizationId,
        status: In(['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']),
      },
      relations: ['lines'],
    });
    return entities.map(e => this.toDomain(e));
  }

  async findByOrder(orderId: string, organizationId: string): Promise<ArInvoice | null> {
    const entity = await this.ormRepository.findOne({
      where: { orderId, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async getNextInvoiceNumber(organizationId: string): Promise<string> {
    const lastInvoice = await this.ormRepository
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :orgId', { orgId: organizationId })
      .orderBy('invoice.createdAt', 'DESC')
      .limit(1)
      .getOne();

    if (!lastInvoice) {
      return `${organizationId.substring(0, 4)}-INV-0001`;
    }

    const parts = lastInvoice.invoiceNumber.split('-');
    const lastNumber = parseInt(parts[parts.length - 1], 10);
    const nextNumber = String(lastNumber + 1).padStart(4, '0');
    return `${organizationId.substring(0, 4)}-INV-${nextNumber}`;
  }

  async getAgeingSummary(organizationId: string, asOfDate: Date = new Date()): Promise<Map<string, number>> {
    const overdueInvoices = await this.findOverdue(organizationId, asOfDate);
    const summary = new Map<string, number>();

    for (const invoice of overdueInvoices) {
      const daysOverdue = invoice.getDaysOverdue(asOfDate);
      let bucket: string;

      if (daysOverdue <= 30) bucket = '0-30';
      else if (daysOverdue <= 60) bucket = '31-60';
      else if (daysOverdue <= 90) bucket = '61-90';
      else if (daysOverdue <= 120) bucket = '91-120';
      else bucket = '120+';

      summary.set(bucket, (summary.get(bucket) || 0) + invoice.amountDue);
    }

    return summary;
  }

  private toDomain(entity: ArInvoiceEntity): ArInvoice {
    return new ArInvoice({
      id: entity.id,
      organizationId: entity.organizationId,
      customerId: entity.customerId,
      invoiceNumber: entity.invoiceNumber,
      orderId: entity.orderId,
      invoiceDate: entity.invoiceDate,
      dueDate: entity.dueDate,
      currencyCode: entity.currencyCode,
      subtotal: parseFloat(entity.subtotal.toString()),
      taxAmount: parseFloat(entity.taxAmount.toString()),
      discountAmount: parseFloat(entity.discountAmount.toString()),
      totalAmount: parseFloat(entity.totalAmount.toString()),
      amountPaid: parseFloat(entity.amountPaid.toString()),
      amountDue: parseFloat(entity.amountDue.toString()),
      status: entity.status as ArInvoiceStatus,
      paymentTerms: entity.paymentTerms,
      discountPercent: entity.discountPercent ? parseFloat(entity.discountPercent.toString()) : undefined,
      taxCodeId: entity.taxCodeId,
      notes: entity.notes,
      arAccountId: entity.arAccountId,
      revenueAccountId: entity.revenueAccountId,
      journalEntryId: entity.journalEntryId,
      isPosted: entity.isPosted,
      lines: entity.lines?.map(line => ({
        id: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: parseFloat(line.quantity.toString()),
        unitPrice: parseFloat(line.unitPrice.toString()),
        amount: parseFloat(line.amount.toString()),
        taxAmount: parseFloat(line.taxAmount.toString()),
        revenueAccountId: line.revenueAccountId,
        taxCodeId: line.taxCodeId,
        metadata: line.metadata,
      })) || [],
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    });
  }
}
