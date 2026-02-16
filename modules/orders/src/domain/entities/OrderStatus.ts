/**
 * Order Status Enumeration
 * Re-exports the canonical OrderStatus from shared/constants (matches DB enum exactly).
 *
 * Previously had divergent members WAITING_DELIVERY and PHOTO_ADDED;
 * now unified to AWAITING_DELIVERY and RETURNED to match the PostgreSQL
 * `order_status` type and shared/constants/order-statuses.ts (14 states).
 */
export { OrderStatus } from '@shared/constants/order-statuses';
import { OrderStatus } from '@shared/constants/order-statuses';

export type OrderStatusType = OrderStatus | string;
