import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { createModuleLogger } from '@shared/utils/logger';
import { DataSource } from 'typeorm';
import { StockItemEntity } from '../entities/StockItemEntity';
import { LowStockAlertEntity, AlertSeverity } from '../entities/LowStockAlertEntity';
import { EventEmitter } from 'events';

export interface AlertCheckJobDependencies {
  dataSource: DataSource;
  eventEmitter: EventEmitter;
}

export class AlertCheckJob {
  private readonly logger = createModuleLogger('AlertCheckJob');
  private queue: Queue;
  private worker!: Worker;

  constructor(
    private redis: Redis,
    private dependencies: AlertCheckJobDependencies,
  ) {
    this.queue = new Queue('alert-check', { connection: this.redis });
  }

  async initialize(): Promise<void> {
    this.worker = new Worker('alert-check', this.handler.bind(this), {
      connection: this.redis,
      concurrency: 1,
    });

    this.worker.on('completed', (job: Job) => {
      this.logger.info(`Alert check job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(`Alert check job ${job?.id || 'unknown'} failed:`, { error });
    });

    // Schedule job to run every hour
    await this.queue.add('check', {}, {
      repeat: {
        pattern: '0 * * * *',
      },
    });

    this.logger.info('Alert check job initialized (every hour)');
  }

  private async handler(job: Job): Promise<void> {
    this.logger.info(`Starting alert check job ${job.id}`);

    try {
      const stockItemRepo = this.dependencies.dataSource.getRepository(StockItemEntity);
      const alertRepo = this.dependencies.dataSource.getRepository(LowStockAlertEntity);

      // Get all stock items WITH product data using raw SQL JOIN
      const stockItems = await this.dependencies.dataSource.query(`
        SELECT
          s.product_id,
          s.warehouse_id,
          s.quantity,
          s.reserved_quantity,
          s.minimum_threshold,
          p.sku as product_sku,
          p.name as product_name
        FROM stock_items s
        INNER JOIN products p ON p.id = s.product_id
        WHERE p.is_active = true
      `);

      // Get all existing unacknowledged alerts in a single query for the products we're checking
      const productWarehouseKeys = stockItems.map((item: any) => ({
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
      }));

      const existingAlerts = await alertRepo
        .createQueryBuilder('alert')
        .where('alert.acknowledged = :acknowledged', { acknowledged: false })
        .andWhere(
          `(alert.product_id, alert.warehouse_id) IN (
            ${stockItems.map((_: any, idx: number) => `(:p_${idx}, :w_${idx})`).join(', ')}
          )`,
          stockItems.reduce((acc: Record<string, string>, item: any, idx: number) => {
            acc[`p_${idx}`] = item.product_id;
            acc[`w_${idx}`] = item.warehouse_id;
            return acc;
          }, {} as Record<string, string>),
        )
        .getMany();

      // Create a Set for O(1) lookup of existing alerts
      const existingAlertSet = new Set(
        existingAlerts.map(a => `${a.product_id}:${a.warehouse_id}`),
      );

      const alertsToCreate: Partial<LowStockAlertEntity>[] = [];

      // Filter in memory - determine which alerts need to be created
      for (const item of stockItems) {
        const availableQuantity = item.quantity - item.reserved_quantity;

        // Check if stock is low
        if (availableQuantity <= item.minimum_threshold) {
          // Check if alert already exists using set lookup (O(1))
          const alertKey = `${item.product_id}:${item.warehouse_id}`;
          if (!existingAlertSet.has(alertKey)) {
            // Determine severity
            const severity =
              availableQuantity <= Math.ceil(item.minimum_threshold * 0.5)
                ? AlertSeverity.CRITICAL
                : AlertSeverity.LOW;

            // Validate product data (should always exist due to INNER JOIN)
            if (!item.product_sku || !item.product_name) {
              this.logger.warn('Stock item missing product data', {
                product_id: item.product_id,
                warehouse_id: item.warehouse_id,
              });
              continue;
            }

            alertsToCreate.push({
              id: crypto.randomUUID(),
              product_id: item.product_id,
              product_sku: item.product_sku,    // Real SKU from products table
              product_name: item.product_name,  // Real name from products table
              warehouse_id: item.warehouse_id,
              current_quantity: availableQuantity,
              minimum_threshold: item.minimum_threshold,
              severity,
            });
          }
        }
      }

      // Bulk insert alerts
      if (alertsToCreate.length > 0) {
        await alertRepo.insert(alertsToCreate);
        this.logger.info(`Created ${alertsToCreate.length} low stock alerts`);

        // Publish event
        this.dependencies.eventEmitter.emit('inventory.low_stock', {
          count: alertsToCreate.length,
          alerts: alertsToCreate,
        });
      }

      this.logger.info('Alert check completed successfully');
    } catch (error) {
      this.logger.error('Alert check failed:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
