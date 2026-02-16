import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('wc_product_sync_mappings')
@Index(['internalProductId'])
@Index(['wooCommerceProductId'])
@Index(['syncStatus'])
@Unique(['internalProductId'])
@Unique(['wooCommerceProductId'])
export class ProductSyncMappingEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  internalProductId!: string;

  @Column('integer')
  wooCommerceProductId!: number;

  @Column('timestamp')
  lastSynced!: Date;

  @Column('varchar')
  syncStatus!: 'in_sync' | 'out_of_sync' | 'error';

  @Column('text', { nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
