import { Repository, LessThan, In } from 'typeorm';
import { Quote, QuoteStatus } from '../../domain/entities/Quote';
import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteEntity } from '../entities/QuoteEntity';

export class TypeOrmQuoteRepository implements IQuoteRepository {
  constructor(private repository: Repository<QuoteEntity>) {}

  async save(quote: Quote): Promise<Quote> {
    const entity = this.toPersistence(quote);
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<Quote | null> {
    const entity = await this.repository.findOne({
      where: { id }
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByQuoteNumber(quoteNumber: string): Promise<Quote | null> {
    const entity = await this.repository.findOne({
      where: { quoteNumber }
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCustomerId(customerId: string): Promise<Quote[]> {
    const entities = await this.repository.find({
      where: { customerId }
    });
    return entities.map(entity => this.toDomain(entity));
  }

  async findAll(): Promise<Quote[]> {
    const entities = await this.repository.find();
    return entities.map(entity => this.toDomain(entity));
  }

  async findByStatus(status: QuoteStatus): Promise<Quote[]> {
    const entities = await this.repository.find({ where: { status } });
    return entities.map(entity => this.toDomain(entity));
  }

  async findExpiredQuotes(): Promise<Quote[]> {
    const now = new Date();
    const entities = await this.repository.find({
      where: {
        validUntil: LessThan(now),
        status: In([QuoteStatus.PENDING, QuoteStatus.SENT]),
      },
    });
    return entities.map(entity => this.toDomain(entity));
  }

  async findQuotesByExpirationDate(date: Date): Promise<Quote[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const entities = await this.repository
      .createQueryBuilder('quote')
      .where('quote.validUntil >= :startOfDay', { startOfDay })
      .andWhere('quote.validUntil <= :endOfDay', { endOfDay })
      .getMany();

    return entities.map(entity => this.toDomain(entity));
  }

  async findPendingOrSentQuotes(): Promise<Quote[]> {
    const entities = await this.repository.find({
      where: { status: In([QuoteStatus.PENDING, QuoteStatus.SENT]) },
    });
    return entities.map(entity => this.toDomain(entity));
  }

  async update(quote: Quote): Promise<Quote> {
    const entity = this.toPersistence(quote);
    await this.repository.save(entity);
    return quote;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async countByCustomerId(customerId: string): Promise<number> {
    return await this.repository.count({ where: { customerId } });
  }

  async findWithPagination(
    page: number,
    limit: number,
  ): Promise<{ data: Quote[]; total: number }> {
    const [entities, total] = await this.repository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data: entities.map(entity => this.toDomain(entity)),
      total,
    };
  }

  async findByCustomerIdWithPagination(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Quote[]; total: number }> {
    const [entities, total] = await this.repository.findAndCount({
      where: { customerId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data: entities.map(entity => this.toDomain(entity)),
      total,
    };
  }

  private toDomain(entity: QuoteEntity): Quote {
    const metadata = entity.metadata || {};
    const quote = new Quote(
      entity.id,
      entity.quoteNumber,
      entity.customerId,
      metadata.customerName || '',
      metadata.customerEmail || '',
      metadata.items || [],
      metadata.billingAddress || {},
      metadata.shippingAddress || {},
      entity.paymentTerms || '',
      metadata.deliveryEstimate || '',
      entity.createdBy || '',
      entity.discountPercentage || 0,
      metadata.validityDays || 30,
      entity.notes || '',
    );

    quote.status = entity.status;
    quote.subtotal = Number(entity.subtotal);
    quote.discountAmount = Number(entity.discountAmount);
    quote.taxRate = Number(metadata.taxRate || 0);
    quote.taxAmount = Number(entity.taxAmount);
    quote.grandTotal = Number(entity.grandTotal);
    quote.currency = entity.currency;
    quote.validUntil = entity.validUntil;
    quote.sentAt = entity.sentAt;
    quote.acceptedAt = entity.acceptedAt;
    quote.rejectedAt = entity.rejectedAt;
    quote.rejectionReason = entity.rejectionReason;
    quote.createdAt = entity.createdAt;
    quote.updatedAt = entity.updatedAt;

    return quote;
  }

  private toPersistence(quote: Quote): QuoteEntity {
    const entity = new QuoteEntity();
    entity.id = quote.id;
    entity.quoteNumber = quote.quoteNumber;
    entity.customerId = quote.customerId;
    entity.status = quote.status;
    entity.subtotal = quote.subtotal;
    entity.discountAmount = quote.discountAmount;
    entity.discountPercentage = quote.discountPercentage;
    entity.taxAmount = quote.taxAmount;
    entity.grandTotal = quote.grandTotal;
    entity.currency = quote.currency;
    entity.paymentTerms = quote.paymentTerms;
    entity.validUntil = quote.validUntil;
    entity.sentAt = quote.sentAt;
    entity.acceptedAt = quote.acceptedAt;
    entity.rejectedAt = quote.rejectedAt;
    entity.rejectionReason = quote.rejectionReason;
    entity.notes = quote.notes;
    entity.createdBy = quote.createdBy;
    entity.quoteDate = quote.createdAt || new Date();
    entity.metadata = {
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      items: quote.items,
      billingAddress: quote.billingAddress,
      shippingAddress: quote.shippingAddress,
      deliveryEstimate: quote.deliveryEstimate,
      validityDays: quote.validityDays,
      taxRate: quote.taxRate,
    };
    entity.createdAt = quote.createdAt;
    entity.updatedAt = quote.updatedAt;
    return entity;
  }
}
