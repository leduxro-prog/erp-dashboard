
import { TypeOrmOrderRepository } from '../../infrastructure/repositories/TypeOrmOrderRepository';
import { IInventoryRepository } from '../../../../inventory/src/domain/ports/IInventoryRepository';
import { OrderStatus, PaymentStatus } from '../../infrastructure/entities/OrderEntity';
import { StockMovementType, ReferenceType } from '../../../../inventory/src/infrastructure/entities/StockMovementEntity';

export interface OfflineTransaction {
    orderNumber: string;
    customerId: number;
    customerUuid?: string;
    customerName: string;
    customerEmail: string;
    items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        productName: string;
    }>;
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    createdAt: string; // ISO string
    payments: any[];
}

export interface SyncResult {
    synced: number;
    failed: number;
    errors: Array<{ orderNumber: string; error: string }>;
}

export class OfflineTransactionService {
    constructor(
        private orderRepository: TypeOrmOrderRepository,
        private inventoryRepository: IInventoryRepository
    ) { }

    async syncOfflineTransactions(transactions: OfflineTransaction[]): Promise<SyncResult> {
        const result: SyncResult = {
            synced: 0,
            failed: 0,
            errors: [],
        };

        const sortedTransactions = [...transactions].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const tx of sortedTransactions) {
            try {
                // 1. Idempotency Check
                const existingOrder = await this.orderRepository.findByOrderNumber(tx.orderNumber);
                if (existingOrder) {
                    result.synced++;
                    continue;
                }

                // 2. Stock Validation (Logging only)
                for (const item of tx.items) {
                    const stockLevels = await this.inventoryRepository.getStockLevel(item.productId);
                    const totalAvailable = stockLevels.reduce((sum, s) => sum + s.available_quantity, 0);

                    if (totalAvailable < item.quantity) {
                        console.warn(`[OFFLINE_SYNC_CONFLICT] Order ${tx.orderNumber}: Product ${item.productId} has ${totalAvailable} available, sold ${item.quantity}`);
                    }
                }

                // 3. Create Order
                const addressMock = {
                    name: tx.customerName || 'Offline Customer',
                    street: 'Offline Walk-in',
                    city: 'Unknown',
                    county: 'Unknown',
                    postalCode: '000000',
                    country: 'Romania'
                };

                const itemEntities = tx.items.map(item => ({
                    product_id: item.productId,
                    product_name: item.productName,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    line_total: item.quantity * item.unitPrice,
                    tax_rate: 0.21,
                    tax_amount: (item.quantity * item.unitPrice) * 0.21
                }));

                const orderData: any = {
                    order_number: tx.orderNumber,
                    customer_id: tx.customerUuid || '00000000-0000-0000-0000-000000000000',
                    customer_name: tx.customerName,
                    customer_email: tx.customerEmail,
                    status: OrderStatus.DELIVERED,
                    subtotal: tx.subtotal,
                    discount_amount: 0,
                    tax_rate: 0.21,
                    tax_amount: tx.taxAmount,
                    shipping_cost: 0,
                    grand_total: tx.grandTotal,
                    currency: 'RON',
                    payment_terms: 'immediate',
                    payment_status: PaymentStatus.PAID,
                    billing_address: addressMock,
                    shipping_address: addressMock,
                    created_by: null,
                    offline_synced_at: new Date(),
                    offline_original_timestamp: new Date(tx.createdAt)
                };

                await this.orderRepository.create(orderData, itemEntities);

                // 4. Update Inventory
                const warehouses = await this.inventoryRepository.getWarehouses();
                const defaultWarehouse = warehouses[0]?.id;

                if (defaultWarehouse) {
                    for (const item of tx.items) {
                        await this.inventoryRepository.recordMovement(
                            item.productId,
                            defaultWarehouse,
                            {
                                product_id: item.productId,
                                warehouse_id: defaultWarehouse,
                                movement_type: StockMovementType.OUT,
                                quantity: -item.quantity,
                                new_quantity: 0,
                                previous_quantity: 0,
                                reference_type: ReferenceType.SALES_ORDER,
                                reference_id: tx.orderNumber,
                                reason: 'Offline Sync'
                            },
                            'offline_sync_system'
                        );
                    }
                }

                result.synced++;

            } catch (error: any) {
                console.error(`Failed to sync order ${tx.orderNumber}:`, error);
                result.failed++;
                result.errors.push({ orderNumber: tx.orderNumber, error: error.message });
            }
        }

        return result;
    }
}
