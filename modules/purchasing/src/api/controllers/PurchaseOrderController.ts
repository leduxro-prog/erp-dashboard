import { Request, Response } from 'express';
import { PurchaseOrderUseCases } from '../../application/use-cases/PurchaseOrderUseCases';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class PurchaseOrderController {
  constructor(private poUseCases: PurchaseOrderUseCases) { }

  async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.poUseCases.createPurchaseOrder(req.body);
      res.status(201).json(successResponse(result, { message: 'Purchase Order created successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CREATE_PO_ERROR', error.message, statusCode));
    }
  }

  async approvePO(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.poUseCases.approvePO(req.body);
      res.json(successResponse(result, { message: 'Purchase Order approved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('APPROVE_PO_ERROR', error.message, statusCode));
    }
  }

  async sendPO(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.poUseCases.sendPO(req.body);
      res.json(successResponse(result, { message: 'Purchase Order sent successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('SEND_PO_ERROR', error.message, statusCode));
    }
  }

  async amendPO(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.poUseCases.amendPO(req.body);
      res.json(successResponse(result, { message: 'Purchase Order amended successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('AMEND_PO_ERROR', error.message, statusCode));
    }
  }

  async updatePOLine(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.poUseCases.updatePOLine(req.body);
      res.json(successResponse(result, { message: 'Purchase Order line updated successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('UPDATE_PO_LINE_ERROR', error.message, statusCode));
    }
  }

  async getPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.poUseCases.getPurchaseOrder(id);
      res.json(successResponse(result, { message: 'Purchase Order retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_PO_ERROR', error.message, statusCode));
    }
  }

  async getPOByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { number } = req.params;
      const result = await this.poUseCases.getPOByNumber(number);
      res.json(successResponse(result, { message: 'Purchase Order retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_PO_ERROR', error.message, statusCode));
    }
  }

  async listByVendor(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.poUseCases.listByVendor(
        vendorId,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_PO_ERROR', error.message, statusCode));
    }
  }

  async listByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.poUseCases.listByStatus(
        status,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_PO_ERROR', error.message, statusCode));
    }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.poUseCases.listAll(Number(page), Number(limit));
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_PO_ERROR', error.message, statusCode));
    }
  }

  async cancelPO(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.poUseCases.cancelPO(id);
      res.json(successResponse(null, { message: 'Purchase Order cancelled successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CANCEL_PO_ERROR', error.message, statusCode));
    }
  }

  async closePO(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.poUseCases.closePO(id);
      res.json(successResponse(null, { message: 'Purchase Order closed successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CLOSE_PO_ERROR', error.message, statusCode));
    }
  }
}
