import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('workflow_analytics')
@Index(['templateId', 'entityType'])
@Index(['recordedAt'])
export class WorkflowAnalyticsEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  templateId!: string;

  @Column('varchar', { length: 100 })
  entityType!: string;

  @Column('varchar')
  instanceId!: string;

  @Column('varchar')
  stepId!: string;

  @Column('int')
  totalApprovals!: number;

  @Column('int')
  totalRejections!: number;

  @Column('int')
  escalationCount!: number;

  @Column('bigint')
  durationMs!: number;

  @Column('timestamp')
  completedAt!: Date;

  @Column('varchar', {
    length: 50,
    enum: ['approved', 'rejected', 'cancelled'],
  } as any)
  outcome!: string;

  @CreateDateColumn()
  recordedAt!: Date;
}
