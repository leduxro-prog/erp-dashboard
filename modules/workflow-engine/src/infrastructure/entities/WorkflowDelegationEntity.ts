import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('workflow_delegations')
@Index(['fromUserId', 'toUserId'])
@Index(['workflowStepId'])
@Index(['expiresAt'])
export class WorkflowDelegationEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  fromUserId!: string;

  @Column('varchar')
  toUserId!: string;

  @Column('varchar')
  workflowStepId!: string;

  @Column('text', { nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column('timestamp')
  expiresAt!: Date;

  @Column('boolean', { default: true })
  isActive!: boolean;
}
