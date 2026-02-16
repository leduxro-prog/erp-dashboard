import { Quote } from '../entities/Quote';

export interface IQuotePdfGenerator {
  generatePdf(quote: Quote, logoUrl?: string, companyDetails?: any): Promise<Buffer>;
}

export const QUOTE_PDF_GENERATOR_SYMBOL = Symbol('IQuotePdfGenerator');
