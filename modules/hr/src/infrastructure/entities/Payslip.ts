import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payslips')
@Index(['payrollRunId'])
@Index(['employeeId'])
@Index(['month', 'year'])
export class PayslipEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    payrollRunId!: string;

    @Column({ type: 'uuid' })
    payrollEntryId!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'varchar', length: 100 })
    employeeCode!: string;

    @Column({ type: 'varchar', length: 255 })
    employeeName!: string;

    @Column({ type: 'integer' })
    month!: number;

    @Column({ type: 'integer' })
    year!: number;

    @Column({ type: 'varchar', length: 50, unique: true })
    payslipNumber!: string;

    @Column({ type: 'date' })
    generatedDate!: Date;

    @Column({ type: 'text', nullable: true })
    pdfPath!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    baseSalary!: number;

    @Column({ type: 'json' })
    earnings!: {
        description: string;
        amount: number;
    }[];

    @Column({ type: 'json' })
    deductions!: {
        description: string;
        amount: number;
    }[];

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    grossSalary!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    totalDeductions!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    netSalary!: number;

    @Column({ type: 'varchar', length: 20, default: 'draft' })
    status!: 'draft' | 'generated' | 'sent' | 'viewed' | 'archived';

    @Column({ type: 'date', nullable: true })
    sentTo!: Date;

    @Column({ type: 'date', nullable: true })
    viewedAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
