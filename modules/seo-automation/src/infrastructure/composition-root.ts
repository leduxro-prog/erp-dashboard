/**
 * SEO Automation Module - Composition Root
 *
 * Handles dependency injection and service instantiation.
 * Creates all services, repositories, and use cases.
 * Implements the composition root pattern for enterprise architecture.
 *
 * @module composition-root
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { createModuleLogger } from '@shared/utils/logger';

// Domain services
import { SeoScoreCalculator } from '../domain/services/SeoScoreCalculator';
import { MetaTagGenerator } from '../domain/services/MetaTagGenerator';
import { SlugGenerator } from '../domain/services/SlugGenerator';
import { StructuredDataGenerator } from '../domain/services/StructuredDataGenerator';

// Use cases
import { GenerateProductSeo } from '../application/use-cases/GenerateProductSeo';
import { AuditProductSeo } from '../application/use-cases/AuditProductSeo';

// Ports
import { IProductPort } from '../application/ports/IProductPort';
import { ICategoryPort } from '../application/ports/ICategoryPort';
import { IWooCommercePort } from '../application/ports/IWooCommercePort';

// Repositories (interfaces)
import { ISeoMetadataRepository } from '../domain/repositories/ISeoMetadataRepository';
import { ISitemapRepository } from '../domain/repositories/ISitemapRepository';
import { IStructuredDataRepository } from '../domain/repositories/IStructuredDataRepository';
import { IAuditRepository } from '../domain/repositories/IAuditRepository';

// Infrastructure repositories (TypeORM implementations)
import { TypeOrmSeoMetadataRepository } from './repositories/TypeOrmSeoMetadataRepository';
import { TypeOrmSitemapRepository } from './repositories/TypeOrmSitemapRepository';
import { TypeOrmStructuredDataRepository } from './repositories/TypeOrmStructuredDataRepository';
import { TypeOrmAuditRepository } from './repositories/TypeOrmAuditRepository';

// Controller
import { SeoController } from '../api/controllers/SeoController';

// Event bus
import { IEventBus } from '@shared/module-system/module.interface';

/**
 * Composition root service locator
 *
 * Contains all instantiated services, repositories, and use cases.
 * Acts as a service locator for the module.
 */
export interface SeoModuleCompositionRoot {
  // Repositories
  metadataRepository: ISeoMetadataRepository;
  sitemapRepository: ISitemapRepository;
  structuredDataRepository: IStructuredDataRepository;
  auditRepository: IAuditRepository;

  // Domain services
  scoreCalculator: SeoScoreCalculator;
  metaTagGenerator: MetaTagGenerator;
  slugGenerator: SlugGenerator;
  structuredDataGenerator: StructuredDataGenerator;

  // Use cases
  generateProductSeo: GenerateProductSeo;
  auditProductSeo: AuditProductSeo;

  // External ports
  productPort: IProductPort;
  categoryPort: ICategoryPort;
  woocommercePort: IWooCommercePort;

  // HTTP router
  router: Router;
}

/**
 * Create the composition root
 *
 * Instantiates all services and wires dependencies.
 * Returns a composition root service locator.
 *
 * @param dataSource - TypeORM DataSource
 * @param eventBus - Event bus for publishing/subscribing
 * @param redisClient - Redis client for caching
 * @param productPort - Product data adapter
 * @param categoryPort - Category data adapter
 * @param woocommercePort - WooCommerce adapter
 * @returns Composed services and use cases
 */
