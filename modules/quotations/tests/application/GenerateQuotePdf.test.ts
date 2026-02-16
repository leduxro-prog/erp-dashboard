import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GenerateQuotePdf,
  ICompanyDetailsProvider,
} from '../../src/application/use-cases/GenerateQuotePdf';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { IQuotePdfGenerator } from '../../src/domain/services/IQuotePdfGenerator';
import {
  QuoteNotFoundError,
  QuotePdfGenerationError,
} from '../../src/application/errors/QuoteErrors';

describe('GenerateQuotePdf Use Case', () => {
  let useCase: GenerateQuotePdf;
  let mockRepository: jest.Mocked<IQuoteRepository>;
  let mockPdfGenerator: jest.Mocked<IQuotePdfGenerator>;
  let mockCompanyDetailsProvider: jest.Mocked<ICompanyDetailsProvider>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    mockPdfGenerator = {
      generatePdf: jest.fn(),
    };

    mockCompanyDetailsProvider = {
      getCompanyDetails: jest.fn(),
    };

    useCase = new GenerateQuotePdf(
      mockRepository,
      mockPdfGenerator,
      mockCompanyDetailsProvider,
    );
  });

  it('should generate PDF for quote', async () => {
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      items: [],
      subtotal: 1000,
      taxAmount: 190,
      grandTotal: 1190,
    };

    const generatedBuffer = Buffer.from('fake-pdf-data');
    mockRepository.findById.mockResolvedValue(mockQuote as any);
    mockCompanyDetailsProvider.getCompanyDetails.mockResolvedValue({
      name: 'Cypher ERP',
      address: 'Test Street 1',
      phone: '+40 123 456 789',
      email: 'office@cypher.ro',
      taxId: 'RO123456',
      logoUrl: 'https://example.com/logo.png',
    });
    mockPdfGenerator.generatePdf.mockResolvedValue(generatedBuffer);

    const result = await useCase.execute('quote-1');

    expect(result).toBe(generatedBuffer);
    expect(mockPdfGenerator.generatePdf).toHaveBeenCalledWith(
      mockQuote,
      'https://example.com/logo.png',
      expect.objectContaining({ name: 'Cypher ERP' }),
    );
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999')).rejects.toThrow(QuoteNotFoundError);
    expect(mockPdfGenerator.generatePdf).not.toHaveBeenCalled();
  });

  it('should wrap PDF generation errors', async () => {
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      items: [{ productName: 'Product 1', quantity: 2, unitPrice: 500 }],
      subtotal: 1000,
      taxAmount: 190,
      grandTotal: 1190,
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);
    mockCompanyDetailsProvider.getCompanyDetails.mockResolvedValue({
      name: 'Cypher ERP',
      address: 'Test Street 1',
      phone: '+40 123 456 789',
      email: 'office@cypher.ro',
      taxId: 'RO123456',
    });
    mockPdfGenerator.generatePdf.mockRejectedValue(new Error('Renderer failed'));

    await expect(useCase.execute('quote-1')).rejects.toThrow(QuotePdfGenerationError);
    await expect(useCase.execute('quote-1')).rejects.toThrow('QTE-001');
  });
});
