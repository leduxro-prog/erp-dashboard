import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';

import { createOrderRoutes } from '../../modules/orders/src/api/routes/order.routes';
import { createInventoryRoutes } from '../../modules/inventory/src/api/routes/inventory.routes';
import { createSmartBillRoutes } from '../../modules/smartbill/src/api/routes/smartbill.routes';
import metaAdsRouter from '../../modules/meta-ads/src/api/routes/meta-ads.routes';
import { createSeoModuleCompositionRoot } from '../../modules/seo-automation/src/infrastructure/composition-root';
import SettingsModule from '../../modules/settings/src/settings-module';
import { createB2BRoutes } from '../../modules/b2b-portal/src/api/routes/b2b.routes';
import { UserController } from '../../modules/users/src/api/controllers/UserController';
import { authenticate, requireRole } from '../../shared/middleware/auth.middleware';

type RouteExpectation = {
  name: string;
  method: 'get' | 'post';
  path: string;
  expectedStatus: number;
};

function buildOkController(methodNames: string[]) {
  const controller: Record<string, unknown> = {};

  for (const methodName of methodNames) {
    controller[methodName] = async (_req: Request, res: Response) => {
      res.status(200).json({ ok: methodName });
    };
  }

  return controller;
}

async function buildSettingsRouter() {
  const module = new SettingsModule();

  await module.initialize({
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    },
    dataSource: {} as never,
    eventBus: {} as never,
    cacheManager: {} as never,
    config: {},
    apiClientFactory: {} as never,
    featureFlags: {} as never,
  } as never);

  return module.getRouter();
}

function buildUsersRouter() {
  const controller = new UserController(
    {
      findAll: async () => [],
      create: async () => ({}),
      delete: async () => undefined,
      findByEmail: async () => null,
      validatePassword: async () => false,
      handleFailedLogin: async () => undefined,
      resetFailedLoginAttempts: async () => undefined,
      updateLastLogin: async () => undefined,
    } as never,
    {} as never,
  );

  return controller.getRouter();
}

function buildMetaAdsRouter() {
  const router = express.Router();

  router.use(authenticate);
  router.use(requireRole(['admin', 'manager']));
  router.use(metaAdsRouter);

  return router;
}

function buildB2BRouter() {
  const publicController = {
    async registerB2BCustomer(_req: Request, res: Response) {
      res.status(200).json({ ok: 'register' });
    },
    async verifyCui(_req: Request, res: Response) {
      res.status(200).json({ ok: 'verify-cui' });
    },
    async verifyCuiGet(_req: Request, res: Response) {
      res.status(200).json({ ok: 'verify-cui-get' });
    },
    async listProducts(_req: Request, res: Response) {
      res.status(200).json({ ok: 'products' });
    },
    async getProductFilters(_req: Request, res: Response) {
      res.status(200).json({ ok: 'filters' });
    },
    async getProductCategories(_req: Request, res: Response) {
      res.status(200).json({ ok: 'categories' });
    },
    async previewDocument(_req: Request, res: Response) {
      res.status(200).json({ ok: 'preview-document' });
    },
    async getProductDetails(_req: Request, res: Response) {
      res.status(200).json({ ok: 'product-details' });
    },
  };

  const privateController = new Proxy(
    {},
    {
      get: () => async (_req: Request, res: Response) => {
        res.status(200).json({ ok: 'private' });
      },
    },
  );

  const settingsService = {
    async getPublicSettings() {
      return {
        general: {
          companyName: 'Ledux',
          taxId: 'RO123',
          address: 'Strada Test',
          phone: '0700000000',
          email: 'office@ledux.ro',
          currency: 'RON',
          vatRate: 19,
        },
        b2b: {
          catalogVisibility: 'public' as const,
          approvalMode: 'manual' as const,
          showPrices: true,
          showStock: true,
          allowRegistration: true,
          autoApprove: false,
          minOrderValue: '0',
          defaultCreditLimit: '0',
        },
        brandStrategy: {
          selectedDirection: 'hybrid_commerce' as const,
          brandName: 'LEDUX',
          website: 'https://ledux.ro',
          promise: 'Iluminat corect.',
          toneOfVoice: ['clar'],
          valuePillars: ['stoc real'],
          forbiddenPhrases: [],
          seo: {
            titleSuffix: 'Ledux.ro',
            metaDescriptionCta: 'Comanda online.',
            focusKeywords: ['iluminat'],
            categoryIntentMap: {},
          },
          ai: {
            enforceBrandGuardrails: true,
            defaultTemperature: 0.2,
            maxTokens: 512,
            preferredModel: 'gemini-2.5-flash',
          },
        },
      };
    },
  };

  return createB2BRoutes(
    publicController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    privateController as never,
    settingsService as never,
  );
}

