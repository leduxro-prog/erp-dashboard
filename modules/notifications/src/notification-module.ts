/**
 * Notifications Module
 * Main module implementation of ICypherModule
 * Handles email, SMS, WhatsApp, In-App, and Push notifications
 *
 * Features:
 * - Multi-channel notification delivery
 * - Template-based notification rendering
 * - Customer notification preferences with quiet hours
 * - Batch notification sending
 * - Automatic retry with exponential backoff
 * - Event-driven architecture
 */
import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system';
import { createModuleLogger } from '@shared/utils/logger';
import { NotificationsCompositionRoot } from './infrastructure/composition-root';
import { createNotificationsRouter } from './api/routes/notification.routes';

const logger = createModuleLogger('notifications');

/**
 * Notifications Module
 *
 * ### Published Events
 * - `notification.created`: New notification created
 * - `notification.queued`: Notification queued for sending
 * - `notification.sent`: Notification sent successfully
 * - `notification.delivered`: Notification delivered to recipient
 * - `notification.failed`: Notification delivery failed
 * - `notification.expired`: Notification expired (too old)
 *
 * ### Subscribed Events
 * - `order.created`: Send order confirmation notification
 * - `order.shipped`: Send shipment notification
 * - `order.delivered`: Send delivery notification
 * - `quote.sent`: Send quote notification
 * - `quote.expiring`: Send quote expiration reminder
 * - `inventory.low_stock`: Send low stock alert
 * - `b2b.registration`: Send registration confirmation
 *
 * ### Architecture
 * - **Domain**: Notification, NotificationTemplate, NotificationPreference entities
 * - **Application**: Use-cases for sending, processing, and managing notifications
 * - **Infrastructure**: TypeORM repositories, channel providers (Email, SMS, WhatsApp, Push)
 * - **API**: REST endpoints for notification management
 *
 * ### Performance
 * - Async queue processing with BullMQ
 * - Batch sending support
 * - Automatic retries with exponential backoff (max 3 retries)
 * - Customer preference checks and quiet hours enforcement
 * - Event-driven delivery status updates
 *
 * @version 1.0.0
 */
export default class NotificationsModule implements ICypherModule {
  readonly name = 'notifications';
  readonly version = '1.0.0';
  readonly description =
    'Multi-channel notification system: Email, SMS, WhatsApp, In-App, Push';
  readonly dependencies: string[] = []; // No module dependencies
  readonly publishedEvents = [
    'notification.created',
    'notification.queued',
    'notification.sent',
    'notification.delivered',
    'notification.failed',
    'notification.expired',
  ];
  readonly subscribedEvents = [
    'order.created',
    'order.shipped',
    'order.delivered',
    'quote.sent',
    'quote.expiring',
    'inventory.low_stock',
    'b2b.registration',
    'b2b.registration_submitted',
    'b2b.bulk_order',
  ];
  readonly featureFlag?: string;

  private context!: IModuleContext;
  private compositionRoot!: NotificationsCompositionRoot;
  private router!: Router;
  private isStarted = false;
  private queueProcessorTimer?: NodeJS.Timeout;
  private queueProcessorRunning = false;

