import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('leave_requests')
@Index(['employeeId'])
@Index(['leaveTypeId'])
@Index(['status'])
@Index(['startDate'])
export class LeaveRequestEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid' })
    leaveTypeId!: string;

    @Column({ type: 'date' })
    startDate!: Date;

    @Column({ type: 'date' })
    endDate!: Date;

    @Column({ type: 'decimal', precision: 6, scale: 2 })
    numberOfDays!: number;

    @Column({ type: 'text', nullable: true })
    reason!: string;

    @Column({ type: 'text', nullable: true })
    attachmentPath!: string;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'on-leave';

    @Column({ type: 'uuid', nullable: true })
    approvedBy!: string;

    @Column({ type: 'date', nullable: true })
    approvedAt!: Date;

    @Column({ type: 'text', nullable: true })
    approvalRemarks!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    approvalAttachmentPath!: string;

    @Column({ type: 'text', nullable: true })
    rejectionReason!: string;

    @Column({ type: 'uuid', nullable: true })
    reportingManagerId!: string;

    @Column({ type: 'boolean', default: false })
    isBackfill!: boolean;

    @Column({ type: 'uuid', nullable: true })
    backfillEmployeeId!: string;

    @CreateDateColumn()
    requestedAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
