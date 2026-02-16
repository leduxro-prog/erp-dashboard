/**
 * Offline Queue Service
 * Handles queueing of offline POS transactions for later sync.
 */

import { DataSource, Repository } from 'typeorm';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum OfflineQueueStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SYNCED = 'synced',
    FAILED = 'failed',
}

@Entity('offline_transaction_queue')
@Index(['terminal_id'])
@Index(['status'])
@Index(['created_at'])
export class OfflineTransactionQueueEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50 })
    terminal_id!: string;

    @Column({ type: 'varchar', length: 100 })
    transaction_id!: string;

    @Column({ type: 'varchar', length: 50 })
    transaction_type!: string; // 'order', 'refund', 'adjustment'

    @Column({ type: 'jsonb' })
    payload!: Record<string, any>;

    @Column({
        type: 'enum',
        enum: OfflineQueueStatus,
        default: OfflineQueueStatus.PENDING,
    })
    status!: OfflineQueueStatus;

    @Column({ type: 'timestamp' })
    offline_timestamp!: Date;

    @Column({ type: 'timestamp', nullable: true })
    synced_at!: Date | null;

    @Column({ type: 'integer', default: 0 })
    retry_count!: number;

    @Column({ type: 'text', nullable: true })
    error_message!: string | null;

    @CreateDateColumn()
    created_at!: Date;
}

export interface QueueTransactionInput {
    terminalId: string;
    transactionId: string;
    transactionType: string;
    payload: Record<string, any>;
    offlineTimestamp: Date;
}

export class OfflineQueueService {
    private queueRepo: Repository<OfflineTransactionQueueEntity>;

    constructor(private dataSource: DataSource) {
        this.queueRepo = dataSource.getRepository(OfflineTransactionQueueEntity);
    }

    /**
     * Queue a transaction for offline processing.
     */
    async queueTransaction(input: QueueTransactionInput): Promise<OfflineTransactionQueueEntity> {
        const entry = this.queueRepo.create({
            terminal_id: input.terminalId,
            transaction_id: input.transactionId,
            transaction_type: input.transactionType,
            payload: input.payload,
            offline_timestamp: input.offlineTimestamp,
            status: OfflineQueueStatus.PENDING,
        });

        return await this.queueRepo.save(entry);
    }

    /**
     * Get pending transactions for a terminal.
     */
    async getPendingTransactions(terminalId?: string): Promise<OfflineTransactionQueueEntity[]> {
        const query = this.queueRepo.createQueryBuilder('q')
            .where('q.status = :status', { status: OfflineQueueStatus.PENDING })
            .orderBy('q.offline_timestamp', 'ASC');

        if (terminalId) {
            query.andWhere('q.terminal_id = :terminalId', { terminalId });
        }

        return await query.getMany();
    }

    /**
     * Mark transaction as processing.
     */
    async markProcessing(id: string): Promise<void> {
        await this.queueRepo.update(id, { status: OfflineQueueStatus.PROCESSING });
    }

    /**
     * Mark transaction as synced.
     */
    async markSynced(id: string): Promise<void> {
        await this.queueRepo.update(id, {
            status: OfflineQueueStatus.SYNCED,
            synced_at: new Date(),
        });
    }

    /**
     * Mark transaction as failed.
     */
    async markFailed(id: string, error: string): Promise<void> {
        const entry = await this.queueRepo.findOne({ where: { id } });
        if (entry) {
            await this.queueRepo.update(id, {
                status: OfflineQueueStatus.FAILED,
                retry_count: entry.retry_count + 1,
                error_message: error,
            });
        }
    }

    /**
     * Get queue status summary.
     */
    async getQueueStatus(terminalId?: string) {
        const query = this.queueRepo.createQueryBuilder('q')
            .select('q.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('q.status');

        if (terminalId) {
            query.where('q.terminal_id = :terminalId', { terminalId });
        }

        const results = await query.getRawMany();
        const lastSynced = await this.queueRepo.findOne({
            where: { status: OfflineQueueStatus.SYNCED },
            order: { synced_at: 'DESC' },
        });

        return {
            counts: results.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.count) }), {}),
            lastSyncedAt: lastSynced?.synced_at || null,
        };
    }
}
