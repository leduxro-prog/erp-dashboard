import { DataSource, Repository, Like, LessThan } from 'typeorm';
import { DiscountCode, DiscountCodeType } from '../../domain/entities/DiscountCode';
import {
  IDiscountCodeRepository,
  DiscountCodeFilter,
} from '../../domain/repositories/IDiscountCodeRepository';
import { DiscountCodeEntity } from '../entities/DiscountCodeEntity';

export class TypeOrmDiscountCodeRepository implements IDiscountCodeRepository {
  private readonly repository: Repository<DiscountCodeEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(DiscountCodeEntity);
  }

  async save(discountCode: DiscountCode): Promise<DiscountCode> {
    const entity = this.mapToEntity(discountCode);
    const savedEntity = await this.repository.save(entity);
    return this.mapToDomain(savedEntity);
  }

  async findByCode(code: string): Promise<DiscountCode | null> {
    const entity = await this.repository.findOne({ where: { code: code.toUpperCase() } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findById(id: string): Promise<DiscountCode | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByCampaign(campaignId: string): Promise<DiscountCode[]> {
    const entities = await this.repository.find({ where: { campaignId } });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async incrementUsage(id: string): Promise<DiscountCode> {
    await this.repository.increment({ id }, 'usedCount', 1);
    const updated = await this.findById(id);
    if (!updated) throw new Error('Discount code not found after update');
    return updated;
  }

  async incrementUsageIfAvailable(id: string): Promise<DiscountCode | null> {
    const result = await this.repository
      .createQueryBuilder()
      .update(DiscountCodeEntity)
      .set({ usedCount: () => '"usedCount" + 1' })
      .where('id = :id', { id })
      .andWhere('("maxUsageCount" IS NULL OR "usedCount" < "maxUsageCount")')
      .execute();

    if (!result.affected) {
      return null;
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  async findActive(): Promise<DiscountCode[]> {
    const entities = await this.repository.find({ where: { isActive: true } });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async findWithFilter(filter: DiscountCodeFilter, page: number, limit: number) {
    const where: any = {};
    if (filter.campaignId) where.campaignId = filter.campaignId;
    if (filter.type) where.type = filter.type;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.search) where.code = Like(`%${filter.search.toUpperCase()}%`);

    const [entities, total] = await this.repository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map((entity) => this.mapToDomain(entity)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async validateCode(code: string, orderAmount: number): Promise<boolean> {
    const discountCode = await this.findByCode(code);
    if (!discountCode) return false;
    return discountCode.isValid(orderAmount);
  }

  async findExpired(): Promise<DiscountCode[]> {
    const entities = await this.repository.find({
      where: { endDate: LessThan(new Date()) },
    });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async findExpiringCodes(daysUntilExpiry: number): Promise<DiscountCode[]> {
    const date = new Date();
    date.setDate(date.getDate() + daysUntilExpiry);
    const entities = await this.repository.find({
      where: { endDate: LessThan(date) },
    });
    return entities.map((entity) => this.mapToDomain(entity));
  }

  async count(filter: DiscountCodeFilter): Promise<number> {
    const where: any = {};
    if (filter.campaignId) where.campaignId = filter.campaignId;
    return this.repository.count({ where });
  }

  async getCustomerUsageCount(codeId: string, customerId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM marketing_events
       WHERE "customerId" = $1
       AND "eventType" = 'CONVERTED'
       AND (data->>'discountCodeId' = $2 OR metadata->>'discountCodeId' = $2)`,
      [customerId, codeId],
    );
    return result[0]?.count || 0;
  }

  private mapToDomain(entity: DiscountCodeEntity): DiscountCode {
    const restrictions = (entity.restrictions as any) || {};

    return new DiscountCode(
      entity.id,
      entity.campaignId || null,
      entity.code,
      entity.type as DiscountCodeType,
      Number(entity.value),
      entity.minOrderValue ? Number(entity.minOrderValue) : null,
      restrictions.maximumDiscount ? Number(restrictions.maximumDiscount) : null,
      entity.startDate,
      entity.endDate,
      entity.maxUsageCount || null,
      entity.usedCount,
      entity.maxUsagePerCustomer || null,
      restrictions.applicableToProducts || [],
      restrictions.applicableToCategories || [],
      restrictions.excludedProducts || [],
      entity.isActive,
      restrictions.isStackable || false,
      'system',
      entity.createdAt,
    );
  }

  private mapToEntity(domain: DiscountCode): DiscountCodeEntity {
    const entity = new DiscountCodeEntity();
    entity.id = domain.id;
    entity.campaignId = domain.campaignId || undefined;
    entity.code = domain.code.toUpperCase();
    entity.type = domain.type;
    entity.value = domain.value;
    entity.maxUsageCount = domain.maxUses || undefined;
    entity.usedCount = domain.getCurrentUses();
    entity.maxUsagePerCustomer = domain.maxUsesPerCustomer || undefined;
    entity.minOrderValue = domain.minimumOrderAmount || undefined;
    entity.startDate = domain.validFrom;
    entity.endDate = domain.validTo;
    entity.isActive = domain.getIsActive();
    entity.restrictions = {
      maximumDiscount: domain.maximumDiscount,
      applicableToProducts: domain.applicableToProducts,
      applicableToCategories: domain.applicableToCategories,
      excludedProducts: domain.excludedProducts,
      isStackable: domain.isStackable,
    };
    return entity;
  }
}
