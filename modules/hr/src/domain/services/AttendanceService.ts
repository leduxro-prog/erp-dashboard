import { AttendanceRepository } from '../../infrastructure/repositories/AttendanceRepository';
import { AttendanceRecordEntity } from '../../infrastructure/entities/AttendanceRecord';
import { ClockInDTO, ClockOutDTO, AttendanceListQueryDTO, AttendanceReportDTO } from '../../application/dtos/AttendanceDTO';

export class AttendanceService {
    constructor(private attendanceRepository: AttendanceRepository) {}

    async clockIn(dto: ClockInDTO, createdBy: string): Promise<AttendanceRecordEntity> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await this.attendanceRepository.findByEmployeeAndDate(dto.employeeId, today);

        if (existing && existing.clockInTime) {
            throw new Error('Employee already clocked in today');
        }

        if (existing) {
            return (await this.attendanceRepository.update(existing.id, {
                clockInTime: this.getCurrentTimeString(),
                clockInLatitude: dto.latitude,
                clockInLongitude: dto.longitude,
                clockInLocation: dto.location,
                status: 'present',
                updatedBy: createdBy,
            }))!;
        }

        return await this.attendanceRepository.create({
            employeeId: dto.employeeId,
            attendanceDate: today,
            clockInTime: this.getCurrentTimeString(),
            clockInLatitude: dto.latitude,
            clockInLongitude: dto.longitude,
            clockInLocation: dto.location,
            status: 'present',
            createdBy,
        });
    }

    async clockOut(dto: ClockOutDTO, updatedBy: string): Promise<AttendanceRecordEntity> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const record = await this.attendanceRepository.findByEmployeeAndDate(dto.employeeId, today);

        if (!record) {
            throw new Error('No clock-in record found for today');
        }

        if (record.clockOutTime) {
            throw new Error('Employee already clocked out today');
        }

        const hoursWorked = this.calculateHoursWorked(record.clockInTime!, this.getCurrentTimeString());

        return (await this.attendanceRepository.update(record.id, {
            clockOutTime: this.getCurrentTimeString(),
            clockOutLatitude: dto.latitude,
            clockOutLongitude: dto.longitude,
            clockOutLocation: dto.location,
            hoursWorked,
            status: 'approved',
            updatedBy,
        }))!;
    }

    async getAttendanceRecord(id: string): Promise<AttendanceRecordEntity> {
        const record = await this.attendanceRepository.findById(id);
        if (!record) {
            throw new Error(`Attendance record ${id} not found`);
        }
        return record;
    }

    async listAttendanceRecords(query: AttendanceListQueryDTO): Promise<{ data: AttendanceRecordEntity[]; total: number }> {
        const [records, total] = await this.attendanceRepository.findList(query);
        return { data: records, total };
    }

    async getAttendanceReport(employeeId: string, month: number, year: number): Promise<AttendanceReportDTO> {
        const records = await this.attendanceRepository.getEmployeeAttendanceForMonth(employeeId, month, year);

        const stats = records.reduce(
            (acc, record) => {
                acc.totalWorkingDays++;
                if (record.status === 'present' || record.status === 'approved') {
                    acc.presentDays++;
                } else if (record.status === 'absent') {
                    acc.absentDays++;
                } else if (record.status === 'late') {
                    acc.lateDays++;
                } else if (record.status === 'left-early') {
                    acc.leftEarlyDays++;
                }
                acc.totalOvertimeHours += record.overtimeHours || 0;
                return acc;
            },
            {
                totalWorkingDays: 0,
                presentDays: 0,
                absentDays: 0,
                lateDays: 0,
                leftEarlyDays: 0,
                totalOvertimeHours: 0,
            }
        );

        const attendancePercentage =
            stats.totalWorkingDays > 0 ? (stats.presentDays / stats.totalWorkingDays) * 100 : 0;

        return {
            employeeId,
            employeeName: '',
            month,
            year,
            ...stats,
            attendancePercentage: Math.round(attendancePercentage * 100) / 100,
        };
    }

    async getMonthlyStats(employeeId: string, month: number, year: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        return await this.attendanceRepository.getAttendanceStats(employeeId, startDate, endDate);
    }

    async getPendingApprovals(): Promise<AttendanceRecordEntity[]> {
        return await this.attendanceRepository.getPendingApprovals();
    }

    async approveAttendance(id: string, approvedBy: string): Promise<AttendanceRecordEntity> {
        const record = await this.getAttendanceRecord(id);

        return (await this.attendanceRepository.update(id, {
            status: 'approved',
            approvedBy,
            approvedAt: new Date(),
            updatedBy: approvedBy,
        }))!;
    }

    private getCurrentTimeString(): string {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    private calculateHoursWorked(startTime: string, endTime: string): number {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);

        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;

        const diffMinutes = endTotalMinutes - startTotalMinutes;
        return Math.round((diffMinutes / 60) * 100) / 100;
    }
}
