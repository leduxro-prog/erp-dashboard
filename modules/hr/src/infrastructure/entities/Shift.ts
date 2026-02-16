import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('shifts')
@Index(['code'])
@Index(['departmentId'])
export class ShiftEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'uuid' })
    departmentId!: string;

    @Column({ type: 'time' })
    startTime!: string;

    @Column({ type: 'time' })
    endTime!: string;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    hoursPerDay!: number;

    @Column({ type: 'integer', default: 5 })
    daysPerWeek!: number;

    @Column({ type: 'json', nullable: true })
    workDays!: string[];

    @Column({ type: 'boolean', default: false })
    allowOvertime!: boolean;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.5 })
    overtimeMultiplier!: number;

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
