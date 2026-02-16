import { Repository, DataSource, Between, ILike, In, FindOptionsWhere } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { OrderEntity, OrderStatus } from '../entities/OrderEntity';
import { OrderItemEntity } from '../entities/OrderItemEntity';
import { OrderStatusHistoryEntity } from '../entities/OrderStatusHistoryEntity';

export interface IOrderRepository {
  create(order: Partial<OrderEntity>, items: Partial<OrderItemEntity>[]): Promise<OrderEntity>;
  findById(id: string): Promise<OrderEntity | null>;
  findByOrderNumber(orderNumber: string): Promise<OrderEntity | null>;
  update(id: string, data: Partial<OrderEntity>): Promise<OrderEntity>;
  list(
    page: number,
    limit: number,
    filters?: {
      status?: OrderStatus;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    },
  ): Promise<{ data: OrderEntity[]; total: number; page: number; limit: number }>;
  findByCustomerId(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: OrderEntity[]; total: number }>;
  delete(id: string): Promise<boolean>;
  saveOrderItem(item: OrderItemEntity): Promise<OrderItemEntity>;
  addStatusHistory(history: Partial<OrderStatusHistoryEntity>): Promise<OrderStatusHistoryEntity>;
  getStatusHistory(orderId: string): Promise<OrderStatusHistoryEntity[]>;
}

@Injectable()
export class TypeOrmOrderRepository implements IOrderRepository {
  private orderRepository: Repository<OrderEntity>;
  private itemRepository: Repository<OrderItemEntity>;
  private historyRepository: Repository<OrderStatusHistoryEntity>;

  constructor(@InjectDataSource() private dataSource: DataSource) {
    this.orderRepository = dataSource.getRepository(OrderEntity);
    this.itemRepository = dataSource.getRepository(OrderItemEntity);
    this.historyRepository = dataSource.getRepository(OrderStatusHistoryEntity);
  }

  /** Expose DataSource for ad-hoc queries (e.g., cost lookups) */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  async create(
    order: Partial<OrderEntity>,
    items: Partial<OrderItemEntity>[],
  ): Promise<OrderEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate order number: ORD-YYYYMMDD-XXXX
      // Use MAX with FOR UPDATE to prevent race conditions in concurrent inserts
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const datePrefix = `ORD-${dateStr}-`;
      const result = await queryRunner.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 AS next_num
         FROM orders
         WHERE order_number LIKE $1
         FOR UPDATE`,
        [`${datePrefix}%`],
      );
      const sequence = String(result[0].next_num).padStart(4, '0');
      order.order_number = `${datePrefix}${sequence}`;

      const savedOrder = await queryRunner.manager.save(OrderEntity, order);

      const itemsWithOrderId = items.map((item) => ({
        ...item,
        order_id: savedOrder.id,
      }));

      await queryRunner.manager.save(OrderItemEntity, itemsWithOrderId);

      await queryRunner.commitTransaction();

      return this.findById(savedOrder.id) as Promise<OrderEntity>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'status_history', 'customer'],
      order: {
        status_history: { changed_at: 'DESC' },
      },
    });
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderEntity | null> {
    return this.orderRepository.findOne({
      where: { order_number: orderNumber },
      relations: ['items', 'items.product', 'status_history', 'customer'],
      order: {
        status_history: { changed_at: 'DESC' },
      },
    });
  }

  async update(id: string, data: Partial<OrderEntity>): Promise<OrderEntity> {
    await this.orderRepository.update(id, data);
    const updated = await this.findById(id);
    if (!updated) throw new Error('Order not found after update');
    return updated;
  }

  async list(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: OrderStatus;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    },
  ): Promise<{ data: OrderEntity[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    let where: FindOptionsWhere<OrderEntity> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.customerId) {
      where.customer_id = filters.customerId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.created_at = Between(filters?.startDate || new Date(0), filters?.endDate || new Date());
    }

    let [data, total] = await this.orderRepository.findAndCount({
      where,
      relations: ['items', 'items.product', 'status_history', 'customer'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    if (filters?.search) {
      data = data.filter(
        (order) =>
          order.order_number.includes(filters.search!) ||
          order.customer_name.toLowerCase().includes(filters.search!.toLowerCase()),
      );
    }

    return { data, total, page, limit };
  }

  async findByCustomerId(
    customerId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: OrderEntity[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.orderRepository.findAndCount({
      where: { customer_id: customerId },
      relations: ['items', 'items.product', 'status_history', 'customer'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return { data, total };
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.orderRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async saveOrderItem(item: OrderItemEntity): Promise<OrderItemEntity> {
    return this.itemRepository.save(item);
  }

  async addStatusHistory(
    history: Partial<OrderStatusHistoryEntity>,
  ): Promise<OrderStatusHistoryEntity> {
    return this.historyRepository.save(history);
  }

  async getStatusHistory(orderId: string): Promise<OrderStatusHistoryEntity[]> {
    return this.historyRepository.find({
      where: { order_id: orderId },
      order: { changed_at: 'DESC' },
    });
  }
}
