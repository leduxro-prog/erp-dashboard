import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('purchase_orders')
@Index('idx_po_number_unique', ['poNumber'], { unique: true })
@Index('idx_po_vendor_status', ['vendorId', 'status'])
export class PurchaseOrderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 64 })
  poNumber!: string;

  @Column('varchar', { length: 64, nullable: true })
  requisitionId!: string | null;

  @Column('varchar', { length: 64 })
  vendorId!: string;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('varchar', { length: 32 })
  type!: string;

  @Column('timestamptz', { nullable: true })
  requiredByDate!: Date | null;

  @Column('jsonb', { default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
