import { Request, Response } from 'express';
import { GRNUseCases } from '../../application/use-cases/GRNUseCases';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class GRNController {
  constructor(private grnUseCases: GRNUseCases) { }

  async createGRN(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.grnUseCases.createGRN(req.body);
      res.status(201).json(successResponse(result, { message: 'GRN created successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CREATE_GRN_ERROR', error.message, statusCode));
    }
  }

  async submitGRN(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.grnUseCases.submitGRN(id);
      res.json(successResponse(result, { message: 'GRN submitted successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('SUBMIT_GRN_ERROR', error.message, statusCode));
    }
  }

  async inspectGRN(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.grnUseCases.inspectGRN(req.body);
      res.json(successResponse(result, { message: 'GRN inspected successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('INSPECT_GRN_ERROR', error.message, statusCode));
    }
  }

  async acceptGRN(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.grnUseCases.acceptGRN(id);
      res.json(successResponse(result, { message: 'GRN accepted successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('ACCEPT_GRN_ERROR', error.message, statusCode));
    }
  }

  async rejectGRN(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await this.grnUseCases.rejectGRN(id, reason);
      res.json(successResponse(result, { message: 'GRN rejected successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('REJECT_GRN_ERROR', error.message, statusCode));
    }
  }

  async requestReturn(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.grnUseCases.requestReturn(req.body);
      res.json(successResponse(result, { message: 'Return requested successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('REQUEST_RETURN_ERROR', error.message, statusCode));
    }
  }

  async approveReturn(req: Request, res: Response): Promise<void> {
    try {
      const { grnId, returnId } = req.params;
      const { approvedBy } = req.body;
      const result = await this.grnUseCases.approveReturn(grnId, returnId, approvedBy);
      res.json(successResponse(result, { message: 'Return approved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('APPROVE_RETURN_ERROR', error.message, statusCode));
    }
  }

  async getGRN(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.grnUseCases.getGRN(id);
      res.json(successResponse(result, { message: 'GRN retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_GRN_ERROR', error.message, statusCode));
    }
  }

  async getGRNByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { number } = req.params;
      const result = await this.grnUseCases.getGRNByNumber(number);
      res.json(successResponse(result, { message: 'GRN retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_GRN_ERROR', error.message, statusCode));
    }
  }

  async listByPO(req: Request, res: Response): Promise<void> {
    try {
      const { poId } = req.params;
      const result = await this.grnUseCases.listByPO(poId);
      res.json(successResponse(result, { message: 'GRNs retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_GRN_ERROR', error.message, statusCode));
    }
  }

  async listByVendor(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.grnUseCases.listByVendor(
        vendorId,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_GRN_ERROR', error.message, statusCode));
    }
  }

  async listByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.grnUseCases.listByStatus(
        status,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_GRN_ERROR', error.message, statusCode));
    }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.grnUseCases.listAll(Number(page), Number(limit));
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_GRN_ERROR', error.message, statusCode));
    }
  }
}
