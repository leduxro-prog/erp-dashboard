/**
 * Customer Loyalty Entity
 * Tracks customer loyalty points, tier, and lifetime activity.
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum LoyaltyTier {
    BRONZE = 'bronze',
    SILVER = 'silver',
    GOLD = 'gold',
    PLATINUM = 'platinum',
}

@Entity('customer_loyalty')
@Index(['customer_id'], { unique: true })
@Index(['tier'])
export class CustomerLoyaltyEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    customer_id!: string;

    @Column({ type: 'integer', default: 0 })
    points_balance!: number;

    @Column({ type: 'integer', default: 0 })
    lifetime_points_earned!: number;

    @Column({ type: 'integer', default: 0 })
    lifetime_points_redeemed!: number;

    @Column({
        type: 'enum',
        enum: LoyaltyTier,
        default: LoyaltyTier.BRONZE,
    })
    tier!: LoyaltyTier;

    @Column({ type: 'timestamp', nullable: true })
    tier_expiry_date!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    points_expiry_date!: Date | null;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}
