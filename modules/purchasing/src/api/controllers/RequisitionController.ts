import { Request, Response } from 'express';
import { RequisitionUseCases } from '../../application/use-cases/RequisitionUseCases';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class RequisitionController {
  constructor(private requisitionUseCases: RequisitionUseCases) { }

  async createRequisition(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.requisitionUseCases.createRequisition(req.body);
      res.status(201).json(successResponse(result, { message: 'Requisition created successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CREATE_REQ_ERROR', error.message, statusCode));
    }
  }

  async submitRequisition(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.requisitionUseCases.submitRequisition(req.body);
      res.json(successResponse(result, { message: 'Requisition submitted successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('SUBMIT_REQ_ERROR', error.message, statusCode));
    }
  }

  async approveRequisition(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.requisitionUseCases.approveRequisition(req.body);
      res.json(successResponse(result, { message: 'Requisition approved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('APPROVE_REQ_ERROR', error.message, statusCode));
    }
  }

  async rejectRequisition(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.requisitionUseCases.rejectRequisition(req.body);
      res.json(successResponse(result, { message: 'Requisition rejected successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('REJECT_REQ_ERROR', error.message, statusCode));
    }
  }

  async getRequisition(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.requisitionUseCases.getRequisition(id);
      res.json(successResponse(result, { message: 'Requisition retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_REQ_ERROR', error.message, statusCode));
    }
  }

  async getRequisitionByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { number } = req.params;
      const result = await this.requisitionUseCases.getRequisitionByNumber(number);
      res.json(successResponse(result, { message: 'Requisition retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_REQ_ERROR', error.message, statusCode));
    }
  }

  async listByDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { departmentId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.requisitionUseCases.listByDepartment(
        departmentId,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_REQ_ERROR', error.message, statusCode));
    }
  }

  async listByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.requisitionUseCases.listByStatus(
        status,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_REQ_ERROR', error.message, statusCode));
    }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.requisitionUseCases.listAll(Number(page), Number(limit));
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_REQ_ERROR', error.message, statusCode));
    }
  }

  async cancelRequisition(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.requisitionUseCases.cancelRequisition(id);
      res.json(successResponse(null, { message: 'Requisition cancelled successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CANCEL_REQ_ERROR', error.message, statusCode));
    }
  }
}
