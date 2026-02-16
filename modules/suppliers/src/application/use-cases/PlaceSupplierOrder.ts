import { ISupplierRepository, SupplierOrderEntity, SupplierOrderItem, SupplierOrderStatus } from '../../domain';
import {
  SupplierNotFoundError,
  InvalidOrderError,
  InsufficientStockError,
} from '../errors/supplier.errors';
import { SupplierOrderResult } from '../dtos/supplier.dtos';

export interface OrderItem {
  supplierSku: string;
  quantity: number;
}

export class PlaceSupplierOrder {
  constructor(private repository: ISupplierRepository) { }

  async execute(
    supplierId: number,
    items: OrderItem[],
    orderId?: number,
  ): Promise<SupplierOrderResult> {
    // Validate supplier
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    // Validate items
    if (!items || items.length === 0) {
      throw new InvalidOrderError('Order must contain at least one item');
    }

    // Get supplier products and validate stock
    const products = await this.repository.getSupplierProducts(supplierId);
    const productMap = new Map(
      products.map((p) => [p.supplierSku, p]),
    );

    const orderItems: SupplierOrderItem[] = [];
    let totalEstimate = 0;

    for (const item of items) {
      const product = productMap.get(item.supplierSku);

      if (!product) {
        throw new InvalidOrderError(
          `Product ${item.supplierSku} not found in supplier catalog`,
        );
      }

      if (product.stockQuantity < item.quantity) {
        throw new InsufficientStockError(
          item.supplierSku,
          item.quantity,
          product.stockQuantity,
        );
      }

      const totalPrice = product.price * item.quantity;

      const orderItem: SupplierOrderItem = {
        supplierSku: product.supplierSku,
        internalSku: '', // Will be filled if SKU mapping exists
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice,
      };

      orderItems.push(orderItem);
      totalEstimate += totalPrice;
    }

    // Create supplier order entity
    const supplierOrder = new SupplierOrderEntity({
      id: 0, // Will be assigned by repository
      supplierId,
      orderId: orderId || null,
      items: orderItems,
      status: SupplierOrderStatus.PENDING,
      whatsappMessageTemplate: '',
      sentAt: null,
      confirmedAt: null,
      deliveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate WhatsApp message
    const whatsappMessage = supplierOrder.generateWhatsAppMessage();
    supplierOrder.whatsappMessageTemplate = whatsappMessage;

    // Save order
    const savedOrder = await this.repository.createSupplierOrder(
      supplierOrder,
    );

    // Generate WhatsApp URL
    const whatsappUrl = this.generateWhatsAppUrl(
      supplier.whatsappNumber,
      whatsappMessage,
    );

    return {
      orderId: savedOrder.id,
      supplierId,
      whatsappMessage,
      whatsappUrl,
      items: orderItems,
      itemCount: orderItems.length,
      totalEstimate,
      currency: products[0]?.currency || 'USD',
    };
  }

  async getOrders(supplierId: number): Promise<any[]> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    const orders = await this.repository.getSupplierOrders(supplierId, 100, 0);

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      itemCount: order.items.length,
      totalAmount: order.items.reduce((sum, item) => sum + item.totalPrice, 0),
      createdAt: order.createdAt,
      sentAt: order.sentAt,
      confirmedAt: order.confirmedAt,
      deliveredAt: order.deliveredAt,
    }));
  }

  private generateWhatsAppUrl(
    whatsappNumber: string,
    message: string,
  ): string {
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Remove spaces and special characters from number
    const cleanNumber = whatsappNumber.replace(/[^\d+]/g, '');

    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
  }
}
