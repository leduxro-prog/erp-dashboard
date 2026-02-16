import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('employment_history')
@Index(['employeeId'])
@Index(['startDate'])
export class EmploymentHistoryEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid' })
    positionId!: string;

    @Column({ type: 'uuid' })
    departmentId!: string;

    @Column({ type: 'uuid', nullable: true })
    managerId!: string;

    @Column({ type: 'varchar', length: 100 })
    positionTitle!: string;

    @Column({ type: 'varchar', length: 100 })
    departmentName!: string;

    @Column({ type: 'date' })
    startDate!: Date;

    @Column({ type: 'date', nullable: true })
    endDate!: Date;

    @Column({ type: 'varchar', length: 50 })
    employmentType!: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'intern';

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    baseSalary!: number;

    @Column({ type: 'text', nullable: true })
    reasonForChange!: string;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    status!: 'active' | 'archived';

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
