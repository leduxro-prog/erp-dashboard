import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupplierEntityDb } from './SupplierEntityDb';

@Entity('supplier_orders')
@Index(['supplierId'])
@Index(['orderId'])
@Index(['status'])
@Index(['createdAt'])
export class SupplierOrderEntityDb {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  supplierId!: number;

  @ManyToOne(() => SupplierEntityDb, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier!: SupplierEntityDb;

  @Column({ type: 'int', nullable: true })
  orderId!: number | null;

  @Column({ type: 'json' })
  items!: Array<{
    supplierSku: string;
    internalSku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: 'pending' | 'sent' | 'confirmed' | 'delivered' | 'cancelled';

  @Column({ type: 'text' })
  whatsappMessageTemplate!: string;

  @Column({ type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
