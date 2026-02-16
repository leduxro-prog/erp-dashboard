import { Router } from 'express';
import { DataSource } from 'typeorm';

import {
  IB2BCustomerRepository,
  IRegistrationRepository,
  ISavedCartRepository,
  IBulkOrderRepository,
  ICreditTransactionRepository,
  IB2BSyncEventRepository,
} from '../domain/repositories';

import {
  RegisterB2B,
  ReviewRegistration,
  ConvertCartToOrder,
  SyncOrderStatusFromB2B,
  SyncOrderToB2BPortal,
  SyncInvoiceStatusFromB2B,
  SyncInvoiceToB2BPortal,
} from '../application/use-cases';

import { TypeOrmB2BCustomerRepository } from './repositories/TypeOrmB2BCustomerRepository';
import { TypeOrmRegistrationRepository } from './repositories/TypeOrmRegistrationRepository';
import { TypeOrmSavedCartRepository } from './repositories/TypeOrmSavedCartRepository';
import { TypeOrmBulkOrderRepository } from './repositories/TypeOrmBulkOrderRepository';
import { TypeOrmCreditTransactionRepository } from './repositories/TypeOrmCreditTransactionRepository';
import { TypeOrmB2BSyncEventRepository } from './repositories/TypeOrmB2BSyncEventRepository';

import { OrderServiceAdapter } from './adapters/OrderServiceAdapter';
import { NotificationServiceAdapter } from './adapters/NotificationServiceAdapter';

import { B2BController } from '../api/controllers/B2BController';
import { B2BOrderController } from '../api/controllers/B2BOrderController';
import { B2BCartController } from '../api/controllers/B2BCartController';
import { B2BCheckoutController } from '../api/controllers/B2BCheckoutController';
import { B2BInvoiceController } from '../api/controllers/B2BInvoiceController';
import { B2BCustomerController } from '../api/controllers/B2BCustomerController';
import { B2BPaymentController } from '../api/controllers/B2BPaymentController';
import { B2BFavoritesController } from '../api/controllers/B2BFavoritesController';
import { B2BPortalWebhookController } from '../api/controllers/B2BPortalWebhookController';
import { B2BPortalSyncController } from '../api/controllers/B2BPortalSyncController';

import { createB2BRoutes } from '../api/routes/b2b.routes';

import { CuiValidationService } from '../domain/services/CuiValidationService';
import { CreditService } from '../domain/services/CreditService';
import { TierCalculationService } from '../domain/services/TierCalculationService';
import { B2BPortalApiClient } from './services/B2BPortalApiClient';
import { B2BPortalStatusMapper } from './services/B2BPortalStatusMapper';

interface B2BPortalModuleConfig {
  /**
   * B2B Portal API configuration
   */
  b2bPortal?: {
    baseUrl: string;
    apiKey: string;
    apiSecret?: string;
    merchantId: string;
    timeout?: number;
    maxRetries?: number;
  };
}

