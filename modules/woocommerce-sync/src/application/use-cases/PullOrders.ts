import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../domain/ports/IWooCommerceMapper';
import { PulledOrder } from '../dtos/woocommerce.dtos';
import { SyncError } from '../errors/woocommerce.errors';

export class PullOrders {
  constructor(
    private apiClient: IWooCommerceClient,
    private mapper: IWooCommerceMapper,
    private publishEvent: (eventName: string, payload: any) => Promise<void>
  ) {}

  async execute(since?: Date): Promise<PulledOrder[]> {
    try {
      // Step 1: Get orders from WooCommerce with 'processing' status
      const params: any = {
        status: 'processing',
        per_page: 100,
        orderby: 'date',
        order: 'asc',
      };

      if (since) {
        params.after = since.toISOString();
      }

      const wcOrders = await this.apiClient.getOrders(params);

      // Step 2: Map orders to internal format
      const pulledOrders: PulledOrder[] = wcOrders.map((wcOrder) =>
        this.mapper.fromWooCommerceOrder(wcOrder)
      );

      // Step 3: Publish event for each order
      for (const order of pulledOrders) {
        await this.publishEvent('woocommerce.order_received', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerEmail: order.customerEmail,
          total: order.total,
          currency: order.currency,
          items: order.items,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          dateCreated: order.dateCreated,
        });
      }

      return pulledOrders;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      throw new SyncError(
        `Failed to pull orders: ${errorMessage}`,
        'all_orders',
        'order_pull',
        error instanceof Error ? error : undefined
      );
    }
  }
}
