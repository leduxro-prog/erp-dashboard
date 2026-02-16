import { Quote, QuoteItem } from '../../domain/entities/Quote';
import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { CreateQuoteDTO } from '../dtos/CreateQuoteDTO';
import { InvalidQuoteItemsError } from '../errors/QuoteErrors';
import { v4 as uuidv4 } from 'uuid';

export class CreateQuote {
  constructor(private quoteRepository: IQuoteRepository) {}

  async execute(dto: CreateQuoteDTO): Promise<Quote> {
    if (!dto.items || dto.items.length === 0) {
      throw new InvalidQuoteItemsError();
    }

    const quoteItems: QuoteItem[] = dto.items.map(item => ({
      id: uuidv4(),
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    }));

    const quote = new Quote(
      uuidv4(),
      Quote.generateQuoteNumber(),
      dto.customerId,
      dto.customerName,
      dto.customerEmail,
      quoteItems,
      dto.billingAddress,
      dto.shippingAddress,
      dto.paymentTerms,
      dto.deliveryEstimate,
      dto.createdBy,
      dto.discountPercentage || 0,
      dto.validityDays || 15,
      dto.notes,
    );

    return await this.quoteRepository.save(quote);
  }
}
