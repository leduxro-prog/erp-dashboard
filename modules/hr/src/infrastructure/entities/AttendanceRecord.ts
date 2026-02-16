import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('attendance_records')
@Index(['employeeId'])
@Index(['attendanceDate'])
@Index(['status'])
export class AttendanceRecordEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'uuid', nullable: true })
    shiftId!: string;

    @Column({ type: 'date' })
    attendanceDate!: Date;

    @Column({ type: 'time', nullable: true })
    clockInTime!: string;

    @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
    clockInLatitude!: number;

    @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
    clockInLongitude!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    clockInLocation!: string;

    @Column({ type: 'time', nullable: true })
    clockOutTime!: string;

    @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
    clockOutLatitude!: number;

    @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
    clockOutLongitude!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    clockOutLocation!: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    hoursWorked!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    overtimeHours!: number;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status!: 'pending' | 'present' | 'absent' | 'late' | 'left-early' | 'approved' | 'rejected';

    @Column({ type: 'text', nullable: true })
    remarks!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    approvedBy!: string;

    @Column({ type: 'date', nullable: true })
    approvedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
