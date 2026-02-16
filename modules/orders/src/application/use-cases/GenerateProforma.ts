/**
 * Generate Proforma Use Case
 * Generates a proforma invoice for a quote or order
 */
import { OrderStatus, IOrderRepository } from '../../domain';
import { GenerateProformaInput, ProformaResult } from '../dtos';
import {
  OrderNotFoundError,
  InvalidOrderInputError,
  ProformaGenerationError,
} from '../errors';

/**
 * Proforma service interface for SmartBill integration
 */
export interface IProformaService {
  generateProforma(
    orderId: number,
    orderNumber: string,
    customerName: string,
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>,
    total: number,
    taxAmount: number,
    shippingCost: number,
    generatedBy: string
  ): Promise<string>; // Returns proforma number
}

/**
 * Event publisher interface for domain events
 */
export interface IEventPublisher {
  publish(event: any): Promise<void>;
}

export class GenerateProforma {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly proformaService: IProformaService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(input: GenerateProformaInput): Promise<ProformaResult> {
    // Fetch order
    const order = await this.orderRepository.getById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(`Order ID: ${input.orderId}`);
    }

    // Validate order can have proforma generated
    const validStatuses = [
      OrderStatus.QUOTE_PENDING,
      OrderStatus.QUOTE_SENT,
      OrderStatus.QUOTE_ACCEPTED,
      OrderStatus.ORDER_CONFIRMED,
    ];

    if (!validStatuses.includes(order.status)) {
      throw new InvalidOrderInputError(
        `Cannot generate proforma for order in status: ${order.status}`
      );
    }

    try {
      // Generate proforma via SmartBill
      const proformaNumber = await this.proformaService.generateProforma(
        order.id,
        order.orderNumber,
        order.customerName,
        order.items.map((item) => ({
          sku: item.sku,
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        order.grandTotal,
        order.taxAmount,
        order.shippingCost,
        input.generatedBy
      );

      // Update order with proforma number
      order.proformaNumber = proformaNumber;
      order.updatedAt = new Date();
      order.updatedBy = input.generatedBy;

      // Save updated order
      await this.orderRepository.update(order);

      // Publish proforma generated event
      await this.eventPublisher.publish({
        type: 'order.proforma_generated',
        orderId: order.id,
        orderNumber: order.orderNumber,
        proformaNumber: proformaNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        total: order.grandTotal,
        generatedBy: input.generatedBy,
        timestamp: new Date(),
      });

      return {
        proformaNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        total: order.grandTotal,
        currency: order.currency,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new ProformaGenerationError(
        order.id,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
