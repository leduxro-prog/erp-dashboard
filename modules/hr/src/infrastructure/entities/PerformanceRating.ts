import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('performance_ratings')
@Index(['reviewId'])
@Index(['kpiId'])
export class PerformanceRatingEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    reviewId!: string;

    @Column({ type: 'uuid' })
    kpiId!: string;

    @Column({ type: 'varchar', length: 255 })
    kpiName!: string;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    weightage!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    rating!: number;

    @Column({ type: 'text', nullable: true })
    feedback!: string;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: 'pending' | 'rated' | 'reviewed' | 'finalized';

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
