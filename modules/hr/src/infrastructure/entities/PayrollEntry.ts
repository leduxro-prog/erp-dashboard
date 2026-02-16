import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payroll_entries')
@Index(['payrollRunId'])
@Index(['employeeId'])
@Index(['status'])
export class PayrollEntryEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    payrollRunId!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid' })
    salaryStructureId!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    baseSalary!: number;

    @Column({ type: 'json' })
    allowances!: {
        name: string;
        code: string;
        amount: number;
    }[];

    @Column({ type: 'json' })
    deductions!: {
        name: string;
        code: string;
        amount: number;
    }[];

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    grossSalary!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    cas!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    casss!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    incomeTax!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    totalTax!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    totalDeductions!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    netSalary!: number;

    @Column({ type: 'integer', default: 0 })
    workingDays!: number;

    @Column({ type: 'integer', default: 0 })
    absentDays!: number;

    @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
    overtimeHours!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    overtimeAmount!: number;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';

    @Column({ type: 'uuid', nullable: true })
    approvedBy!: string;

    @Column({ type: 'date', nullable: true })
    approvedAt!: Date;

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
