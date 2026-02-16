import { Repository, DataSource, Between, In } from 'typeorm';
import { LeaveRequestEntity } from '../entities/LeaveRequest';
import { LeaveBalanceEntity } from '../entities/LeaveBalance';
import { LeaveRequestListQueryDTO } from '../../application/dtos/LeaveDTO';

export class LeaveRepository {
    private leaveRequestRepository: Repository<LeaveRequestEntity>;
    private leaveBalanceRepository: Repository<LeaveBalanceEntity>;

    constructor(dataSource: DataSource) {
        this.leaveRequestRepository = dataSource.getRepository(LeaveRequestEntity);
        this.leaveBalanceRepository = dataSource.getRepository(LeaveBalanceEntity);
    }

    async createLeaveRequest(request: Partial<LeaveRequestEntity>): Promise<LeaveRequestEntity> {
        const newRequest = this.leaveRequestRepository.create(request);
        return await this.leaveRequestRepository.save(newRequest);
    }

    async findLeaveRequestById(id: string): Promise<LeaveRequestEntity | null> {
        return await this.leaveRequestRepository.findOne({
            where: { id },
        });
    }

    async findLeaveRequests(query: LeaveRequestListQueryDTO): Promise<[LeaveRequestEntity[], number]> {
        const qb = this.leaveRequestRepository.createQueryBuilder('lr');

        if (query.employeeId) {
            qb.andWhere('lr.employeeId = :employeeId', { employeeId: query.employeeId });
        }

        if (query.leaveTypeId) {
            qb.andWhere('lr.leaveTypeId = :leaveTypeId', { leaveTypeId: query.leaveTypeId });
        }

        if (query.status) {
            qb.andWhere('lr.status = :status', { status: query.status });
        }

        if (query.startDate) {
            qb.andWhere('lr.startDate >= :startDate', { startDate: query.startDate });
        }

        if (query.endDate) {
            qb.andWhere('lr.endDate <= :endDate', { endDate: query.endDate });
        }

        const sortBy = query.sortBy || 'startDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`lr.${sortBy}`, sortOrder);

        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        qb.skip(skip).take(limit);

        return await qb.getManyAndCount();
    }

    async updateLeaveRequest(
        id: string,
        request: Partial<LeaveRequestEntity>
    ): Promise<LeaveRequestEntity | null> {
        await this.leaveRequestRepository.update(id, request);
        return await this.findLeaveRequestById(id);
    }

    async getLeaveBalance(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalanceEntity | null> {
        return await this.leaveBalanceRepository.findOne({
            where: { employeeId, leaveTypeId, year },
        });
    }

    async createOrUpdateLeaveBalance(balance: Partial<LeaveBalanceEntity>): Promise<LeaveBalanceEntity> {
        const existing = await this.leaveBalanceRepository.findOne({
            where: {
                employeeId: balance.employeeId,
                leaveTypeId: balance.leaveTypeId,
                year: balance.year,
            },
        });

        if (existing) {
            await this.leaveBalanceRepository.update(existing.id, balance);
            return (await this.leaveBalanceRepository.findOne({
                where: { id: existing.id },
            }))!;
        }

        const newBalance = this.leaveBalanceRepository.create(balance);
        return await this.leaveBalanceRepository.save(newBalance);
    }

    async getEmployeeLeaveBalances(employeeId: string, year: number): Promise<LeaveBalanceEntity[]> {
        return await this.leaveBalanceRepository.find({
            where: { employeeId, year },
        });
    }

    async getLeaveRequestsByDateRange(
        employeeId: string,
        startDate: Date,
        endDate: Date
    ): Promise<LeaveRequestEntity[]> {
        return await this.leaveRequestRepository.find({
            where: {
                employeeId,
                startDate: Between(startDate, endDate),
                status: In(['approved', 'on-leave']),
            },
        });
    }

    async getPendingLeaveRequests(reportingManagerId: string): Promise<LeaveRequestEntity[]> {
        return await this.leaveRequestRepository.find({
            where: {
                reportingManagerId,
                status: 'pending',
            },
            order: { requestedAt: 'ASC' },
        });
    }
}
