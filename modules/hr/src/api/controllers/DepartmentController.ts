import { Request, Response, NextFunction } from 'express';
import { DepartmentService } from '../../domain/services/DepartmentService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class DepartmentController {
    constructor(private departmentService: DepartmentService) { }

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const department = await this.departmentService.createDepartment(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(department));
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const department = await this.departmentService.getDepartment(req.params.id);
            res.status(200).json(successResponse(department));
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const department = await this.departmentService.updateDepartment(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(department));
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.departmentService.deleteDepartment(req.params.id);
            res.status(204).json();
        } catch (error) {
            next(error);
        }
    };

    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { data, total } = await this.departmentService.listDepartments(req.query as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            res.status(200).json(paginatedResponse(data, total, page, limit));
        } catch (error) {
            next(error);
        }
    };

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const departments = await this.departmentService.getAllDepartments();
            res.status(200).json(successResponse(departments));
        } catch (error) {
            next(error);
        }
    };

    getHierarchy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const hierarchy = await this.departmentService.getDepartmentHierarchy();
            res.status(200).json(successResponse(hierarchy));
        } catch (error) {
            next(error);
        }
    };

    getChildren = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const children = await this.departmentService.getChildDepartments(req.params.parentId);
            res.status(200).json(successResponse(children));
        } catch (error) {
            next(error);
        }
    };
}
