/**
 * Loyalty Program Service
 * Manages customer loyalty points, tiers, and redemption.
 */

import { DataSource, Repository } from 'typeorm';
import { CustomerLoyaltyEntity, LoyaltyTier } from '../../infrastructure/entities/CustomerLoyaltyEntity';
import { PointsTransactionEntity, PointsTransactionType } from '../../infrastructure/entities/PointsTransactionEntity';

// Points earning rules
const POINTS_PER_CURRENCY = 1; // 1 point per 1 RON spent
const TIER_THRESHOLDS = {
    [LoyaltyTier.BRONZE]: 0,
    [LoyaltyTier.SILVER]: 1000,
    [LoyaltyTier.GOLD]: 5000,
    [LoyaltyTier.PLATINUM]: 15000,
};
const TIER_MULTIPLIERS = {
    [LoyaltyTier.BRONZE]: 1,
    [LoyaltyTier.SILVER]: 1.25,
    [LoyaltyTier.GOLD]: 1.5,
    [LoyaltyTier.PLATINUM]: 2,
};

export interface EarnPointsInput {
    customerId: string;
    orderTotal: number;
    orderId: string;
}

export interface RedeemPointsInput {
    customerId: string;
    points: number;
    orderId: string;
}

export class LoyaltyProgramService {
    private loyaltyRepo: Repository<CustomerLoyaltyEntity>;
    private transactionRepo: Repository<PointsTransactionEntity>;

    constructor(private dataSource: DataSource) {
        this.loyaltyRepo = dataSource.getRepository(CustomerLoyaltyEntity);
        this.transactionRepo = dataSource.getRepository(PointsTransactionEntity);
    }

    /**
     * Get or create customer loyalty record.
     */
    async getOrCreateCustomerLoyalty(customerId: string): Promise<CustomerLoyaltyEntity> {
        let loyalty = await this.loyaltyRepo.findOne({ where: { customer_id: customerId } });

        if (!loyalty) {
            loyalty = this.loyaltyRepo.create({
                customer_id: customerId,
                points_balance: 0,
                lifetime_points_earned: 0,
                lifetime_points_redeemed: 0,
                tier: LoyaltyTier.BRONZE,
                is_active: true,
            });
            loyalty = await this.loyaltyRepo.save(loyalty);
        }

        return loyalty;
    }

    /**
     * Calculate points to earn from order.
     */
    calculatePointsFromOrder(orderTotal: number, tier: LoyaltyTier): number {
        const basePoints = Math.floor(orderTotal * POINTS_PER_CURRENCY);
        const multiplier = TIER_MULTIPLIERS[tier];
        return Math.floor(basePoints * multiplier);
    }

    /**
     * Earn points from an order.
     */
    async earnPoints(input: EarnPointsInput): Promise<PointsTransactionEntity> {
        const loyalty = await this.getOrCreateCustomerLoyalty(input.customerId);
        const pointsToEarn = this.calculatePointsFromOrder(input.orderTotal, loyalty.tier);

        const newBalance = loyalty.points_balance + pointsToEarn;
        const newLifetimeEarned = loyalty.lifetime_points_earned + pointsToEarn;

        // Update loyalty balance
        await this.loyaltyRepo.update(loyalty.id, {
            points_balance: newBalance,
            lifetime_points_earned: newLifetimeEarned,
        });

        // Check for tier upgrade
        await this.checkAndUpgradeTier(input.customerId, newLifetimeEarned);

        // Create transaction record
        const transaction = this.transactionRepo.create({
            customer_id: input.customerId,
            transaction_type: PointsTransactionType.EARNED,
            points: pointsToEarn,
            balance_after: newBalance,
            reference_type: 'order',
            reference_id: input.orderId,
            description: `Points earned from order ${input.orderId}`,
        });

        return await this.transactionRepo.save(transaction);
    }

    /**
     * Redeem points for discount.
     */
    async redeemPoints(input: RedeemPointsInput): Promise<{ success: boolean; discountAmount: number; error?: string }> {
        const loyalty = await this.getOrCreateCustomerLoyalty(input.customerId);

        if (loyalty.points_balance < input.points) {
            return {
                success: false,
                discountAmount: 0,
                error: `Insufficient points. Available: ${loyalty.points_balance}`
            };
        }

        const newBalance = loyalty.points_balance - input.points;
        const newLifetimeRedeemed = loyalty.lifetime_points_redeemed + input.points;

        // 100 points = 1 RON discount
        const discountAmount = input.points / 100;

        // Update loyalty balance
        await this.loyaltyRepo.update(loyalty.id, {
            points_balance: newBalance,
            lifetime_points_redeemed: newLifetimeRedeemed,
        });

        // Create transaction record
        await this.transactionRepo.save(
            this.transactionRepo.create({
                customer_id: input.customerId,
                transaction_type: PointsTransactionType.REDEEMED,
                points: -input.points,
                balance_after: newBalance,
                reference_type: 'order',
                reference_id: input.orderId,
                description: `Points redeemed for ${discountAmount} RON discount`,
            })
        );

        return { success: true, discountAmount };
    }

    /**
     * Check and upgrade customer tier based on lifetime points.
     */
    async checkAndUpgradeTier(customerId: string, lifetimePoints: number): Promise<LoyaltyTier> {
        let newTier = LoyaltyTier.BRONZE;

        if (lifetimePoints >= TIER_THRESHOLDS[LoyaltyTier.PLATINUM]) {
            newTier = LoyaltyTier.PLATINUM;
        } else if (lifetimePoints >= TIER_THRESHOLDS[LoyaltyTier.GOLD]) {
            newTier = LoyaltyTier.GOLD;
        } else if (lifetimePoints >= TIER_THRESHOLDS[LoyaltyTier.SILVER]) {
            newTier = LoyaltyTier.SILVER;
        }

        await this.loyaltyRepo.update(
            { customer_id: customerId },
            { tier: newTier }
        );

        return newTier;
    }

    /**
     * Get customer loyalty summary.
     */
    async getCustomerLoyaltySummary(customerId: string) {
        const loyalty = await this.getOrCreateCustomerLoyalty(customerId);
        const recentTransactions = await this.transactionRepo.find({
            where: { customer_id: customerId },
            order: { created_at: 'DESC' },
            take: 10,
        });

        return {
            customerId,
            pointsBalance: loyalty.points_balance,
            tier: loyalty.tier,
            tierMultiplier: TIER_MULTIPLIERS[loyalty.tier],
            lifetimePointsEarned: loyalty.lifetime_points_earned,
            lifetimePointsRedeemed: loyalty.lifetime_points_redeemed,
            pointsToNextTier: this.getPointsToNextTier(loyalty.tier, loyalty.lifetime_points_earned),
            recentTransactions,
        };
    }

    /**
     * Calculate points needed for next tier.
     */
    private getPointsToNextTier(currentTier: LoyaltyTier, lifetimePoints: number): number | null {
        const tierOrder = [LoyaltyTier.BRONZE, LoyaltyTier.SILVER, LoyaltyTier.GOLD, LoyaltyTier.PLATINUM];
        const currentIndex = tierOrder.indexOf(currentTier);

        if (currentIndex >= tierOrder.length - 1) {
            return null; // Already at max tier
        }

        const nextTier = tierOrder[currentIndex + 1];
        return TIER_THRESHOLDS[nextTier] - lifetimePoints;
    }
}
