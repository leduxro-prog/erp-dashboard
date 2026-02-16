import { Request, Response } from 'express';
import { InvoiceUseCases } from '../../application/use-cases/InvoiceUseCases';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class InvoiceController {
  constructor(private invoiceUseCases: InvoiceUseCases) { }

  async registerInvoice(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.invoiceUseCases.registerInvoice(req.body);
      res.status(201).json(successResponse(result, { message: 'Invoice registered successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('REGISTER_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async disputeInvoice(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.invoiceUseCases.disputeInvoice(req.body);
      res.json(successResponse(result, { message: 'Invoice disputed successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('DISPUTE_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async resolveDispute(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.invoiceUseCases.resolveDispute(req.body);
      res.json(successResponse(result, { message: 'Dispute resolved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('RESOLVE_DISPUTE_ERROR', error.message, statusCode));
    }
  }

  async approveForPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.invoiceUseCases.approveForPayment(id);
      res.json(successResponse(result, { message: 'Invoice approved for payment successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('APPROVE_PAYMENT_ERROR', error.message, statusCode));
    }
  }

  async recordPayment(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.invoiceUseCases.recordPayment(req.body);
      res.json(successResponse(result, { message: 'Payment recorded successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('RECORD_PAYMENT_ERROR', error.message, statusCode));
    }
  }

  async cancelInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.invoiceUseCases.cancelInvoice(id);
      res.json(successResponse(null, { message: 'Invoice cancelled successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CANCEL_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.invoiceUseCases.getInvoice(id);
      res.json(successResponse(result, { message: 'Invoice retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async getInvoiceByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { number } = req.params;
      const result = await this.invoiceUseCases.getInvoiceByNumber(number);
      res.json(successResponse(result, { message: 'Invoice retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async listByVendor(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.invoiceUseCases.listByVendor(
        vendorId,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async listByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.invoiceUseCases.listByStatus(
        status,
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async listOverdue(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.invoiceUseCases.listOverdue(Number(page), Number(limit));
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async listDueSoon(req: Request, res: Response): Promise<void> {
    try {
      const { days = 7, page = 1, limit = 20 } = req.query;
      const result = await this.invoiceUseCases.listDueSoon(
        Number(days),
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_INVOICE_ERROR', error.message, statusCode));
    }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.invoiceUseCases.listAll(Number(page), Number(limit));
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_INVOICE_ERROR', error.message, statusCode));
    }
  }
}
