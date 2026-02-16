import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteNotFoundError, QuoteAlreadyProcessedError } from '../errors/QuoteErrors';
import { QuoteStatus } from '../../domain/entities/Quote';

export interface IOrderService {
  createOrder(orderData: any): Promise<any>;
}

export interface IEventPublisher {
  publish(eventType: string, data: any): Promise<void>;
}

export class ConvertToOrder {
  constructor(
    private quoteRepository: IQuoteRepository,
    private orderService: IOrderService,
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(quoteId: string): Promise<any> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new QuoteAlreadyProcessedError(quote.status);
    }

    const orderData = quote.convertToOrderData();
    const order = await this.orderService.createOrder(orderData);

    // Publish event for other services
    await this.eventPublisher.publish('quote_converted_to_order', {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      timestamp: new Date(),
    });

    return order;
  }
}
