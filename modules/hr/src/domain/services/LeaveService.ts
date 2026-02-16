import { LeaveRepository } from '../../infrastructure/repositories/LeaveRepository';
import { LeaveRequestEntity } from '../../infrastructure/entities/LeaveRequest';
import { LeaveBalanceEntity } from '../../infrastructure/entities/LeaveBalance';
import {
    CreateLeaveRequestDTO,
    UpdateLeaveRequestDTO,
    ApproveLeaveRequestDTO,
    RejectLeaveRequestDTO,
    LeaveRequestListQueryDTO,
} from '../../application/dtos/LeaveDTO';

export class LeaveService {
    constructor(private leaveRepository: LeaveRepository) {}

    async createLeaveRequest(dto: CreateLeaveRequestDTO, createdBy: string): Promise<LeaveRequestEntity> {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (startDate > endDate) {
            throw new Error('Start date must be before end date');
        }

        const balance = await this.leaveRepository.getLeaveBalance(
            dto.employeeId,
            dto.leaveTypeId,
            startDate.getFullYear()
        );

        if (!balance) {
            throw new Error('No leave balance found for this leave type and year');
        }

        if (balance.availableDays < dto.numberOfDays) {
            throw new Error(`Insufficient leave balance. Available: ${balance.availableDays} days`);
        }

        const request = await this.leaveRepository.createLeaveRequest({
            ...dto,
            startDate,
            endDate,
            status: 'pending',
            createdBy,
        });

        await this.leaveRepository.createOrUpdateLeaveBalance({
            ...balance,
            pendingDays: balance.pendingDays + dto.numberOfDays,
        });

        return request;
    }

    async getLeaveRequest(id: string): Promise<LeaveRequestEntity> {
        const request = await this.leaveRepository.findLeaveRequestById(id);
        if (!request) {
            throw new Error(`Leave request ${id} not found`);
        }
        return request;
    }

    async updateLeaveRequest(id: string, dto: UpdateLeaveRequestDTO, updatedBy: string): Promise<LeaveRequestEntity> {
        const request = await this.getLeaveRequest(id);

        if (request.status !== 'pending') {
            throw new Error('Can only update pending leave requests');
        }

        const updateData: any = { ...dto, updatedBy };

        if (dto.startDate || dto.endDate) {
            const startDate = dto.startDate ? new Date(dto.startDate) : request.startDate;
            const endDate = dto.endDate ? new Date(dto.endDate) : request.endDate;

            if (startDate > endDate) {
                throw new Error('Start date must be before end date');
            }

            updateData.startDate = startDate;
            updateData.endDate = endDate;
        }

        return (await this.leaveRepository.updateLeaveRequest(id, updateData))!;
    }

    async approveLeaveRequest(id: string, dto: ApproveLeaveRequestDTO, approvedBy: string): Promise<LeaveRequestEntity> {
        const request = await this.getLeaveRequest(id);

        if (request.status !== 'pending') {
            throw new Error('Can only approve pending leave requests');
        }

        const balance = await this.leaveRepository.getLeaveBalance(
            request.employeeId,
            request.leaveTypeId,
            request.startDate.getFullYear()
        );

        if (balance && balance.availableDays < request.numberOfDays) {
            throw new Error(`Insufficient leave balance at approval time`);
        }

        const approved = await this.leaveRepository.updateLeaveRequest(id, {
            status: 'approved',
            approvedBy,
            approvedAt: new Date(),
            approvalRemarks: dto.approvalRemarks,
            approvalAttachmentPath: dto.approvalAttachmentPath,
            updatedBy: approvedBy,
        });

        if (balance) {
            await this.leaveRepository.createOrUpdateLeaveBalance({
                ...balance,
                pendingDays: balance.pendingDays - request.numberOfDays,
            });
        }

        return approved!;
    }

    async rejectLeaveRequest(id: string, dto: RejectLeaveRequestDTO, updatedBy: string): Promise<LeaveRequestEntity> {
        const request = await this.getLeaveRequest(id);

        if (request.status !== 'pending') {
            throw new Error('Can only reject pending leave requests');
        }

        const balance = await this.leaveRepository.getLeaveBalance(
            request.employeeId,
            request.leaveTypeId,
            request.startDate.getFullYear()
        );

        const rejected = await this.leaveRepository.updateLeaveRequest(id, {
            status: 'rejected',
            rejectionReason: dto.rejectionReason,
            updatedBy,
        });

        if (balance) {
            await this.leaveRepository.createOrUpdateLeaveBalance({
                ...balance,
                pendingDays: Math.max(0, balance.pendingDays - request.numberOfDays),
            });
        }

        return rejected!;
    }

    async listLeaveRequests(query: LeaveRequestListQueryDTO): Promise<{ data: LeaveRequestEntity[]; total: number }> {
        const [requests, total] = await this.leaveRepository.findLeaveRequests(query);
        return { data: requests, total };
    }

    async getLeaveBalance(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalanceEntity> {
        const balance = await this.leaveRepository.getLeaveBalance(employeeId, leaveTypeId, year);
        if (!balance) {
            throw new Error('Leave balance not found');
        }
        return balance;
    }

    async getEmployeeLeaveBalances(employeeId: string, year: number): Promise<LeaveBalanceEntity[]> {
        return await this.leaveRepository.getEmployeeLeaveBalances(employeeId, year);
    }

    async allocateLeaveBalance(
        employeeId: string,
        leaveTypeId: string,
        year: number,
        days: number,
        createdBy: string
    ): Promise<LeaveBalanceEntity> {
        return await this.leaveRepository.createOrUpdateLeaveBalance({
            employeeId,
            leaveTypeId,
            year,
            allocatedDays: days,
            usedDays: 0,
            carriedOverDays: 0,
            pendingDays: 0,
            createdBy,
        });
    }

    async getPendingLeaveRequests(reportingManagerId: string): Promise<LeaveRequestEntity[]> {
        return await this.leaveRepository.getPendingLeaveRequests(reportingManagerId);
    }
}
