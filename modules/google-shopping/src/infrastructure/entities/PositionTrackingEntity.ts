/**
 * Position Tracking Entity
 * Stores historical position metrics from Google Ads.
 * Used for trend analysis and competitor monitoring.
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('shopping_position_tracking')
@Index(['product_id', 'tracked_date'])
@Index(['campaign_id', 'tracked_date'])
export class PositionTrackingEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    product_id!: string | null;

    @Column({ type: 'varchar', length: 100 })
    campaign_id!: string;

    @Column({ type: 'varchar', length: 255 })
    campaign_name!: string;

    @Column({ type: 'date' })
    tracked_date!: Date;

    /**
     * Search Absolute Top Impression Share
     * Percentage of impressions shown in the absolute top position (first ad).
     */
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    search_absolute_top_is!: number;

    /**
     * Search Top Impression Share
     * Percentage of impressions shown anywhere above organic results.
     */
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    search_top_is!: number;

    /**
     * Total impressions for this period.
     */
    @Column({ type: 'integer', default: 0 })
    impressions!: number;

    /**
     * Total clicks for this period.
     */
    @Column({ type: 'integer', default: 0 })
    clicks!: number;

    /**
     * Click-through rate (calculated).
     */
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    ctr!: number;

    /**
     * Total cost in EUR.
     */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    cost!: number;

    /**
     * Total conversions.
     */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    conversions!: number;

    /**
     * Conversion value in EUR.
     */
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    conversion_value!: number;

    /**
     * Return on Ad Spend (conversion_value / cost).
     */
    @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
    roas!: number;

    @CreateDateColumn()
    created_at!: Date;
}

/**
 * Alert when position drops below threshold.
 */
@Entity('shopping_position_alerts')
@Index(['product_id', 'alert_date'])
export class PositionAlertEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    product_id!: string | null;

    @Column({ type: 'varchar', length: 100 })
    campaign_id!: string;

    @Column({ type: 'varchar', length: 100 })
    alert_type!: string; // 'POSITION_DROP', 'COMPETITOR_OVERTAKE', 'BUDGET_IMPACT'

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    previous_position_is!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    current_position_is!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    change_percentage!: number;

    @Column({ type: 'text', nullable: true })
    message!: string | null;

    @Column({ type: 'boolean', default: false })
    acknowledged!: boolean;

    @Column({ type: 'date' })
    alert_date!: Date;

    @CreateDateColumn()
    created_at!: Date;
}
