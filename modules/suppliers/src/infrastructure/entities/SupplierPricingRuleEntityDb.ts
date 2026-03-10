import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('supplier_pricing_rules')
@Index(['supplierCode', 'categoryKey'], { unique: true })
@Index(['supplierCode'])
@Index(['active'])
export class SupplierPricingRuleEntityDb {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
  supplierCode!: string;

  @Column({ name: 'category_key', type: 'varchar', length: 255 })
  categoryKey!: string;

  @Column({ name: 'markup_percent', type: 'numeric', precision: 7, scale: 2 })
  markupPercent!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
