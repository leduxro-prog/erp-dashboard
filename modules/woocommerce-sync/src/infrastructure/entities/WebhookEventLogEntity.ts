/**
 * Webhook Event Log Entity
 * Tracks all received webhooks for idempotency and audit purposes.
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum WebhookStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    DEAD_LETTER = 'dead_letter',
}

@Entity('woocommerce_webhook_logs')
@Index(['webhook_id'], { unique: true })
@Index(['status'])
@Index(['created_at'])
export class WebhookEventLogEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 100 })
    webhook_id!: string;

    @Column({ type: 'varchar', length: 50 })
    topic!: string; // e.g., 'order.created', 'product.updated'

    @Column({ type: 'jsonb' })
    payload!: Record<string, any>;

    @Column({
        type: 'enum',
        enum: WebhookStatus,
        default: WebhookStatus.PENDING,
    })
    status!: WebhookStatus;

    @Column({ type: 'integer', default: 0 })
    retry_count!: number;

    @Column({ type: 'timestamp', nullable: true })
    last_retry_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    next_retry_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    error_message!: string | null;

    @Column({ type: 'boolean', default: false })
    signature_verified!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    processed_at!: Date | null;
}
