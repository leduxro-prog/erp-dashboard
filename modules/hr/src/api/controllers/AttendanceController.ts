import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../../domain/services/AttendanceService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class AttendanceController {
    constructor(private attendanceService: AttendanceService) { }

    clockIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const record = await this.attendanceService.clockIn(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(record));
        } catch (error) {
            next(error);
        }
    };

    clockOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const record = await this.attendanceService.clockOut(req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(record));
        } catch (error) {
            next(error);
        }
    };

    getRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const record = await this.attendanceService.getAttendanceRecord(req.params.id);
            res.status(200).json(successResponse(record));
        } catch (error) {
            next(error);
        }
    };

    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { data, total } = await this.attendanceService.listAttendanceRecords(req.query as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            res.status(200).json(paginatedResponse(data, total, page, limit));
        } catch (error) {
            next(error);
        }
    };

    getAttendanceReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const report = await this.attendanceService.getAttendanceReport(
                req.params.employeeId,
                parseInt(req.params.month),
                parseInt(req.params.year)
            );
            res.status(200).json(successResponse(report));
        } catch (error) {
            next(error);
        }
    };

    getMonthlyStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const stats = await this.attendanceService.getMonthlyStats(
                req.params.employeeId,
                parseInt(req.params.month),
                parseInt(req.params.year)
            );
            res.status(200).json(successResponse(stats));
        } catch (error) {
            next(error);
        }
    };

    getPendingApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const records = await this.attendanceService.getPendingApprovals();
            res.status(200).json(successResponse(records));
        } catch (error) {
            next(error);
        }
    };

    approveAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const record = await this.attendanceService.approveAttendance(req.params.id, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(record));
        } catch (error) {
            next(error);
        }
    };
}
