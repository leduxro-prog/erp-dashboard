/**
 * Cash Drawer Movement Entity
 * Tracks individual cash movements within a drawer session.
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum CashMovementType {
    SALE = 'sale',
    REFUND = 'refund',
    CASH_IN = 'cash_in',
    CASH_OUT = 'cash_out',
    OPENING = 'opening',
    CLOSING = 'closing',
}

@Entity('pos_cash_drawer_movements')
@Index(['session_id'])
@Index(['movement_type'])
@Index(['created_at'])
export class CashDrawerMovementEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    session_id!: string;

    @Column({
        type: 'enum',
        enum: CashMovementType,
    })
    movement_type!: CashMovementType;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    balance_after!: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    reference_type!: string | null; // 'order', 'manual'

    @Column({ type: 'varchar', length: 100, nullable: true })
    reference_id!: string | null;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @Column({ type: 'uuid' })
    created_by!: string;

    @CreateDateColumn()
    created_at!: Date;
}
