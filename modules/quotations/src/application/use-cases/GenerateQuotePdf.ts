import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { IQuotePdfGenerator } from '../../domain/services/IQuotePdfGenerator';
import { QuoteNotFoundError, QuotePdfGenerationError } from '../errors/QuoteErrors';

export interface ICompanyDetailsProvider {
  getCompanyDetails(): Promise<{
    name: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
    logoUrl?: string;
  }>;
}

export class GenerateQuotePdf {
  constructor(
    private quoteRepository: IQuoteRepository,
    private pdfGenerator: IQuotePdfGenerator,
    private companyDetailsProvider: ICompanyDetailsProvider,
  ) {}

  async execute(quoteId: string): Promise<Buffer> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    try {
      const companyDetails = await this.companyDetailsProvider.getCompanyDetails();
      const pdfBuffer = await this.pdfGenerator.generatePdf(
        quote,
        companyDetails.logoUrl,
        companyDetails,
      );
      return pdfBuffer;
    } catch (error) {
      throw new QuotePdfGenerationError(
        `Failed to generate PDF for quote ${quote.quoteNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
