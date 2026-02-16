import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('salary_components')
@Index(['code'])
@Index(['type'])
export class SalaryComponentEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'varchar', length: 50 })
    type!: 'allowance' | 'deduction' | 'reimbursement';

    @Column({ type: 'varchar', length: 50 })
    category!: 'basic' | 'supplementary' | 'tax' | 'insurance' | 'other';

    @Column({ type: 'varchar', length: 50, default: 'fixed' })
    calculationType!: 'fixed' | 'percentage' | 'formula';

    @Column({ type: 'text', nullable: true })
    formula!: string;

    @Column({ type: 'boolean', default: false })
    affectsTaxableIncome!: boolean;

    @Column({ type: 'boolean', default: false })
    affectsSocialSecurity!: boolean;

    @Column({ type: 'boolean', default: false })
    isOptional!: boolean;

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
