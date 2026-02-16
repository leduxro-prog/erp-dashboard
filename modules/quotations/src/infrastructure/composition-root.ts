import { Router } from 'express';
import { DataSource } from 'typeorm';
import { QuotationController } from '../api/controllers/QuotationController';
import { createQuotationRoutes } from '../api/routes/quotation.routes';
import { CreateQuote } from '../application/use-cases/CreateQuote';
import { SendQuote, IEmailService } from '../application/use-cases/SendQuote';
import { AcceptQuote } from '../application/use-cases/AcceptQuote';
import { RejectQuote } from '../application/use-cases/RejectQuote';
import { ConvertToOrder, IOrderService, IEventPublisher } from '../application/use-cases/ConvertToOrder';
import { GenerateQuotePdf, ICompanyDetailsProvider } from '../application/use-cases/GenerateQuotePdf';
import { ListQuotes } from '../application/use-cases/ListQuotes';
import { GetQuote } from '../application/use-cases/GetQuote';
import { TypeOrmQuoteRepository } from './repositories/TypeOrmQuoteRepository';
import { QuoteEntity } from './entities/QuoteEntity';
import { QuoteCache } from './cache/QuoteCache';
import { QuoteAnalyticsService } from '../application/services/QuoteAnalyticsService';
import { QuoteWorkflowService } from './automation/QuoteWorkflowService';

/**
 * Composition Root for Quotations Module
 * Orchestrates dependency injection and creates configured Express router
 *
 * Note: External services (Email, PDF Generator, Order Service, Event Publisher, Company Details)
 * should be provided as dependencies when bootstrapping the application.
 */
/**
 * PDF Generator interface for type safety
 */
interface IPdfGenerator {
  generatePdf(content: unknown): Promise<Buffer>;
}

/**
 * Default PDF Generator stub
 */
const defaultPdfGenerator: IPdfGenerator = {
  generatePdf: async () => Buffer.from(''),
};

/**
 * No-op QuoteCache for when Redis is not available
 */
function createNoOpQuoteCache(): QuoteCache {
  return {
    get: async () => null,
    set: async () => { },
    delete: async () => { },
    invalidateCustomerQuotes: async () => { },
    clear: async () => { },
  } as unknown as QuoteCache;
}

export function createQuotationsRouter(
  dataSource: DataSource,
  emailService: IEmailService,
  orderService: IOrderService,
  eventPublisher: IEventPublisher,
  companyDetailsProvider: ICompanyDetailsProvider,
  pdfGenerator?: IPdfGenerator,
  redis?: import('ioredis').Redis,
): Router {
  // Instantiate infrastructure dependencies
  const quoteRepository = new TypeOrmQuoteRepository(dataSource.getRepository(QuoteEntity));
  // QuoteCache requires Redis - create instance only if Redis is provided, otherwise use a no-op cache
  const quoteCache = redis ? new QuoteCache(redis) : createNoOpQuoteCache();

  // Instantiate use-cases with injected repositories and external services
  const createQuote = new CreateQuote(quoteRepository);
  const sendQuote = new SendQuote(quoteRepository, emailService);
  const acceptQuote = new AcceptQuote(quoteRepository);
  const rejectQuote = new RejectQuote(quoteRepository);
  const convertToOrder = new ConvertToOrder(
    quoteRepository,
    orderService,
    eventPublisher,
  );
  const generateQuotePdf = new GenerateQuotePdf(
    quoteRepository,
    pdfGenerator || defaultPdfGenerator,
    companyDetailsProvider,
  );
  const listQuotes = new ListQuotes(quoteRepository);
  const getQuote = new GetQuote(quoteRepository);

  // Instantiate analytics and workflow services
  const analyticsService = new QuoteAnalyticsService(dataSource);
  const workflowService = new QuoteWorkflowService(dataSource);

  // Instantiate controller with injected use-cases
  const controller = new QuotationController(
    createQuote,
    sendQuote,
    acceptQuote,
    rejectQuote,
    convertToOrder,
    generateQuotePdf,
    listQuotes,
    getQuote,
    quoteCache,
    analyticsService,
    workflowService,
  );

  // Create and return configured Express router
  return createQuotationRoutes(controller);
}
