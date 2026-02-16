import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('leave_balances')
@Index(['employeeId', 'leaveTypeId'])
@Index(['year'])
export class LeaveBalanceEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid' })
    leaveTypeId!: string;

    @Column({ type: 'integer' })
    year!: number;

    @Column({ type: 'decimal', precision: 6, scale: 2 })
    allocatedDays!: number;

    @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
    usedDays!: number;

    @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
    carriedOverDays!: number;

    @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
    pendingDays!: number;

    @Column({ type: 'decimal', precision: 6, scale: 2 })
    get availableDays(): number {
        return this.allocatedDays + this.carriedOverDays - this.usedDays - this.pendingDays;
    }

    @Column({ type: 'date', nullable: true })
    lastUpdated!: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
