import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('goods_receipt_notes')
@Index('idx_grn_number_unique', ['grnNumber'], { unique: true })
@Index('idx_grn_po_status', ['poId', 'status'])
export class GoodsReceiptNoteEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 64 })
  grnNumber!: string;

  @Column('varchar', { length: 64 })
  poId!: string;

  @Column('varchar', { length: 64 })
  vendorId!: string;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('timestamptz', { nullable: true })
  receiveDate!: Date | null;

  @Column('jsonb', { default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
