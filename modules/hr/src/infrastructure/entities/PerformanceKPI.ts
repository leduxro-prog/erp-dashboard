import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('performance_kpis')
@Index(['employeeId'])
@Index(['positionId'])
@Index(['year'])
export class PerformanceKPIEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid' })
    positionId!: string;

    @Column({ type: 'varchar', length: 255 })
    kpiName!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'varchar', length: 50 })
    kpiType!: 'qualitative' | 'quantitative' | 'behavioral';

    @Column({ type: 'integer' })
    year!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    weightage!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    targetValue!: number;

    @Column({ type: 'varchar', length: 50, nullable: true })
    unit!: string;

    @Column({ type: 'date', nullable: true })
    startDate!: Date;

    @Column({ type: 'date', nullable: true })
    endDate!: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    achievedValue!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    achievementPercentage!: number;

    @Column({ type: 'varchar', length: 50, default: 'not-started' })
    status!: 'not-started' | 'in-progress' | 'completed' | 'achieved' | 'not-achieved' | 'on-hold';

    @Column({ type: 'text', nullable: true })
    remarks!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
