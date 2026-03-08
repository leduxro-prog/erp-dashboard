/**
 * SEO Automation API Routes
 * Defines all SEO endpoints including metadata generation, audits, and sitemap management
 */
import { Router, Request, Response, NextFunction } from 'express';
import { SeoController } from '../controllers/SeoController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import {
  generateSeoMetadataSchema,
  auditSeoSchema,
  updateSeoMetadataSchema,
  bulkGenerateSeoSchema,
  bulkAuditSeoSchema,
  generateSitemapSchema,
  updateStructuredDataSchema,
  queueRefreshSchema,
  queueListSchema,
  queueDecisionSchema,
  queueApplySchema,
  validateRequest,
} from '../validators/seo.validators';

/**
 * Create and configure SEO routes
 */
export function createSeoRoutes(controller: SeoController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * PRODUCT SEO METADATA ROUTES
   */

  /**
   * POST /api/v1/seo/products/:productId/generate
   * Generate SEO metadata for a product
   * Auth: user (product owner) or admin
   */
  router.post('/products/:productId/generate', validateRequest(generateSeoMetadataSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.generateSeoMetadata(req, res, next)
  );

  /**
   * GET /api/v1/seo/products/:productId/metadata
   * Get SEO metadata for a product
   * Auth: user
   * Query params: include_suggestions, include_missing_fields
   */
  router.get('/products/:productId/metadata', (req: Request, res: Response, next: NextFunction) =>
    controller.getProductSeoMetadata(req, res, next)
  );

  /**
   * PUT /api/v1/seo/products/:productId/metadata
   * Update SEO metadata for a product
   * Auth: user (product owner) or admin
   */
  router.put('/products/:productId/metadata', validateRequest(updateSeoMetadataSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.updateProductSeoMetadata(req, res, next)
  );

  /**
   * PRODUCT SEO AUDIT ROUTES
   */

  /**
   * POST /api/v1/seo/products/:productId/audit
   * Audit product SEO
   * Auth: user (product owner) or admin
   */
  router.post('/products/:productId/audit', validateRequest(auditSeoSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.auditProductSeo(req, res, next)
  );

  /**
   * BULK OPERATIONS
   */

  /**
   * POST /api/v1/seo/bulk/generate
   * Bulk generate SEO metadata for multiple products
   * Auth: admin
   * Can target by product IDs, category, or custom filters
   */
  router.post('/bulk/generate', requireRole(['admin']), validateRequest(bulkGenerateSeoSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.bulkGenerateSeoMetadata(req, res, next)
  );

  /**
   * POST /api/v1/seo/bulk/audit
   * Bulk audit SEO for multiple products
   * Auth: admin
   * Can target by product IDs, category, or custom filters
   */
  router.post('/bulk/audit', requireRole(['admin']), validateRequest(bulkAuditSeoSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.bulkAuditSeo(req, res, next)
  );

  /**
   * QUEUE MANAGEMENT ROUTES
   */

  /**
   * POST /api/v1/seo/queue/refresh
   * Auth: admin
   */
  router.post('/queue/refresh', requireRole(['admin']), validateRequest(queueRefreshSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.refreshSeoQueue(req, res, next)
  );

  /**
   * GET /api/v1/seo/queue
   * Auth: admin
   */
  router.get('/queue', requireRole(['admin']), validateRequest(queueListSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.listSeoQueue(req, res, next)
  );

  /**
   * POST /api/v1/seo/queue/approve
   * Auth: admin
   */
  router.post('/queue/approve', requireRole(['admin']), validateRequest(queueDecisionSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.approveSeoQueue(req, res, next)
  );

  /**
   * POST /api/v1/seo/queue/reject
   * Auth: admin
   */
  router.post('/queue/reject', requireRole(['admin']), validateRequest(queueDecisionSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.rejectSeoQueue(req, res, next)
  );

  /**
   * POST /api/v1/seo/queue/apply
   * Auth: admin
   */
  router.post('/queue/apply', requireRole(['admin']), validateRequest(queueApplySchema), (req: Request, res: Response, next: NextFunction) =>
    controller.applySeoQueue(req, res, next)
  );

  /**
   * GET /api/v1/seo/queue/:changesetId
   * Auth: admin
   */
  router.get('/queue/:changesetId', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.getSeoQueueChangeset(req, res, next)
  );

  /**
   * AUDIT MANAGEMENT ROUTES
   */

  /**
   * GET /api/v1/seo/audits
   * List SEO audits with pagination
   * Auth: admin
   * Query params: page, limit, product_id, status, severity, search
   * Statuses: PENDING, IN_PROGRESS, COMPLETED, FAILED
   * Severities: CRITICAL, HIGH, MEDIUM, LOW, INFO
   */
  router.get('/audits', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.listSeoAudits(req, res, next)
  );

  /**
   * GET /api/v1/seo/audits/:id
   * Get SEO audit details with issues and recommendations
   * Auth: admin
   * Query params: include_recommendations, include_fixes
   */
  router.get('/audits/:id', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.getSeoAuditDetails(req, res, next)
  );

  /**
   * SITEMAP ROUTES
   */

  /**
   * POST /api/v1/seo/sitemap/generate
   * Generate XML sitemap
   * Auth: admin
   * Options: include products, categories, blog posts
   */
  router.post('/sitemap/generate', requireRole(['admin']), validateRequest(generateSitemapSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.generateSitemap(req, res, next)
  );

  /**
   * GET /api/v1/seo/sitemap/status
   * Get sitemap generation status
   * Auth: user
   * Includes submission status to search engines
   */
  router.get('/sitemap/status', (req: Request, res: Response, next: NextFunction) =>
    controller.getSitemapStatus(req, res, next)
  );

  /**
   * STRUCTURED DATA ROUTES
   */

  /**
   * GET /api/v1/seo/structured-data/:productId
   * Get structured data (schema markup) for a product
   * Auth: user
   * Query params: schema_type (PRODUCT, ORGANIZATION, BREADCRUMB, etc.), format (JSON_LD, MICRODATA, RDFA)
   */
  router.get('/structured-data/:productId', (req: Request, res: Response, next: NextFunction) =>
    controller.getStructuredData(req, res, next)
  );

  /**
   * PUT /api/v1/seo/structured-data/:productId
   * Update structured data for a product
   * Auth: user (product owner) or admin
   */
  router.put('/structured-data/:productId', validateRequest(updateStructuredDataSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.updateStructuredData(req, res, next)
  );

  /**
   * HEALTH CHECK
   */

  /**
   * GET /api/v1/seo/health
   * SEO module health status
   * Auth: admin
   * Returns: service status, component health, pending tasks
   */
  router.get('/health', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.getSeoModuleHealth(req, res, next)
  );

  return router;
}
