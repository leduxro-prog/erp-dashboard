import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  ProformaStatus,
  SmartBillApiProformaStatus,
} from '../../domain/entities/SmartBillProforma';

@Entity('smartbill_proformas')
@Index('idx_order_id', ['orderId'])
@Index('idx_smartbill_id', ['smartBillId'])
@Index('idx_status', ['status'])
@Index('idx_smartbill_status', ['smartBillStatus'])
export class SmartBillProformaEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('varchar')
  orderId!: string;

  @Column('bigint', { nullable: true })
  quoteId!: number | null;

  @Column('varchar', { nullable: true })
  smartBillId!: string | null;

  @Column('varchar', { nullable: true })
  proformaNumber!: string | null;

  @Column('varchar', { default: 'PF' })
  series!: string;

  @Column('varchar')
  customerName!: string;

  @Column('varchar')
  customerVat!: string;

  @Column('simple-json')
  items!: any[];

  @Column('decimal', { precision: 10, scale: 2 })
  totalWithoutVat!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  vatAmount!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalWithVat!: number;

  @Column('varchar', { default: 'RON' })
  currency!: string;

  @Column({ type: 'varchar', default: 'draft' })
  status!: ProformaStatus;

  @Column({ type: 'varchar', nullable: true })
  smartBillStatus!: SmartBillApiProformaStatus | null;

  @Column('timestamp')
  issueDate!: Date;

  @Column('timestamp')
  dueDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  updateSmartBillStatus(status: SmartBillApiProformaStatus) {
    this.smartBillStatus = status;
  }
}
