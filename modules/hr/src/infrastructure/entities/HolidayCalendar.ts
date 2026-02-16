import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('holiday_calendar')
@Index(['date'])
@Index(['status'])
export class HolidayCalendarEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'date', unique: true })
    date!: Date;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'varchar', length: 50 })
    type!: 'national' | 'company' | 'regional' | 'optional';

    @Column({ type: 'boolean', default: true })
    isMandatory!: boolean;

    @Column({ type: 'uuid', nullable: true })
    departmentId!: string;

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
