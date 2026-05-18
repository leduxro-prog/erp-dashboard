/**
 * SEO Automation Module - Composition Root
 *
 * Handles dependency injection and service instantiation.
 * Creates all services, repositories, and use cases.
 * Implements the composition root pattern for enterprise architecture.
 *
 * @module composition-root
 */

import { IEventBus } from '@shared/module-system/module.interface';
import { loadBrandStrategySync } from '@shared/utils/brand-strategy';
import { createModuleLogger } from '@shared/utils/logger';
import { Router, Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

// Domain services
import { SeoController } from '../api/controllers/SeoController';
import { ICategoryPort } from '../application/ports/ICategoryPort';
import { IProductPort } from '../application/ports/IProductPort';
import { IWooCommercePort } from '../application/ports/IWooCommercePort';
import { AuditProductSeo } from '../application/use-cases/AuditProductSeo';
import { GenerateProductSeo } from '../application/use-cases/GenerateProductSeo';
import { IAuditRepository } from '../domain/repositories/IAuditRepository';
import { ISeoMetadataRepository } from '../domain/repositories/ISeoMetadataRepository';
import { ISitemapRepository } from '../domain/repositories/ISitemapRepository';
import { IStructuredDataRepository } from '../domain/repositories/IStructuredDataRepository';
import { MetaTagGenerator } from '../domain/services/MetaTagGenerator';
import { SeoScoreCalculator } from '../domain/services/SeoScoreCalculator';
import { SlugGenerator } from '../domain/services/SlugGenerator';
import { StructuredDataGenerator } from '../domain/services/StructuredDataGenerator';

// Use cases

// Ports

// Repositories (interfaces)

// Infrastructure repositories (TypeORM implementations)
import { TypeOrmAuditRepository } from './repositories/TypeOrmAuditRepository';
import { TypeOrmSeoMetadataRepository } from './repositories/TypeOrmSeoMetadataRepository';
import { TypeOrmSitemapRepository } from './repositories/TypeOrmSitemapRepository';
import { TypeOrmStructuredDataRepository } from './repositories/TypeOrmStructuredDataRepository';

// Controller

// Event bus

/**
 * Composition root service locator
 *
 * Contains all instantiated services, repositories, and use cases.
 * Acts as a service locator for the module.
 */
export interface SeoModuleCompositionRoot {
  dataSource: DataSource;

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
  const brandStrategy = loadBrandStrategySync();
  const metaTagGenerator = new MetaTagGenerator({
    strategy: brandStrategy,
    brandName: brandStrategy.brandName,
    titleSuffix: brandStrategy.seo.titleSuffix,
    defaultCta: brandStrategy.seo.metaDescriptionCta,
  });
  const slugGenerator = new SlugGenerator();
  const structuredDataGenerator = new StructuredDataGenerator(
    String(brandStrategy.website || 'https://ledux.ro').replace(/\/$/, ''),
  );

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
    dataSource,
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

  // ── Public SEO Assets ─────────────────────────────────────────────

  // GET /seo-automation/sitemap.xml
  router.get(
    '/sitemap.xml',
    asyncHandler((req, res, next) => controller.getPublicSitemap(req, res, next)),
  );

  // GET /seo-automation/sitemap/:type.xml
  router.get(
    '/sitemap/:type.xml',
    asyncHandler((req, res, next) => controller.getPublicSitemapByType(req, res, next)),
  );

  // GET /seo-automation/robots.txt
  router.get(
    '/robots.txt',
    asyncHandler((req, res, next) => controller.getRobotsTxt(req, res, next)),
  );

  // ── Product SEO Metadata ─────────────────────────────────────────

  // 1. POST /seo/products/:productId/generate
  router.post(
    '/products/:productId/generate',
    asyncHandler((req, res, next) => controller.generateSeoMetadata(req, res, next)),
  );

  // 1b. GET /seo/products/status
  router.get(
    '/products/status',
    asyncHandler((req, res, next) => controller.getProductSeoStatus(req, res, next)),
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

  // 7b. GET /seo/audits/summary
  router.get(
    '/audits/summary',
    asyncHandler((req, res, next) => controller.getAuditSummary(req, res, next)),
  );

  // 7c. POST /seo/audits/run
  router.post(
    '/audits/run',
    asyncHandler((req, res, next) => controller.runAudit(req, res, next)),
  );

  // 7d. POST /seo/audits/reaudit/:productId
  router.post(
    '/audits/reaudit/:productId',
    asyncHandler((req, res, next) => controller.reauditProduct(req, res, next)),
  );

  // 7e. POST /seo/audits/:auditId/issues/:issueId/fix
  router.post(
    '/audits/:auditId/issues/:issueId/fix',
    asyncHandler((req, res, next) => controller.fixAuditIssue(req, res, next)),
  );

  // 7f. POST /seo/audits/:auditId/issues/:issueId/mark-fixed
  router.post(
    '/audits/:auditId/issues/:issueId/mark-fixed',
    asyncHandler((req, res, next) => controller.markAuditIssueFixed(req, res, next)),
  );

  // 8. GET /seo/audits/:id
  router.get(
    '/audits/:id',
    asyncHandler((req, res, next) => controller.getSeoAuditDetails(req, res, next)),
  );

  // Legacy metadata aliases used by existing frontend service
  router.get(
    '/metadata/:productId',
    asyncHandler((req, res, next) => controller.getSeoMetadataLegacy(req, res, next)),
  );
  router.post(
    '/metadata/:productId/generate',
    asyncHandler((req, res, next) => controller.generateSeoMetadataLegacy(req, res, next)),
  );
  router.put(
    '/metadata/:productId',
    asyncHandler((req, res, next) => controller.updateSeoMetadataLegacy(req, res, next)),
  );

  // ── Sitemap Management ───────────────────────────────────────────

  // 9. POST /seo/sitemap/generate
  router.post(
    '/sitemap/generate',
    asyncHandler((req, res, next) => controller.generateSitemap(req, res, next)),
  );

  // 9b. POST /seo/sitemap/regenerate
  router.post(
    '/sitemap/regenerate',
    asyncHandler((req, res, next) => controller.regenerateSitemap(req, res, next)),
  );

  // 9c. POST /seo/sitemap/submit
  router.post(
    '/sitemap/submit',
    asyncHandler((req, res, next) => controller.submitSitemap(req, res, next)),
  );

  // 9d. PUT /seo/sitemap/config
  router.put(
    '/sitemap/config',
    asyncHandler((req, res, next) => controller.updateSitemapConfig(req, res, next)),
  );

  // 10. GET /seo/sitemap/status
  router.get(
    '/sitemap/status',
    asyncHandler((req, res, next) => controller.getSitemapStatus(req, res, next)),
  );

  // ── Structured Data ──────────────────────────────────────────────

  // 11. GET /seo/structured-data/templates
  router.get(
    '/structured-data/templates',
    asyncHandler((req, res, next) => controller.getStructuredDataTemplates(req, res, next)),
  );

  // 12. POST /seo/structured-data/validate
  router.post(
    '/structured-data/validate',
    asyncHandler((req, res, next) => controller.validateStructuredDataPayload(req, res, next)),
  );

  // 13. GET /seo/structured-data/:productId
  router.get(
    '/structured-data/:productId',
    asyncHandler((req, res, next) => controller.getStructuredData(req, res, next)),
  );

  // 14. PUT /seo/structured-data/:productId
  router.put(
    '/structured-data/:productId',
    asyncHandler((req, res, next) => controller.updateStructuredData(req, res, next)),
  );

  // ── Health Check ─────────────────────────────────────────────────

  // 15. GET /seo/health
  router.get(
    '/health',
    asyncHandler((req, res, next) => controller.getSeoModuleHealth(req, res, next)),
  );

  return router;
}
