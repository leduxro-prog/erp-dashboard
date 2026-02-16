import { Request, Response, NextFunction } from 'express';
import { PayrollService } from '../../domain/services/PayrollService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class PayrollController {
    constructor(private payrollService: PayrollService) { }

    createPayrollRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const run = await this.payrollService.createPayrollRun(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(run));
        } catch (error) {
            next(error);
        }
    };

    getPayrollRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const run = await this.payrollService.getPayrollRun(req.params.id);
            res.status(200).json(successResponse(run));
        } catch (error) {
            next(error);
        }
    };

    updatePayrollRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const run = await this.payrollService.updatePayrollRun(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(run));
        } catch (error) {
            next(error);
        }
    };

    listPayrollRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { data, total } = await this.payrollService.listPayrollRuns(req.query as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            res.status(200).json(paginatedResponse(data, total, page, limit));
        } catch (error) {
            next(error);
        }
    };

    createPayrollEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const salaryStructures = new Map(Object.entries(req.body.salaryStructures || {}));
            const entries = await this.payrollService.createPayrollEntries(
                req.params.payrollRunId,
                req.body.employeeIds,
                salaryStructures,
                String(req.user?.id || 'system')
            );
            res.status(201).json(successResponse(entries));
        } catch (error) {
            next(error);
        }
    };

    approvePayroll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const run = await this.payrollService.approvePayroll(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(run));
        } catch (error) {
            next(error);
        }
    };

    processPayroll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const run = await this.payrollService.processPayroll(req.params.id, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(run));
        } catch (error) {
            next(error);
        }
    };
}