export async function createSeoModuleCompositionRoot(
  dataSource: DataSource,
  eventBus: IEventBus,
  _redisClient: Redis,
  productPort: IProductPort,
  categoryPort: ICategoryPort,
  woocommercePort: IWooCommercePort,
): Promise<SeoModuleCompositionRoot> {
  const logger = createModuleLogger('seo-automation');

  logger.debug('Creating SEO module composition root');

  // Initialize repositories (real TypeORM implementations)
  const metadataRepository: ISeoMetadataRepository = new TypeOrmSeoMetadataRepository(dataSource);
  const sitemapRepository: ISitemapRepository = new TypeOrmSitemapRepository(dataSource);
  const structuredDataRepository: IStructuredDataRepository = new TypeOrmStructuredDataRepository(
    dataSource,
  );
  const auditRepository: IAuditRepository = new TypeOrmAuditRepository(dataSource);

  // Instantiate domain services (stateless, pure functions)
  const scoreCalculator = new SeoScoreCalculator();
  const metaTagGenerator = new MetaTagGenerator();
  const slugGenerator = new SlugGenerator();
  const structuredDataGenerator = new StructuredDataGenerator('https://ledux.ro');

  // Instantiate use cases
  const generateProductSeo = new GenerateProductSeo(
    productPort,
    metadataRepository,
    structuredDataRepository,
    metaTagGenerator,
    slugGenerator,
    structuredDataGenerator,
    scoreCalculator,
    eventBus,
    logger,
  );

  const auditProductSeo = new AuditProductSeo(
    metadataRepository,
    structuredDataRepository,
    auditRepository,
    scoreCalculator,
    eventBus,
    logger,
  );

  // Build the composition root object (needed by controller + router)
  const compositionRoot: SeoModuleCompositionRoot = {
    metadataRepository,
    sitemapRepository,
    structuredDataRepository,
    auditRepository,
    scoreCalculator,
    metaTagGenerator,
    slugGenerator,
    structuredDataGenerator,
    generateProductSeo,
    auditProductSeo,
    productPort,
    categoryPort,
    woocommercePort,
    router: null as any, // will be set below
  };

  // Create controller with composition root injected
  const controller = new SeoController(compositionRoot);

  // Create Express router with all endpoints
  const router = createSeoRouter(controller, logger);
  compositionRoot.router = router;

  logger.debug('SEO module composition root created successfully');

  return compositionRoot;
}

/**
 * Create Express router with all 13 SEO endpoints
 *
 * @param controller - SeoController instance
 * @param logger - Logger instance
 * @returns Configured Express router
 *
 * @internal
 */
function createSeoRouter(controller: SeoController, _logger: Logger): Router {
  const router = Router();

  // Middleware
  const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  // ── Product SEO Metadata ─────────────────────────────────────────

  // 1. POST /seo/products/:productId/generate
  router.post(
    '/products/:productId/generate',
    asyncHandler((req, res, next) => controller.generateSeoMetadata(req, res, next)),
  );

  // 2. POST /seo/products/:productId/audit
  router.post(
    '/products/:productId/audit',
    asyncHandler((req, res, next) => controller.auditProductSeo(req, res, next)),
  );

  // 3. GET /seo/products/:productId/metadata
  router.get(
    '/products/:productId/metadata',
    asyncHandler((req, res, next) => controller.getProductSeoMetadata(req, res, next)),
  );

  // 4. PUT /seo/products/:productId/metadata
  router.put(
    '/products/:productId/metadata',
    asyncHandler((req, res, next) => controller.updateProductSeoMetadata(req, res, next)),
  );

  // ── Bulk Operations ──────────────────────────────────────────────

  // 5. POST /seo/bulk/generate
  router.post(
    '/bulk/generate',
    asyncHandler((req, res, next) => controller.bulkGenerateSeoMetadata(req, res, next)),
  );

  // 6. POST /seo/bulk/audit
  router.post(
    '/bulk/audit',
    asyncHandler((req, res, next) => controller.bulkAuditSeo(req, res, next)),
  );

  // ── Audit Management ─────────────────────────────────────────────

  // 7. GET /seo/audits
  router.get(
    '/audits',
    asyncHandler((req, res, next) => controller.listSeoAudits(req, res, next)),
  );

  // 8. GET /seo/audits/:id
  router.get(
    '/audits/:id',
    asyncHandler((req, res, next) => controller.getSeoAuditDetails(req, res, next)),
  );

  // ── Sitemap Management ───────────────────────────────────────────

  // 9. POST /seo/sitemap/generate
  router.post(
    '/sitemap/generate',
    asyncHandler((req, res, next) => controller.generateSitemap(req, res, next)),
  );

  // 10. GET /seo/sitemap/status
  router.get(
    '/sitemap/status',
    asyncHandler((req, res, next) => controller.getSitemapStatus(req, res, next)),
  );

  // ── Structured Data ──────────────────────────────────────────────

  // 11. GET /seo/structured-data/:productId
  router.get(
    '/structured-data/:productId',
    asyncHandler((req, res, next) => controller.getStructuredData(req, res, next)),
  );

  // 12. PUT /seo/structured-data/:productId
  router.put(
    '/structured-data/:productId',
    asyncHandler((req, res, next) => controller.updateStructuredData(req, res, next)),
  );

  // ── Health Check ─────────────────────────────────────────────────

  // 13. GET /seo/health
  router.get(
    '/health',
    asyncHandler((req, res, next) => controller.getSeoModuleHealth(req, res, next)),
  );

  return router;
}