export function createB2BPortalRouter(
  dataSource: DataSource,
  eventBus?: { publish(channel: string, data: unknown): Promise<void> },
  config?: B2BPortalModuleConfig,
): Router {
  const registrationRepository: IRegistrationRepository = new TypeOrmRegistrationRepository(
    dataSource,
  );
  const customerRepository: IB2BCustomerRepository = new TypeOrmB2BCustomerRepository(dataSource);
  const savedCartRepository: ISavedCartRepository = new TypeOrmSavedCartRepository(dataSource);
  const bulkOrderRepository: IBulkOrderRepository = new TypeOrmBulkOrderRepository(dataSource);
  const creditTransactionRepository: ICreditTransactionRepository =
    new TypeOrmCreditTransactionRepository(dataSource);
  const syncEventRepository: IB2BSyncEventRepository = new TypeOrmB2BSyncEventRepository(
    dataSource,
  );

  const orderPort = new OrderServiceAdapter(dataSource);
  const notificationPort = new NotificationServiceAdapter(dataSource);

  const cuiValidationService = new CuiValidationService();
  const creditService = new CreditService();
  const tierService = new TierCalculationService();

  // Event publisher function
  const publishEvent = async (event: string, data: unknown): Promise<void> => {
    if (eventBus && typeof eventBus.publish === 'function') {
      await eventBus.publish(event, data);
      return;
    }
    console.log(`Event (fallback): ${event}`, data);
  };

  // B2B Portal Integration Services
  let apiClient: B2BPortalApiClient | undefined;
  let statusMapper: B2BPortalStatusMapper;

  if (config?.b2bPortal) {
    apiClient = new B2BPortalApiClient(config.b2bPortal);
    statusMapper = new B2BPortalStatusMapper();
  } else {
    // Create status mapper even without API config (for status mapping functions)
    statusMapper = new B2BPortalStatusMapper();
  }

  // Use cases
  const registerB2B = new RegisterB2B(
    registrationRepository,
    cuiValidationService,
    publishEvent,
    async (data: unknown) => {
      await notificationPort.sendNotification(data as any);
    },
    dataSource,
  );

  const reviewRegistration = new ReviewRegistration(
    registrationRepository,
    customerRepository,
    tierService,
    publishEvent,
    async (data: unknown) => {
      await notificationPort.sendNotification(data as any);
    },
    dataSource,
  );

  const convertCartToOrder = new ConvertCartToOrder(
    savedCartRepository,
    customerRepository,
    creditTransactionRepository,
    orderPort,
    creditService,
    publishEvent,
  );

  // B2B Portal Sync Use Cases
  let syncOrderStatusFromB2B: SyncOrderStatusFromB2B | undefined;
  let syncOrderToB2BPortal: SyncOrderToB2BPortal | undefined;
  let syncInvoiceStatusFromB2B: SyncInvoiceStatusFromB2B | undefined;
  let syncInvoiceToB2BPortal: SyncInvoiceToB2BPortal | undefined;

  if (apiClient) {
    syncOrderStatusFromB2B = new SyncOrderStatusFromB2B(
      syncEventRepository,
      apiClient,
      statusMapper,
      dataSource,
      publishEvent,
    );

    syncOrderToB2BPortal = new SyncOrderToB2BPortal(
      syncEventRepository,
      apiClient,
      statusMapper,
      dataSource,
      publishEvent,
    );

    syncInvoiceStatusFromB2B = new SyncInvoiceStatusFromB2B(
      syncEventRepository,
      apiClient,
      statusMapper,
      dataSource,
      publishEvent,
    );

    syncInvoiceToB2BPortal = new SyncInvoiceToB2BPortal(
      syncEventRepository,
      apiClient,
      statusMapper,
      dataSource,
      publishEvent,
    );
  }

  // Controllers
  const b2bController = new B2BController(
    registerB2B,
    reviewRegistration,
    convertCartToOrder,
    registrationRepository,
    customerRepository,
    savedCartRepository,
    bulkOrderRepository,
    creditTransactionRepository,
    dataSource,
  );

  const b2bOrderController = new B2BOrderController(dataSource);

  const b2bCartController = new B2BCartController(dataSource, customerRepository);

  const b2bCheckoutController = new B2BCheckoutController(dataSource);

  const b2bInvoiceController = new B2BInvoiceController(dataSource);

  const b2bCustomerController = new B2BCustomerController(dataSource);

  const b2bPaymentController = new B2BPaymentController(dataSource);

  const b2bFavoritesController = new B2BFavoritesController(dataSource);

  // Webhook controller (created if B2B Portal is configured)
  const webhookController = apiClient
    ? new B2BPortalWebhookController(dataSource, apiClient, statusMapper)
    : undefined;

  // Sync controller (always available for status queries)
  const syncController = new B2BPortalSyncController(dataSource);

  return createB2BRoutes(
    b2bController,
    b2bOrderController,
    b2bCartController,
    b2bCheckoutController,
    b2bInvoiceController,
    b2bCustomerController,
    b2bPaymentController,
    b2bFavoritesController,
    webhookController,
    syncController,
  );
}

// Export services for external use
export {
  B2BPortalModuleConfig,
  B2BPortalApiClient,
  B2BPortalStatusMapper,
  SyncOrderStatusFromB2B,
  SyncOrderToB2BPortal,
  SyncInvoiceStatusFromB2B,
  SyncInvoiceToB2BPortal,
};
