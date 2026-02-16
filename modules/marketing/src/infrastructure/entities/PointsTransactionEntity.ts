/**
 * Loyalty Points Transaction Entity
 * Tracks all points earned and redeemed.
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum PointsTransactionType {
    EARNED = 'earned',
    REDEEMED = 'redeemed',
    EXPIRED = 'expired',
    ADJUSTMENT = 'adjustment',
    BONUS = 'bonus',
}

@Entity('loyalty_points_transactions')
@Index(['customer_id'])
@Index(['created_at'])
@Index(['transaction_type'])
export class PointsTransactionEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    customer_id!: string;

    @Column({
        type: 'enum',
        enum: PointsTransactionType,
    })
    transaction_type!: PointsTransactionType;

    @Column({ type: 'integer' })
    points!: number;

    @Column({ type: 'integer' })
    balance_after!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    reference_type!: string | null; // 'order', 'campaign', 'manual'

    @Column({ type: 'varchar', length: 100, nullable: true })
    reference_id!: string | null;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'uuid', nullable: true })
    created_by!: string | null;

    @CreateDateColumn()
    created_at!: Date;
}
