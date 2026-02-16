import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('employee_positions')
@Index(['code'])
@Index(['departmentId'])
export class EmployeePositionEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    code!: string;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'uuid' })
    departmentId!: string;

    @Column({ type: 'varchar', length: 50 })
    grade!: string;

    @Column({ type: 'varchar', length: 50 })
    level!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    baseSalary!: number;

    @Column({ type: 'integer', default: 0 })
    headcount!: number;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'archived';

    @Column({ type: 'text', nullable: true })
    responsibilities!: string;

    @Column({ type: 'text', nullable: true })
    requiredQualifications!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
