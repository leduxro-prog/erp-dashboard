import { Request, Response } from 'express';
import { ISyncRepository } from '../../application/ports/ISyncRepository';
import { SyncProduct } from '../../application/use-cases/SyncProduct';
import { SyncAllProducts } from '../../application/use-cases/SyncAllProducts';
import { SyncStock } from '../../application/use-cases/SyncStock';
import { SyncPrice } from '../../application/use-cases/SyncPrice';
import { SyncCategories } from '../../application/use-cases/SyncCategories';
import { PullOrders } from '../../application/use-cases/PullOrders';
import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { SyncError, WooCommerceError } from '../../application/errors/woocommerce.errors';
import { successResponse, errorResponse } from '@shared/utils/response';
import { createModuleLogger } from '@shared/utils/logger';
import { mapWooOrderToErp } from '@shared/constants/status-mapping';

const logger = createModuleLogger('woocommerce-controller');

export class WooCommerceController {
  constructor(
    private syncRepository: ISyncRepository,
    private syncProductUseCase: SyncProduct,
    private syncAllProductsUseCase: SyncAllProducts,
    private syncStockUseCase: SyncStock,
    private syncPriceUseCase: SyncPrice,
    private syncCategoriesUseCase: SyncCategories,
    private pullOrdersUseCase: PullOrders,
    private apiClient?: IWooCommerceClient,
  ) {}

  /**
   * Test WooCommerce API connection
   * Verifies credentials and API accessibility by fetching categories
   */
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Testing WooCommerce API connection');

      if (!this.apiClient) {
        res
          .status(500)
          .json(
            errorResponse(
              'CLIENT_NOT_INITIALIZED',
              'WooCommerce API client is not initialized',
              500,
            ),
          );
        return;
      }

      // Test connection by fetching categories (lightweight operation)
      const categories = await this.apiClient.getCategories();

      logger.info('WooCommerce API connection test successful', {
        categoriesCount: categories.length,
      });

      res.json(
        successResponse({
          connected: true,
          message: 'WooCommerce API connection successful',
          details: {
            url: process.env.WOOCOMMERCE_URL || 'https://ledux.ro',
            version: 'wc/v3',
            categoriesFound: categories.length,
            timestamp: new Date(),
          },
        }),
      );
    } catch (error) {
      logger.error('WooCommerce API connection test failed', { error });
      res
        .status(500)
        .json(
          errorResponse(
            'CONNECTION_FAILED',
            error instanceof Error ? error.message : 'Failed to connect to WooCommerce API',
            500,
          ),
        );
    }
  }

  async syncSingleProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const result = await this.syncProductUseCase.execute(productId);

      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncAllProducts(req: Request, res: Response): Promise<void> {
    try {
      const { force } = req.body || {};

      const result = await this.syncAllProductsUseCase.execute(force || false);

      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const result = await this.syncStockUseCase.execute(productId);

      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncPrice(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const result = await this.syncPriceUseCase.execute(productId);

      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async syncCategories(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.syncCategoriesUseCase.execute();

      res.json(successResponse(result));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async pullOrders(req: Request, res: Response): Promise<void> {
    try {
      const { since } = req.body || {};
      const sinceDate = since ? new Date(since) : undefined;

      const orders = await this.pullOrdersUseCase.execute(sinceDate);

      res.json(successResponse(orders, { count: orders.length, timestamp: new Date() }));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.syncRepository.getSyncStats();

      res.json(successResponse(stats, { timestamp: new Date() }));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getFailedItems(req: Request, res: Response): Promise<void> {
    try {
      const failedItems = await this.syncRepository.getFailedItems();

      res.json(successResponse(failedItems, { count: failedItems.length, timestamp: new Date() }));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async retryFailedSync(req: Request, res: Response): Promise<void> {
    try {
      const failedItems = await this.syncRepository.getFailedItems();

      let retried = 0;

      for (const item of failedItems) {
        if (item.canRetry()) {
          item.reset();
          await this.syncRepository.updateSyncItem(item);
          retried++;
        }
      }

      res.json(
        successResponse({ totalFailed: failedItems.length, retried }, { timestamp: new Date() }),
      );
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getProductMapping(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const mapping = await this.syncRepository.getMapping(productId);

      if (!mapping) {
        res
          .status(404)
          .json(errorResponse('NOT_FOUND', `No mapping found for product: ${productId}`, 404));
        return;
      }

      res.json(successResponse(mapping, { timestamp: new Date() }));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    logger.error('[WC Sync] Error:', { error });

    if (error instanceof SyncError) {
      res.status(400).json(errorResponse('SYNC_ERROR', error.message, 400));
      return;
    }

    if (error instanceof WooCommerceError) {
      res.status(500).json(errorResponse('WOOCOMMERCE_ERROR', error.message, 500));
      return;
    }

    res
      .status(500)
      .json(
        errorResponse(
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
          500,
        ),
      );
  }

  /**
   * Handle incoming WooCommerce webhook
   *
   * Supports topics: order.created, order.updated, order.deleted,
   * product.created, product.updated, product.deleted
   *
   * This is the real WooCommerce -> ERP intake endpoint.
   * Protected by HMAC signature verification + idempotency middleware.
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const topic =
      (req as any).webhookMeta?.topic || (req.headers['x-wc-webhook-topic'] as string) || 'unknown';
    const webhookId = (req as any).webhookMeta?.webhookId || 'unknown';

    try {
      logger.info('WooCommerce webhook received', { topic, webhookId });

      const payload = req.body;

      switch (topic) {
        case 'order.created':
        case 'order.updated': {
          // Map WooCommerce order to ERP order via PullOrders use-case event
          const erpStatus = payload?.status ? mapWooOrderToErp(payload.status) : undefined;
          await this.pullOrdersUseCase.execute();
          logger.info('WooCommerce order processed via pull', {
            wcOrderId: payload?.id,
            wcStatus: payload?.status,
            erpStatus,
            topic,
          });
          break;
        }

        case 'order.deleted': {
          logger.info('WooCommerce order deletion received', {
            wcOrderId: payload?.id,
          });
          // Order deletion is logged but not auto-cancelled in ERP
          // (business rule: manual review required)
          break;
        }

        case 'product.created':
        case 'product.updated': {
          if (payload?.id) {
            await this.syncProductUseCase.execute(String(payload.id));
            logger.info('WooCommerce product synced', {
              wcProductId: payload.id,
              topic,
            });
          }
          break;
        }

        case 'product.deleted': {
          logger.info('WooCommerce product deletion received', {
            wcProductId: payload?.id,
          });
          break;
        }

        default:
          logger.warn('Unknown webhook topic', { topic, webhookId });
      }

      res.status(200).json({
        status: 'processed',
        topic,
        webhook_id: webhookId,
      });
    } catch (error) {
      logger.error('Webhook processing failed', {
        topic,
        webhookId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        status: 'error',
        topic,
        webhook_id: webhookId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
