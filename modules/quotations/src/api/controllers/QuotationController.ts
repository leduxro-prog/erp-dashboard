import { Request, Response } from 'express';
import {
  CreateQuote,
  SendQuote,
  AcceptQuote,
  RejectQuote,
  ConvertToOrder,
  GenerateQuotePdf,
  ListQuotes,
  GetQuote,
  IEmailService,
  IOrderService,
  IEventPublisher,
  ICompanyDetailsProvider,
} from '../../application/use-cases';
import { CreateQuoteDTO } from '../../application/dtos/CreateQuoteDTO';
import { QuoteStatus } from '../../domain/entities/Quote';
import {
  QuoteNotFoundError,
  QuoteExpiredError,
  QuoteAlreadyProcessedError,
  InvalidQuoteItemsError,
  QuotePdfGenerationError,
} from '../../application/errors/QuoteErrors';
import { QuotationValidators } from '../validators/quotation.validators';
import { QuoteCache } from '../../infrastructure/cache/QuoteCache';
import { QuoteAnalyticsService } from '../../application/services/QuoteAnalyticsService';
import { QuoteWorkflowService } from '../../infrastructure/automation/QuoteWorkflowService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class QuotationController {
  constructor(
    private createQuote: CreateQuote,
    private sendQuote: SendQuote,
    private acceptQuote: AcceptQuote,
    private rejectQuote: RejectQuote,
    private convertToOrder: ConvertToOrder,
    private generateQuotePdf: GenerateQuotePdf,
    private listQuotes: ListQuotes,
    private getQuote: GetQuote,
    private quoteCache: QuoteCache,
    private analyticsService: QuoteAnalyticsService,
    private workflowService: QuoteWorkflowService,
  ) {}

  async createQuoteHandler(req: Request, res: Response): Promise<void> {
    try {
      const dto: CreateQuoteDTO = req.body;
      QuotationValidators.validateCreateQuoteDTO(dto);

      const quote = await this.createQuote.execute(dto);
      await this.quoteCache.set(quote);

      res.status(201).json(successResponse(quote, { message: 'Quote created successfully' }));
    } catch (error) {
      if (error instanceof InvalidQuoteItemsError) {
        res.status(400).json(errorResponse('INVALID_ITEMS', error.message, 400));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async getQuoteHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      QuotationValidators.validateQuoteId(id);

      // Try cache first
      let quote = await this.quoteCache.get(id);
      if (!quote) {
        quote = await this.getQuote.execute(id);
        await this.quoteCache.set(quote);
      }

      res.status(200).json(successResponse(quote));
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async listQuotesHandler(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, status, page = 1, limit = 10 } = req.query;

      const result = await this.listQuotes.execute({
        customerId: customerId as string | undefined,
        status: (status as unknown as QuoteStatus | undefined) || undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.status(200).json(paginatedResponse(result.data, result.total, result.page, result.limit));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async sendQuoteHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { sendWhatsApp = false } = req.body;

      QuotationValidators.validateQuoteId(id);

      await this.sendQuote.execute(id, sendWhatsApp);
      await this.quoteCache.delete(id);

      res.status(200).json(successResponse({ message: 'Quote sent successfully' }));
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
      } else if (error instanceof QuoteExpiredError) {
        res.status(410).json(errorResponse('EXPIRED', error.message, 410));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async acceptQuoteHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      QuotationValidators.validateQuoteId(id);

      await this.acceptQuote.execute(id);
      await this.quoteCache.delete(id);

      res.status(200).json(successResponse({ message: 'Quote accepted successfully' }));
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
      } else if (error instanceof QuoteExpiredError) {
        res.status(410).json(errorResponse('EXPIRED', error.message, 410));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async rejectQuoteHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      QuotationValidators.validateQuoteId(id);
      QuotationValidators.validateRejectReason(reason);

      await this.rejectQuote.execute(id, reason);
      await this.quoteCache.delete(id);

      res.status(200).json(successResponse({ message: 'Quote rejected successfully' }));
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async convertToOrderHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      QuotationValidators.validateQuoteId(id);

      const order = await this.convertToOrder.execute(id);
      await this.quoteCache.delete(id);

      res.status(201).json(successResponse(order, { message: 'Quote converted to order successfully' }));
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
      } else if (error instanceof QuoteAlreadyProcessedError) {
        res.status(409).json(errorResponse('ALREADY_PROCESSED', error.message, 409));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async generatePdfHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      QuotationValidators.validateQuoteId(id);

      const pdfBuffer = await this.generateQuotePdf.execute(id);
      const quote = await this.getQuote.execute(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="quote_${quote.quoteNumber}.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json(errorResponse('NOT_FOUND', error.message, 404));
      } else if (error instanceof QuotePdfGenerationError) {
        res.status(500).json(errorResponse('PDF_GENERATION_ERROR', error.message, 500));
      } else if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  // ==================== ANALYTICS ENDPOINTS ====================

  async getAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const metrics = await this.analyticsService.getQuoteMetrics(start, end);

      res.status(200).json(successResponse(metrics));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async getTrendsHandler(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      const group = groupBy as 'day' | 'week' | 'month';

      const trends = await this.analyticsService.getQuoteTrends(start, end, group);

      res.status(200).json(successResponse(trends));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async getTopCustomersHandler(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query;

      const customers = await this.analyticsService.getTopCustomers(Number(limit));

      res.status(200).json(successResponse(customers));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async getTopProductsHandler(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query;

      const products = await this.analyticsService.getTopProducts(Number(limit));

      res.status(200).json(successResponse(products));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async getExpiringQuotesHandler(req: Request, res: Response): Promise<void> {
    try {
      const { withinDays = 7 } = req.query;

      const quotes = await this.analyticsService.getExpiringQuotes(Number(withinDays));

      res.status(200).json(successResponse(quotes));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  // ==================== WORKFLOW ENDPOINTS ====================

  async sendManualReminderHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      QuotationValidators.validateQuoteId(id);

      await this.workflowService.sendManualReminder(id);

      res.status(200).json(successResponse({ message: 'Reminder sent successfully' }));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }

  async getWorkflowStatsHandler(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.workflowService.getWorkflowStats();

      res.status(200).json(successResponse(stats));
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      } else {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
      }
    }
  }
}
