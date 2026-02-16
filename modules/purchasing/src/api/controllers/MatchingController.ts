import { Request, Response } from 'express';
import { MatchingUseCases } from '../../application/use-cases/MatchingUseCases';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class MatchingController {
  constructor(private matchingUseCases: MatchingUseCases) { }

  async createMatch(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.matchingUseCases.createMatch(req.body);
      res.status(201).json(successResponse(result, { message: '3-Way Match created successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('CREATE_MATCH_ERROR', error.message, statusCode));
    }
  }

  async autoApproveMatches(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.matchingUseCases.autoApproveMatches();
      res.json(successResponse({ approvedMatches: result }, { message: 'Matches auto-approved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('AUTO_APPROVE_ERROR', error.message, statusCode));
    }
  }

  async resolveException(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.matchingUseCases.resolveException(req.body);
      res.json(successResponse(result, { message: 'Exception resolved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('RESOLVE_EXCEPTION_ERROR', error.message, statusCode));
    }
  }

  async getMatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.matchingUseCases.getMatch(id);
      res.json(successResponse(result, { message: 'Match retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_MATCH_ERROR', error.message, statusCode));
    }
  }

  async getMatchByPO(req: Request, res: Response): Promise<void> {
    try {
      const { poId } = req.params;
      const result = await this.matchingUseCases.getMatchByPO(poId);
      res.json(successResponse(result, { message: 'Matches retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('GET_MATCH_ERROR', error.message, statusCode));
    }
  }

  async getMatchByGRN(req: Request, res: Response): Promise<void> {
    try {
      const { grnId } = req.params;
      const result = await this.matchingUseCases.getMatchByGRN(grnId);
      res.json(successResponse(result, { message: 'Match retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_MATCH_ERROR', error.message, statusCode));
    }
  }

  async getMatchByInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const result = await this.matchingUseCases.getMatchByInvoice(invoiceId);
      res.json(successResponse(result, { message: 'Match retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 404;
      res.status(statusCode).json(errorResponse('GET_MATCH_ERROR', error.message, statusCode));
    }
  }

  async listWithExceptions(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.matchingUseCases.listWithExceptions(
        Number(page),
        Number(limit)
      );
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_MATCH_ERROR', error.message, statusCode));
    }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.matchingUseCases.listAll(Number(page), Number(limit));
      res.json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('LIST_MATCH_ERROR', error.message, statusCode));
    }
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.matchingUseCases.getAnalytics();
      res.json(successResponse(result, { message: 'Analytics retrieved successfully' }));
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json(errorResponse('GET_ANALYTICS_ERROR', error.message, statusCode));
    }
  }
}