function buildSeoRouter() {
  const createQueryBuilder = () => ({
    where: () => createQueryBuilder(),
    andWhere: () => createQueryBuilder(),
    orderBy: () => createQueryBuilder(),
    take: () => createQueryBuilder(),
    skip: () => createQueryBuilder(),
    select: () => createQueryBuilder(),
    getMany: async () => [],
    getCount: async () => 0,
    getManyAndCount: async () => [[], 0],
    getRawOne: async () => ({ avg: '81' }),
  });

  const makeRepository = () => ({
    save: async <T,>(value: T) => value,
    findOne: async () => null,
    findAndCount: async () => [[], 0],
    find: async () => [],
    count: async () => 0,
    delete: async () => ({ affected: 0 }),
    createQueryBuilder,
  });

  const dataSource = {
    query: async () => [{ total: 5, avg_score: 78, passed: 2, warning: 2, failed: 1 }],
    getRepository: () => makeRepository(),
  } as never;

  const eventBusClient = {};
  const eventBus = {
    publish: async () => undefined,
    subscribe: async () => undefined,
    client: eventBusClient,
  } as never;

  const productPort = {
    getProduct: async () => null,
    getAllProducts: async () => ({
      data: [],
      total: 0,
      page: 1,
      limit: 500,
      hasMore: false,
    }),
    getProductsByCategory: async () => [],
    searchProducts: async () => ({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  } as never;

  return createSeoModuleCompositionRoot(
    dataSource,
    eventBus,
    eventBusClient as never,
    productPort,
    {} as never,
    {} as never,
  ).then((root) => root.router);
}

async function buildApp(): Promise<Express> {
  const app = express();
  app.use(express.json());

  app.use('/api/v1/users', buildUsersRouter());
  app.use('/api/v1/orders', createOrderRoutes(buildOkController(['listOrders']) as never));
  app.use(
    '/api/v1/inventory',
    createInventoryRoutes(
      buildOkController([
        'getStockLevels',
        'getProductFacets',
        'checkStockBatch',
        'reserveStock',
        'releaseReservation',
        'adjustStock',
        'getLowStockAlerts',
        'acknowledgeAlert',
        'getReplenishmentSuggestions',
        'createReplenishmentDraft',
        'syncSmartBill',
        'syncSuppliers',
        'refreshProjection',
        'getProjectionStatus',
        'processProjectionQueue',
        'requeueFailedProjectionJobs',
        'getWarehouses',
        'createWarehouse',
        'getStock',
        'getMovementHistory',
        'addProductImage',
        'deleteProductImage',
        'bulkImportImages',
        'autoSearchProductImages',
        'syncSupplierFeedImages',
        'fallbackLocalImages',
        'uploadProductImage',
        'searchProductImage',
        'selectSearchedImage',
      ]) as never,
    ),
  );
  app.use('/api/v1/smartbill', createSmartBillRoutes(buildOkController([
    'createInvoice',
    'createProforma',
    'getInvoice',
    'getProforma',
    'syncStock',
    'registerCatalogProduct',
    'getWarehouses',
    'getInvoiceStatus',
    'markInvoicePaid',
    'syncPricesFromInvoices',
    'previewPricesFromInvoices',
    'importPricesFromExcel',
    'downloadExcelTemplate',
    'syncCustomers',
    'listCustomerLinks',
    'resolveCustomerLink',
    'getMatchSuggestions',
    'autoLinkCustomers',
    'createProformaFromQuote',
    'createProformaFromB2BOrder',
    'getSyncDashboard',
    'getSyncHistory',
    'getSyncAlerts',
    'convertProformaToInvoice',
    'syncInvoiceStatus',
    'checkInvoicePaymentStatus',
  ]) as never));
  app.use('/api/v1/meta-ads', buildMetaAdsRouter());
  app.use('/api/v1/settings', await buildSettingsRouter());
  app.use('/api/v1/b2b', buildB2BRouter());
  app.use('/api/v1/seo', await buildSeoRouter());

  return app;
}

describe('Public surface policy', () => {
  let app: Express;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    app = await buildApp();
  });

  it('enforces the anonymous smoke matrix for ERP and B2B routes', async () => {
    const expectations: RouteExpectation[] = [
      {
        name: 'users list stays private',
        method: 'get',
        path: '/api/v1/users',
        expectedStatus: 401,
      },
      {
        name: 'orders list stays private',
        method: 'get',
        path: '/api/v1/orders',
        expectedStatus: 401,
      },
      {
        name: 'inventory stock lookup stays private',
        method: 'get',
        path: '/api/v1/inventory/stock',
        expectedStatus: 401,
      },
      {
        name: 'smartbill invoices stay private',
        method: 'post',
        path: '/api/v1/smartbill/invoices',
        expectedStatus: 401,
      },
      {
        name: 'meta ads status stays private',
        method: 'get',
        path: '/api/v1/meta-ads/status',
        expectedStatus: 401,
      },
      {
        name: 'public settings stay readable',
        method: 'get',
        path: '/api/v1/settings',
        expectedStatus: 200,
      },
      {
        name: 'private settings stay private',
        method: 'get',
        path: '/api/v1/settings/private',
        expectedStatus: 401,
      },
      {
        name: 'public b2b catalog stays readable',
        method: 'get',
        path: '/api/v1/b2b/products',
        expectedStatus: 200,
      },
      {
        name: 'b2b document preview stays private',
        method: 'get',
        path: '/api/v1/b2b/documents/preview?url=https%3A%2F%2Fexample.com%2Fspec.pdf',
        expectedStatus: 401,
      },
      {
        name: 'seo audit summary stays public',
        method: 'get',
        path: '/api/v1/seo/audits/summary',
        expectedStatus: 200,
      },
      {
        name: 'seo sitemap status stays public',
        method: 'get',
        path: '/api/v1/seo/sitemap/status',
        expectedStatus: 200,
      },
      {
        name: 'seo structured data templates stay public',
        method: 'get',
        path: '/api/v1/seo/structured-data/templates',
        expectedStatus: 200,
      },
      {
        name: 'seo structured data stays public',
        method: 'get',
        path: '/api/v1/seo/structured-data/123',
        expectedStatus: 200,
      },
    ];

    for (const expectation of expectations) {
      const response = await request(app)[expectation.method](expectation.path);

      expect({
        name: expectation.name,
        status: response.status,
      }).toEqual({
        name: expectation.name,
        status: expectation.expectedStatus,
      });
    }
  });
});
