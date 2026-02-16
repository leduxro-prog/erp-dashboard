import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payroll_runs')
@Index(['month'])
@Index(['year'])
@Index(['status'])
export class PayrollRunEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'integer' })
    month!: number;

    @Column({ type: 'integer' })
    year!: number;

    @Column({ type: 'date' })
    startDate!: Date;

    @Column({ type: 'date' })
    endDate!: Date;

    @Column({ type: 'date' })
    paymentDate!: Date;

    @Column({ type: 'varchar', length: 50, default: 'monthly' })
    frequency!: 'monthly' | 'bi-weekly' | 'weekly' | 'quarterly' | 'annually';

    @Column({ type: 'integer', default: 0 })
    totalEmployees!: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalGrossSalary!: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalNetSalary!: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalTax!: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalCAS!: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalCASSS!: number;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalDeductions!: number;

    @Column({ type: 'varchar', length: 50, default: 'draft' })
    status!: 'draft' | 'submitted' | 'approved' | 'processed' | 'paid' | 'cancelled';

    @Column({ type: 'uuid', nullable: true })
    approvedBy!: string;

    @Column({ type: 'date', nullable: true })
    approvedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    processedBy!: string;

    @Column({ type: 'date', nullable: true })
    processedAt!: Date;

    @Column({ type: 'text', nullable: true })
    remarks!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
