import { Repository, DataSource, Between } from 'typeorm';
import { AttendanceRecordEntity } from '../entities/AttendanceRecord';
import { AttendanceListQueryDTO } from '../../application/dtos/AttendanceDTO';

export class AttendanceRepository {
    private repository: Repository<AttendanceRecordEntity>;

    constructor(dataSource: DataSource) {
        this.repository = dataSource.getRepository(AttendanceRecordEntity);
    }

    async create(record: Partial<AttendanceRecordEntity>): Promise<AttendanceRecordEntity> {
        const newRecord = this.repository.create(record);
        return await this.repository.save(newRecord);
    }

    async findById(id: string): Promise<AttendanceRecordEntity | null> {
        return await this.repository.findOne({
            where: { id },
        });
    }

    async findByEmployeeAndDate(employeeId: string, date: Date): Promise<AttendanceRecordEntity | null> {
        return await this.repository.findOne({
            where: { employeeId, attendanceDate: date },
        });
    }

    async findList(query: AttendanceListQueryDTO): Promise<[AttendanceRecordEntity[], number]> {
        const qb = this.repository.createQueryBuilder('ar');

        if (query.employeeId) {
            qb.andWhere('ar.employeeId = :employeeId', { employeeId: query.employeeId });
        }

        if (query.startDate && query.endDate) {
            const startDate = new Date(query.startDate);
            const endDate = new Date(query.endDate);
            qb.andWhere('ar.attendanceDate BETWEEN :startDate AND :endDate', {
                startDate,
                endDate,
            });
        }

        if (query.status) {
            qb.andWhere('ar.status = :status', { status: query.status });
        }

        const sortBy = query.sortBy || 'attendanceDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`ar.${sortBy}`, sortOrder);

        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        qb.skip(skip).take(limit);

        return await qb.getManyAndCount();
    }

    async update(id: string, record: Partial<AttendanceRecordEntity>): Promise<AttendanceRecordEntity | null> {
        await this.repository.update(id, record);
        return await this.findById(id);
    }

    async getEmployeeAttendanceForMonth(employeeId: string, month: number, year: number): Promise<AttendanceRecordEntity[]> {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        return await this.repository.find({
            where: {
                employeeId,
                attendanceDate: Between(startDate, endDate),
            },
            order: { attendanceDate: 'ASC' },
        });
    }

    async getAttendanceStats(employeeId: string, startDate: Date, endDate: Date) {
        const records = await this.repository.find({
            where: {
                employeeId,
                attendanceDate: Between(startDate, endDate),
            },
        });

        const stats = {
            totalDays: records.length,
            present: records.filter((r) => r.status === 'present').length,
            absent: records.filter((r) => r.status === 'absent').length,
            late: records.filter((r) => r.status === 'late').length,
            leftEarly: records.filter((r) => r.status === 'left-early').length,
            totalOvertimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
        };

        return stats;
    }

    async getPendingApprovals(): Promise<AttendanceRecordEntity[]> {
        return await this.repository.find({
            where: { status: 'pending' },
            order: { attendanceDate: 'DESC' },
        });
    }
}
