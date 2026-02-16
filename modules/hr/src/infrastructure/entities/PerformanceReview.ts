import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('performance_reviews')
@Index(['employeeId'])
@Index(['reviewerId'])
@Index(['status'])
export class PerformanceReviewEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid' })
    reviewerId!: string;

    @Column({ type: 'varchar', length: 50 })
    reviewType!: 'annual' | 'quarterly' | 'probation' | '360-degree' | 'mid-year';

    @Column({ type: 'integer' })
    reviewYear!: number;

    @Column({ type: 'integer', nullable: true })
    reviewQuarter!: number;

    @Column({ type: 'date' })
    startDate!: Date;

    @Column({ type: 'date' })
    endDate!: Date;

    @Column({ type: 'date', nullable: true })
    reviewDate!: Date;

    @Column({ type: 'text', nullable: true })
    overallComments!: string;

    @Column({ type: 'text', nullable: true })
    strengthsIdentified!: string;

    @Column({ type: 'text', nullable: true })
    areasForImprovement!: string;

    @Column({ type: 'text', nullable: true })
    developmentPlan!: string;

    @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
    overallRating!: number;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: 'pending' | 'in-progress' | 'completed' | 'submitted' | 'approved' | 'archived';

    @Column({ type: 'uuid', nullable: true })
    approvedBy!: string;

    @Column({ type: 'date', nullable: true })
    approvedAt!: Date;

    @Column({ type: 'boolean', default: false })
    employeeAcknowledged!: boolean;

    @Column({ type: 'date', nullable: true })
    acknowledgedAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
