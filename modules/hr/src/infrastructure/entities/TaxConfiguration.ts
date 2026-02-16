import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('tax_configurations')
@Index(['country'])
@Index(['year'])
export class TaxConfigurationEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50 })
    country!: string;

    @Column({ type: 'integer' })
    year!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 25 })
    casRate!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
    cassRate!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
    incomeIncomeTaxRate!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    personalDeduction!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    taxExemptionThreshold!: number;

    @Column({ type: 'json', nullable: true })
    taxBrackets!: {
        minIncome: number;
        maxIncome: number | null;
        rate: number;
    }[];

    @Column({ type: 'json', nullable: true })
    allowances!: {
        name: string;
        amount: number;
        isTaxExempt: boolean;
    }[];

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    mealVoucherValue!: number;

    @Column({ type: 'boolean', default: true })
    isMealVoucherTaxExempt!: boolean;

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
