import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { ITierRepository, CustomerTierRecord } from '../../application/ports/ITierRepository';
import { PriceCache } from '../cache/PriceCache';

/**
 * TypeORM implementation of ITierRepository (Application Port)
 * 
 * Enterprise-grade repository for customer tier management.
 */
export class TypeOrmTierRepository implements ITierRepository {
  private customerRepository: Repository<any>;
  private cache: PriceCache;

  constructor(dataSource: DataSource, redisClient: Redis) {
    this.customerRepository = dataSource.getRepository('customers');
    this.cache = new PriceCache(redisClient);
  }

  async getCustomerTier(customerId: number): Promise<CustomerTierRecord | null> {
    const cacheKey = `price:tier:${customerId}`;
    const cachedTier = await this.cache.get<CustomerTierRecord>(cacheKey);

    if (cachedTier) {
      return cachedTier;
    }

    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer || !customer.tier_id) {
      await this.cache.set(cacheKey, null, 900);
      return null;
    }

    const tier = this.mapToCustomerTierRecord(customer);
    await this.cache.set(cacheKey, tier, 900);

    return tier;
  }

  async setCustomerTier(
    customerId: number,
    tierLevel: string,
    discountPercentage: number,
    reason: string
  ): Promise<void> {
    await this.customerRepository.update(customerId, {
      tier_level: tierLevel,
      tier_discount: discountPercentage,
      tier_reason: reason,
      tier_assigned_at: new Date(),
    });

    await this.cache.invalidateCustomerTier(customerId);
  }

  async getCustomersByTierLevel(tierLevel: string): Promise<number[]> {
    const customers = await this.customerRepository.find({
      where: { tier_level: tierLevel },
      select: ['id'],
    });

    return customers.map((c: { id: number }) => c.id);
  }

  async bulkUpdateCustomerTiers(
    updates: Array<{
      customerId: number;
      tierLevel: string;
      reason: string;
    }>
  ): Promise<number> {
    let updatedCount = 0;

    for (const update of updates) {
      try {
        const tierInfo = this.getTierInfoFromLevel(update.tierLevel);
        await this.setCustomerTier(
          update.customerId,
          update.tierLevel,
          tierInfo.discountPercentage,
          update.reason
        );
        updatedCount++;
      } catch {
        // Continue with next update
      }
    }

    return updatedCount;
  }

  async getCustomerTierHistory(
    customerId: number,
    limit: number = 10
  ): Promise<Array<{
    tierLevel: string;
    discountPercentage: number;
    assignedAt: Date;
    reason?: string;
  }>> {
    // TODO: Implement with tier history table
    // For now return current tier as single entry
    const tier = await this.getCustomerTier(customerId);
    if (!tier) return [];

    return [{
      tierLevel: tier.level,
      discountPercentage: tier.discountPercentage,
      assignedAt: tier.assignedAt,
      reason: tier.reason,
    }];
  }

  private mapToCustomerTierRecord(customer: any): CustomerTierRecord {
    const tierInfo = this.getTierInfoFromLevel(customer.tier_level || 'BRONZE');

    return {
      customerId: customer.id,
      level: customer.tier_level || 'BRONZE',
      discountPercentage: customer.tier_discount || tierInfo.discountPercentage,
      name: tierInfo.name,
      assignedAt: customer.tier_assigned_at || new Date(),
      reason: customer.tier_reason,
    };
  }

  private getTierInfoFromLevel(level: string): { name: string; discountPercentage: number } {
    const tierMap: Record<string, { name: string; discountPercentage: number }> = {
      BRONZE: { name: 'Bronze', discountPercentage: 0 },
      SILVER: { name: 'Silver', discountPercentage: 0.05 },
      GOLD: { name: 'Gold', discountPercentage: 0.10 },
      PLATINUM: { name: 'Platinum', discountPercentage: 0.15 },
    };

    return tierMap[level.toUpperCase()] || tierMap.BRONZE;
  }
}
