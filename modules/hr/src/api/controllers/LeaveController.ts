import { Request, Response, NextFunction } from 'express';
import { LeaveService } from '../../domain/services/LeaveService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class LeaveController {
    constructor(private leaveService: LeaveService) { }

    createLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const request = await this.leaveService.createLeaveRequest(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    };

    getLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const request = await this.leaveService.getLeaveRequest(req.params.id);
            res.status(200).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    };

    updateLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const request = await this.leaveService.updateLeaveRequest(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    };

    approveLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const request = await this.leaveService.approveLeaveRequest(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    };

    rejectLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const request = await this.leaveService.rejectLeaveRequest(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    };

    listLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { data, total } = await this.leaveService.listLeaveRequests(req.query as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            res.status(200).json(paginatedResponse(data, total, page, limit));
        } catch (error) {
            next(error);
        }
    };

    getLeaveBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const balance = await this.leaveService.getLeaveBalance(
                req.params.employeeId,
                req.params.leaveTypeId,
                parseInt(req.params.year)
            );
            res.status(200).json(successResponse(balance));
        } catch (error) {
            next(error);
        }
    };

    getEmployeeLeaveBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const balances = await this.leaveService.getEmployeeLeaveBalances(
                req.params.employeeId,
                parseInt(req.params.year)
            );
            res.status(200).json(successResponse(balances));
        } catch (error) {
            next(error);
        }
    };

    allocateLeaveBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const balance = await this.leaveService.allocateLeaveBalance(
                req.body.employeeId,
                req.body.leaveTypeId,
                req.body.year,
                req.body.days,
                String(req.user?.id || 'system')
            );
            res.status(201).json(successResponse(balance));
        } catch (error) {
            next(error);
        }
    };

    getPendingLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const requests = await this.leaveService.getPendingLeaveRequests(req.params.managerId);
            res.status(200).json(successResponse(requests));
        } catch (error) {
            next(error);
        }
    };
}
