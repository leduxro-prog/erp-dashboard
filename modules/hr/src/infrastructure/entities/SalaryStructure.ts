import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('salary_structures')
@Index(['positionId'])
@Index(['status'])
export class SalaryStructureEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    positionId!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'date' })
    effectiveFrom!: Date;

    @Column({ type: 'date', nullable: true })
    effectiveTo!: Date;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    baseSalary!: number;

    @Column({ type: 'json', nullable: true })
    allowances!: {
        name: string;
        amount: number;
        type: 'fixed' | 'percentage';
        description?: string;
    }[];

    @Column({ type: 'json', nullable: true })
    deductions!: {
        name: string;
        amount: number;
        type: 'fixed' | 'percentage';
        description?: string;
    }[];

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'archived';

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
