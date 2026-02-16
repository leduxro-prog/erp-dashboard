import { Request, Response, NextFunction } from 'express';

import { TypeOrmOrderRepository } from '../../infrastructure/repositories/TypeOrmOrderRepository';
import { OrderMapper, Order } from '../../infrastructure/mappers/OrderMapper';
import { OrderCache } from '../../infrastructure/cache/OrderCache';
import { OrderEntity, OrderStatus } from '../../infrastructure/entities/OrderEntity';
import { OrderStatusMachine } from '../../domain/entities/OrderStatusMachine';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class OrderController {
  constructor(
    private repository: TypeOrmOrderRepository,
    private mapper: OrderMapper,
    private cache: OrderCache,
  ) {}

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        customer_id,
        customer_name,
        customer_email,
        items,
        billing_address,
        shipping_address,
        notes,
      } = req.body;

      if (!customer_id || !items || items.length === 0) {
        res
          .status(400)
          .json(
            errorResponse('INVALID_REQUEST', 'Missing required fields: customer_id, items', 400),
          );
        return;
      }

      // Fetch product cost data for snapshot
      const productIds = items.map((item: any) => item.product_id);
      let productCostMap: Record<string, { cost: number | null; source: string | null }> = {};
      try {
        const costResult = await this.repository.getDataSource().query(
          `SELECT id, base_price,
                    (metadata->>'cost')::numeric as metadata_cost,
                    metadata->>'cost_source' as cost_source
             FROM products WHERE id = ANY($1)`,
          [productIds],
        );
        for (const row of costResult) {
          const cost = row.metadata_cost != null ? parseFloat(row.metadata_cost) : null;
          const estimated = row.base_price ? parseFloat(row.base_price) * 0.7 : null;
          productCostMap[String(row.id)] = {
            cost: cost ?? estimated,
            source:
              cost != null ? row.cost_source || 'metadata' : estimated != null ? 'estimated' : null,
          };
        }
      } catch (_costErr) {
        // Non-fatal: proceed without cost snapshot
      }

      let subtotal = 0;
      const processedItems = items.map((item: any) => {
        const lineTotal = item.quantity * item.unit_price;
        subtotal += lineTotal;
        const costData = productCostMap[String(item.product_id)];
        return {
          ...item,
          line_total: lineTotal,
          cost_price_snapshot: costData?.cost ?? null,
          cost_source: costData?.source ?? null,
        };
      });

      const taxRate = 0.21; // 19% VAT
      const taxAmount = subtotal * taxRate;
      const grandTotal =
        subtotal + taxAmount + (req.body.shipping_cost || 0) - (req.body.discount_amount || 0);

      const orderData: Partial<OrderEntity> = {
        customer_id,
        customer_name,
        customer_email,
        status: OrderStatus.ORDER_CONFIRMED,
        subtotal,
        discount_amount: req.body.discount_amount || 0,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        shipping_cost: req.body.shipping_cost || 0,
        grand_total: grandTotal,
        currency: req.body.currency || 'USD',
        payment_terms: req.body.payment_terms || 'NET30',
        notes,
        billing_address,
        shipping_address,
        created_by: req.user?.id ? String(req.user.id) : null,
      };

      const order = await this.repository.create(orderData, processedItems);
      await this.cache.cacheOrder(order);

      res.status(201).json(successResponse(this.mapper.toDetailDTO(this.mapper.toDomain(order))));
    } catch (error) {
      next(error);
    }
  }

  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as OrderStatus;
      const customerId = req.query.customerId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const search = req.query.search as string;

      const result = await this.repository.list(page, limit, {
        status,
        customerId,
        startDate,
        endDate,
        search,
      });

      res.json(
        paginatedResponse(
          result.data.map((order) => this.mapper.toSummaryDTO(this.mapper.toDomain(order))),
          result.total,
          result.page,
          result.limit,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const cached = await this.cache.getOrder(id);
      if (cached) {
        res.json(successResponse(this.mapper.toDetailDTO(cached)));
        return;
      }

      const order = await this.repository.findById(id);
      if (!order) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found', 404));
        return;
      }

      await this.cache.cacheOrder(order);
      res.json(successResponse(this.mapper.toDetailDTO(this.mapper.toDomain(order))));
    } catch (error) {
      next(error);
    }
  }

  async getOrderByNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderNumber } = req.params;

      const order = await this.repository.findByOrderNumber(orderNumber);
      if (!order) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found', 404));
        return;
      }

      await this.cache.cacheOrder(order);
      res.json(successResponse(this.mapper.toDetailDTO(this.mapper.toDomain(order))));
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Status is required', 400));
        return;
      }

      if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Invalid order status', 400));
        return;
      }

      const order = await this.repository.findById(id);
      if (!order) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found', 404));
        return;
      }

      const oldStatus = order.status;
      const newStatus = status as OrderStatus;
      const transitionValidation = OrderStatusMachine.validateTransition(oldStatus, newStatus);

      if (!transitionValidation.valid) {
        res
          .status(400)
          .json(
            errorResponse(
              'INVALID_TRANSITION',
              transitionValidation.error || 'Invalid status transition',
              400,
            ),
          );
        return;
      }

      if (OrderStatusMachine.requiresNote(oldStatus, newStatus) && !String(notes || '').trim()) {
        res
          .status(400)
          .json(
            errorResponse('INVALID_REQUEST', 'Notes are required for this status transition', 400),
          );
        return;
      }

      const updatedOrder = await this.repository.update(id, { status: newStatus });

      await this.repository.addStatusHistory({
        order_id: id,
        from_status: oldStatus,
        to_status: status,
        changed_by: req.user?.id ? String(req.user.id) : null,
        notes,
      });

      await this.cache.invalidateOrder(id);
      await this.cache.invalidateStatusCounts();

      res.json(successResponse(this.mapper.toDetailDTO(this.mapper.toDomain(updatedOrder))));
    } catch (error) {
      next(error);
    }
  }

  async recordPartialDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { items } = req.body;

      const order = await this.repository.findById(id);
      if (!order) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found', 404));
        return;
      }

      // Update delivery quantities (simplified)
      for (const deliveredItem of items) {
        const orderItem = order.items.find((i) => i.id === deliveredItem.item_id);
        if (orderItem) {
          orderItem.quantity_delivered = deliveredItem.quantity_delivered;
          await this.repository.saveOrderItem(orderItem);
        }
      }

      await this.cache.invalidateOrder(id);
      res.json(successResponse(this.mapper.toDetailDTO(this.mapper.toDomain(order))));
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res
          .status(400)
          .json(errorResponse('INVALID_REQUEST', 'Cancellation reason is required', 400));
        return;
      }

      const order = await this.repository.findById(id);
      if (!order) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found', 404));
        return;
      }

      const oldStatus = order.status;
      const transitionValidation = OrderStatusMachine.validateTransition(
        oldStatus,
        OrderStatus.CANCELLED,
      );
      if (!transitionValidation.valid) {
        res
          .status(400)
          .json(
            errorResponse(
              'INVALID_TRANSITION',
              transitionValidation.error || 'Invalid status transition',
              400,
            ),
          );
        return;
      }

      const updatedOrder = await this.repository.update(id, { status: OrderStatus.CANCELLED });

      await this.repository.addStatusHistory({
        order_id: id,
        from_status: oldStatus,
        to_status: OrderStatus.CANCELLED,
        changed_by: req.user?.id ? String(req.user.id) : null,
        notes: reason,
      });

      await this.cache.invalidateOrder(id);
      res.json(successResponse(this.mapper.toDetailDTO(this.mapper.toDomain(updatedOrder))));
    } catch (error) {
      next(error);
    }
  }

  async generateProforma(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const order = await this.repository.findById(id);
      if (!order) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Order not found', 404));
        return;
      }

      const proformaNumber = `PROF-${Date.now()}`;
      const updated = await this.repository.update(id, { proforma_number: proformaNumber });

      await this.cache.invalidateOrder(id);
      res.json(
        successResponse({
          proforma_number: proformaNumber,
          order: this.mapper.toDetailDTO(this.mapper.toDomain(updated)),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const history = await this.repository.getStatusHistory(id);
      res.json(successResponse(history));
    } catch (error) {
      next(error);
    }
  }

  async getCustomerOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.repository.findByCustomerId(customerId, page, limit);
      res.json(
        paginatedResponse(
          result.data.map((order) => this.mapper.toSummaryDTO(this.mapper.toDomain(order))),
          result.total,
          page,
          limit,
        ),
      );
    } catch (error) {
      next(error);
    }
  }
}
