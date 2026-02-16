import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import {
  IPriceRepository,
  ProductPrice,
  PromotionRecord,
  VolumeDiscountRule,
} from '../../application/ports/IPriceRepository';
import { CreatePromotionDTO } from '../../application/dtos/pricing.dtos';
import { ProductPriceEntity } from '../entities/ProductPriceEntity';
import { PromotionEntity } from '../entities/PromotionEntity';
import { VolumeDiscountRuleEntity } from '../entities/VolumeDiscountRuleEntity';
import { PriceCache } from '../cache/PriceCache';

/**
 * TypeORM implementation of IPriceRepository (Application Port)
 * 
 * Enterprise-grade repository implementing the application port interface
 * used by pricing engine use-cases.
 */
export class TypeOrmPriceRepository implements IPriceRepository {
  private productRepository: Repository<ProductPriceEntity>;
  private promotionRepository: Repository<PromotionEntity>;
  private volumeDiscountRepository: Repository<VolumeDiscountRuleEntity>;
  private cache: PriceCache;

  constructor(dataSource: DataSource, redisClient: Redis) {
    this.productRepository = dataSource.getRepository(ProductPriceEntity);
    this.promotionRepository = dataSource.getRepository(PromotionEntity);
    this.volumeDiscountRepository = dataSource.getRepository(VolumeDiscountRuleEntity);
    this.cache = new PriceCache(redisClient);
  }

  async getProductPrice(productId: number): Promise<ProductPrice | null> {
    const cacheKey = `price:product:${productId}`;
    const cached = await this.cache.get<ProductPrice>(cacheKey);
    if (cached) return cached;

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) return null;

    const result: ProductPrice = {
      productId: product.id,
      price: product.base_price,
      cost: product.cost,
      currency: 'RON',
      lastUpdated: product.updated_at || new Date(),
    };

    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getProductPricesByIds(productIds: number[]): Promise<ProductPrice[]> {
    const results: ProductPrice[] = [];
    for (const productId of productIds) {
      const price = await this.getProductPrice(productId);
      if (price) results.push(price);
    }
    return results;
  }

  async getActivePromotionsForProduct(productId: number): Promise<PromotionRecord[]> {
    const now = new Date();
    const promotions = await this.promotionRepository
      .createQueryBuilder('promo')
      .where('promo.product_id = :productId', { productId })
      .andWhere('promo.is_active = :isActive', { isActive: true })
      .andWhere('promo.valid_from <= :now', { now: now.toISOString() })
      .andWhere('promo.valid_until >= :now', { now: now.toISOString() })
      .getMany();

    return promotions.map((p) => ({
      id: p.id,
      productId: p.product_id,
      promotionalPrice: p.promotional_price,
      originalPrice: p.original_price,
      validFrom: p.valid_from,
      validUntil: p.valid_until,
      reason: p.reason || '',
      isActive: p.is_active,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  async getAllActivePromotions(): Promise<PromotionRecord[]> {
    const now = new Date();
    const promotions = await this.promotionRepository
      .createQueryBuilder('promo')
      .where('promo.is_active = :isActive', { isActive: true })
      .andWhere('promo.valid_from <= :now', { now: now.toISOString() })
      .andWhere('promo.valid_until >= :now', { now: now.toISOString() })
      .getMany();

    return promotions.map((p) => ({
      id: p.id,
      productId: p.product_id,
      promotionalPrice: p.promotional_price,
      originalPrice: p.original_price,
      validFrom: p.valid_from,
      validUntil: p.valid_until,
      reason: p.reason || '',
      isActive: p.is_active,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  async getVolumeDiscountRuleForQuantity(
    productId: number,
    quantity: number
  ): Promise<VolumeDiscountRule | null> {
    const rule = await this.volumeDiscountRepository
      .createQueryBuilder('rule')
      .where('rule.product_id = :productId', { productId })
      .andWhere('rule.is_active = :isActive', { isActive: true })
      .andWhere('rule.min_quantity <= :quantity', { quantity })
      .andWhere('(rule.max_quantity IS NULL OR rule.max_quantity >= :quantity)', { quantity })
      .orderBy('rule.min_quantity', 'DESC')
      .getOne();

    if (!rule) return null;

    return {
      id: rule.id,
      productId: rule.product_id,
      minQuantity: rule.min_quantity ?? 0,
      maxQuantity: rule.max_quantity ?? undefined,
      discountPercentage: rule.discount_percentage,
    };
  }

  async createPromotion(data: CreatePromotionDTO): Promise<PromotionRecord> {
    const product = await this.productRepository.findOne({
      where: { id: data.productId },
    });

    const promotion = new PromotionEntity();
    promotion.product_id = data.productId;
    promotion.promotional_price = data.promotionalPrice;
    promotion.original_price = product?.base_price || 0;
    promotion.valid_from = data.validFrom;
    promotion.valid_until = data.validUntil;
    promotion.reason = data.reason || null;
    promotion.is_active = true;

    const saved = await this.promotionRepository.save(promotion);
    await this.cache.invalidatePromotion(data.productId);

    return {
      id: saved.id,
      productId: saved.product_id,
      promotionalPrice: saved.promotional_price,
      originalPrice: saved.original_price,
      validFrom: saved.valid_from,
      validUntil: saved.valid_until,
      reason: saved.reason || '',
      isActive: saved.is_active,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async deactivatePromotion(promotionId: number): Promise<void> {
    const promotion = await this.promotionRepository.findOne({
      where: { id: promotionId },
    });

    if (promotion) {
      promotion.is_active = false;
      await this.promotionRepository.save(promotion);
      await this.cache.invalidatePromotion(promotion.product_id);
    }
  }

  async expirePromotionsBefore(beforeDate: Date): Promise<number> {
    const result = await this.promotionRepository
      .createQueryBuilder()
      .update(PromotionEntity)
      .set({ is_active: false })
      .where('valid_until < :beforeDate', { beforeDate })
      .andWhere('is_active = :isActive', { isActive: true })
      .execute();

    return result.affected || 0;
  }

  async updateProductPrice(productId: number, newPrice: number): Promise<void> {
    await this.productRepository.update(productId, { base_price: newPrice });
    await this.cache.invalidateProduct(productId);
  }

  async createVolumeDiscountRule(
    productId: number,
    minQuantity: number,
    discountPercentage: number,
    maxQuantity?: number
  ): Promise<VolumeDiscountRule> {
    const rule = new VolumeDiscountRuleEntity();
    rule.product_id = productId;
    rule.min_quantity = minQuantity;
    rule.max_quantity = maxQuantity ?? null;
    rule.discount_percentage = discountPercentage;
    rule.is_active = true;

    const saved = await this.volumeDiscountRepository.save(rule);

    return {
      id: saved.id,
      productId: saved.product_id,
      minQuantity: saved.min_quantity ?? 0,
      maxQuantity: saved.max_quantity ?? undefined,
      discountPercentage: saved.discount_percentage,
    };
  }

  async deleteVolumeDiscountRule(ruleId: number): Promise<void> {
    await this.volumeDiscountRepository.delete(ruleId);
  }
}
