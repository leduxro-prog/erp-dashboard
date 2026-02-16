import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../../domain/services/EmployeeService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class EmployeeController {
    constructor(private employeeService: EmployeeService) { }

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employee = await this.employeeService.createEmployee(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(employee));
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employee = await this.employeeService.getEmployee(req.params.id);
            res.status(200).json(successResponse(employee));
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employee = await this.employeeService.updateEmployee(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(employee));
        } catch (error) {
            next(error);
        }
    };

    terminate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employee = await this.employeeService.terminateEmployee(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(employee));
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.employeeService.deleteEmployee(req.params.id);
            res.status(204).json();
        } catch (error) {
            next(error);
        }
    };

    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { data, total } = await this.employeeService.listEmployees(req.query as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            res.status(200).json(paginatedResponse(data, total, page, limit));
        } catch (error) {
            next(error);
        }
    };

    getByDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employees = await this.employeeService.getEmployeesByDepartment(req.params.departmentId);
            res.status(200).json(successResponse(employees));
        } catch (error) {
            next(error);
        }
    };

    getByManager = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employees = await this.employeeService.getEmployeesByManager(req.params.managerId);
            res.status(200).json(successResponse(employees));
        } catch (error) {
            next(error);
        }
    };

    getActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const employees = await this.employeeService.getActiveEmployees();
            res.status(200).json(successResponse(employees));
        } catch (error) {
            next(error);
        }
    };
}
