import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('leave_types')
@Index(['code'])
export class LeaveTypeEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'decimal', precision: 6, scale: 2 })
    defaultDaysPerYear!: number;

    @Column({ type: 'boolean', default: true })
    requiresApproval!: boolean;

    @Column({ type: 'boolean', default: false })
    paidLeave!: boolean;

    @Column({ type: 'integer', default: 0 })
    maxConsecutiveDays!: number;

    @Column({ type: 'boolean', default: false })
    carryOverAllowed!: boolean;

    @Column({ type: 'integer', default: 0 })
    maxCarryOverDays!: number;

    @Column({ type: 'integer', default: 0 })
    minimumNoticeDays!: number;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'archived';

    @Column({ type: 'integer', default: 0 })
    displayOrder!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