  // Metrics tracking
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    responseTimes: [] as number[],
    eventCount: { published: 0, received: 0 },
    notificationsSent: 0,
    notificationsFailed: 0,
  };

  /**
   * Initialize the Notifications module
   */
  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing Notifications module');

    try {
      // Verify database connection
      if (!context.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      // Create composition root (dependency injection)
      logger.debug('Creating composition root');
      this.compositionRoot = new NotificationsCompositionRoot({
        dataSource: context.dataSource,
        logger: context.logger,
        eventBus: context.eventBus,
      });

      // Log Resend adapter status
      const resendAdapter = this.compositionRoot.getResendAdapter();
      if (resendAdapter) {
        logger.info('Resend email adapter is ready for use');
      } else {
        logger.warn('Resend adapter not available - check RESEND_API_KEY configuration');
      }

      // Create Express router
      logger.debug('Creating API routes');
      this.router = createNotificationsRouter(this.compositionRoot);

      logger.info('Notifications module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Notifications module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Start the Notifications module
   */
  async start(): Promise<void> {
    logger.info('Starting Notifications module');

    try {
      // Subscribe to domain events
      logger.debug('Subscribing to events');

      await this.context.eventBus.subscribe('order.created', (data) => {
        this.onOrderCreated(data).catch((err) => {
          logger.error('Error handling order.created event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('order.shipped', (data) => {
        this.onOrderShipped(data).catch((err) => {
          logger.error('Error handling order.shipped event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('quote.sent', (data) => {
        this.onQuoteSent(data).catch((err) => {
          logger.error('Error handling quote.sent event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('b2b.bulk_order', (data) => {
        this.onB2BBulkOrder(data).catch((err) => {
          logger.error('Error handling b2b.bulk_order event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('b2b.registration_submitted', (data) => {
        this.onB2BRegistrationSubmitted(data).catch((err) => {
          logger.error('Error handling b2b.registration_submitted event', { error: err });
          this.metrics.errorCount++;
        });
      });

      // Additional event subscriptions can be added here

      // Start queue processor loop for fallback/batched notifications
      const processQueue = async () => {
        if (this.queueProcessorRunning) {
          return;
        }

        this.queueProcessorRunning = true;
        try {
          const useCase = this.compositionRoot.getProcessQueueUseCase();
          await useCase.execute(100);
        } catch (err) {
          logger.error('Error processing notification queue', {
            error: err instanceof Error ? err.message : String(err),
          });
          this.metrics.errorCount++;
        } finally {
          this.queueProcessorRunning = false;
        }
      };

      await processQueue();
      this.queueProcessorTimer = setInterval(() => {
        processQueue().catch(() => {
          // Process-level error handled inside processQueue
        });
      }, 30000);

      this.queueProcessorTimer.unref();

      this.isStarted = true;
      logger.info('Notifications module started successfully');
    } catch (error) {
      logger.error('Failed to start Notifications module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the Notifications module gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping Notifications module');

    try {
      if (this.queueProcessorTimer) {
        clearInterval(this.queueProcessorTimer);
        this.queueProcessorTimer = undefined;
      }
      this.isStarted = false;
      logger.info('Notifications module stopped successfully');
    } catch (error) {
      logger.warn('Error stopping Notifications module', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw on shutdown
    }
  }

  /**
   * Get health status of the Notifications module
   */
  async getHealth(): Promise<IModuleHealth> {
    const details: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check database
    try {
      const startTime = Date.now();
      await this.context.dataSource.query('SELECT 1');
      const latency = Date.now() - startTime;

      details.database = {
        status: 'up',
        latency,
        message: 'Database connection healthy',
      };
    } catch (error) {
      overallStatus = 'unhealthy';
      details.database = {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database error',
      };
    }

    // Module status
    details.module = {
      status: this.isStarted ? 'up' : 'down',
      message: this.isStarted ? 'Module started' : 'Module not started',
    };

    return {
      status: overallStatus,
      details,
      lastChecked: new Date(),
    };
  }

  /**
   * Get Express router for this module
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get metrics collected by this module
   */
  getMetrics(): IModuleMetrics {
    const avgResponseTime =
      this.metrics.responseTimes.length > 0
        ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) /
          this.metrics.responseTimes.length
        : 0;

    return {
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      avgResponseTime,
      activeWorkers: 0, // Would be updated by background jobs
      cacheHitRate: 0,
      eventCount: this.metrics.eventCount,
    };
  }

  /**
   * Handle order created event
   */
  private async onOrderCreated(data: unknown): Promise<void> {
    logger.debug('Order created event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Send order confirmation notification
  }

  /**
   * Handle order shipped event
   */
  private async onOrderShipped(data: unknown): Promise<void> {
    logger.debug('Order shipped event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Send shipment notification
  }

  /**
   * Handle quote sent event
   */
  private async onQuoteSent(data: unknown): Promise<void> {
    logger.debug('Quote sent event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Send quote notification
  }

  /**
   * Handle B2B bulk order event
   */
  private async onB2BBulkOrder(data: unknown): Promise<void> {
    logger.debug('B2B bulk order event received', { data });
    this.metrics.eventCount.received++;

    const adminEmail = process.env.B2B_ADMIN_EMAIL || process.env.EMAIL_FROM;
    if (!adminEmail) {
      return;
    }

    const payload = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
    const orderNumber = String(payload.orderNumber || payload.orderId || 'unknown');
    const customerId = String(payload.customerId || 'unknown');
    const totalAmount = String(payload.totalAmount || '0');

    const useCase = this.compositionRoot.getSendNotificationUseCase();
    await useCase.execute({
      recipientId: 'b2b-admin',
      recipientEmail: adminEmail,
      channel: 'EMAIL',
      subject: `New B2B bulk order ${orderNumber}`,
      body: `Bulk order ${orderNumber} was submitted by customer ${customerId}. Total: ${totalAmount}.`,
      data: payload,
      priority: 'NORMAL',
    });
  }

  /**
   * Handle B2B registration submitted event
   */
  private async onB2BRegistrationSubmitted(data: unknown): Promise<void> {
    logger.debug('B2B registration submitted event received', { data });
    this.metrics.eventCount.received++;
  }
}

// Export the module for auto-discovery
export { NotificationsModule };
