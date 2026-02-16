import { IOrderPort, Order } from '../../application/ports';
import { DataSource } from 'typeorm';

export class OrderServiceAdapter implements IOrderPort {
    constructor(private readonly dataSource: DataSource) { }

    async createOrder(data: {
        customerId: string;
        items: Array<{
            productId: string;
            quantity: number;
            unitPrice: number;
        }>;
        notes?: string;
    }): Promise<Order> {
        const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const orderNumber = `B2B-CART-${Date.now()}`;

        return this.dataSource.transaction(async (manager) => {
            const orderRows = await manager.query(
                `INSERT INTO orders (order_number, customer_id, status, total_amount, currency_code, shipping_address, notes, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                 RETURNING id, customer_id, total_amount, status, created_at`,
                [orderNumber, data.customerId, 'pending', totalAmount, 'RON', '', data.notes || '']
            );

            const order = orderRows[0];

            for (const item of data.items) {
                await manager.query(
                    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                    [order.id, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
                );
            }

            return {
                id: String(order.id),
                customerId: String(order.customer_id),
                totalAmount: parseFloat(order.total_amount),
                itemCount: data.items.length,
                status: String(order.status).toUpperCase(),
                createdAt: new Date(order.created_at),
            };
        });
    }
}
