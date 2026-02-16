/**
 * Cash Drawer Session Entity
 * Tracks POS cash drawer sessions (open/close with amounts).
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum DrawerSessionStatus {
    OPEN = 'open',
    CLOSED = 'closed',
    SUSPENDED = 'suspended',
}

@Entity('pos_cash_drawer_sessions')
@Index(['terminal_id'])
@Index(['status'])
@Index(['opened_at'])
export class CashDrawerSessionEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50 })
    terminal_id!: string;

    @Column({ type: 'uuid' })
    opened_by!: string;

    @Column({ type: 'uuid', nullable: true })
    closed_by!: string | null;

    @Column({
        type: 'enum',
        enum: DrawerSessionStatus,
        default: DrawerSessionStatus.OPEN,
    })
    status!: DrawerSessionStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    opening_amount!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    cash_sales_total!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    cash_refunds_total!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    cash_in_total!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    cash_out_total!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    expected_closing_amount!: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    actual_closing_amount!: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    variance!: number | null;

    @Column({ type: 'text', nullable: true })
    variance_notes!: string | null;

    @CreateDateColumn()
    opened_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    closed_at!: Date | null;

    @UpdateDateColumn()
    updated_at!: Date;
}
