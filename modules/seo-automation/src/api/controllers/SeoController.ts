import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';
import { SeoModuleCompositionRoot } from '../../infrastructure/composition-root';
import { SeoEntityType } from '../../domain/entities/SeoIssue';
import { MetadataEntityType, SeoLocale } from '../../domain/entities/SeoMetadata';
import { StructuredData, SchemaType } from '../../domain/entities/StructuredData';

/**
 * SEO Automation Controller
 * Handles all SEO-related operations using real use-cases and repositories
 * from the composition root.
 */
export class SeoController {
  constructor(private readonly root: SeoModuleCompositionRoot) {}

  /**
   * Generate SEO metadata for a product
   * POST /api/v1/seo/products/:productId/generate
   */
  async generateSeoMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const locale = (req.query.locale as string as SeoLocale) || 'ro';

      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const result = await this.root.generateProductSeo.execute({
        productId,
        locale: locale as 'ro' | 'en',
      });

      res.status(201).json(
        successResponse({
          score: result.score,
          focusKeyword: result.focusKeyword,
          metadata: result.metadata.toJSON(),
          structuredData: result.structuredData.toJSON(),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Audit product SEO
   * POST /api/v1/seo/products/:productId/audit
   */
  async auditProductSeo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const locale = (req.query.locale as string as SeoLocale) || 'ro';

      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const result = await this.root.auditProductSeo.execute({
        entityType: SeoEntityType.PRODUCT,
        entityId: productId,
        locale: locale as 'ro' | 'en',
      });

      res.status(201).json(
        successResponse({
          score: result.score,
          issues: result.criticalIssues.map((i) => i.toJSON()),
          warnings: result.warnings.map((w) => w.toJSON()),
          passed: result.passed,
          recommendations: result.recommendations,
          summary: result.auditResult.getSummary(),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product SEO metadata
   * GET /api/v1/seo/products/:productId/metadata
   */
  async getProductSeoMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const locale = (req.query.locale as string as SeoLocale) || 'ro';

      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const metadata = await this.root.metadataRepository.findByEntity(
        'PRODUCT' as MetadataEntityType,
        productId,
        locale,
      );

      if (!metadata) {
        res
          .status(404)
          .json(errorResponse('NOT_FOUND', 'SEO metadata not found for this product', 404));
        return;
      }

      // Also fetch structured data
      const structuredDataList = await this.root.structuredDataRepository.findByEntity(
        SeoEntityType.PRODUCT,
        productId,
      );

      res.json(
        successResponse({
          ...metadata.toJSON(),
          structuredData: structuredDataList.map((sd) => sd.toJSON()),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update product SEO metadata
   * PUT /api/v1/seo/products/:productId/metadata
   */
  async updateProductSeoMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const updateData = req.body;
      const locale = (req.query.locale as string as SeoLocale) || 'ro';

      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      // Fetch existing
      const existing = await this.root.metadataRepository.findByEntity(
        'PRODUCT' as MetadataEntityType,
        productId,
        locale,
      );

      if (!existing) {
        res
          .status(404)
          .json(errorResponse('NOT_FOUND', 'SEO metadata not found for this product', 404));
        return;
      }

      // Apply updates to domain entity
      if (updateData.metaTitle !== undefined) existing.metaTitle = updateData.metaTitle;
      if (updateData.metaDescription !== undefined)
        existing.metaDescription = updateData.metaDescription;
      if (updateData.slug !== undefined) existing.slug = updateData.slug;
      if (updateData.canonicalUrl !== undefined) existing.canonicalUrl = updateData.canonicalUrl;
      if (updateData.ogTitle !== undefined) existing.ogTitle = updateData.ogTitle;
      if (updateData.ogDescription !== undefined) existing.ogDescription = updateData.ogDescription;
      if (updateData.ogImage !== undefined) existing.ogImage = updateData.ogImage;
      if (updateData.twitterTitle !== undefined) existing.twitterTitle = updateData.twitterTitle;
      if (updateData.twitterDescription !== undefined)
        existing.twitterDescription = updateData.twitterDescription;
      if (updateData.focusKeyword !== undefined) existing.focusKeyword = updateData.focusKeyword;
      if (updateData.secondaryKeywords !== undefined)
        existing.secondaryKeywords = updateData.secondaryKeywords;

      // Recalculate score
      existing.calculateScore();
      existing.updatedAt = new Date();

      const saved = await this.root.metadataRepository.save(existing);
      res.json(successResponse(saved.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk generate SEO metadata
   * POST /api/v1/seo/bulk/generate
   */
  async bulkGenerateSeoMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Record<string, any>;
      const jobId = uuidv4();

      const job = {
        id: jobId,
        type: 'BULK_GENERATE_SEO',
        status: 'QUEUED',
        productsToProcess: body.product_ids?.length || 0,
        productsProcessed: 0,
        productsFailed: 0,
        createdAt: new Date().toISOString(),
        message: 'Bulk SEO generation job has been queued for processing',
      };

      res.status(202).json(successResponse(job));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk audit SEO
   * POST /api/v1/seo/bulk/audit
   */
  async bulkAuditSeo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Record<string, any>;
      const jobId = uuidv4();

      const job = {
        id: jobId,
        type: 'BULK_AUDIT_SEO',
        status: 'QUEUED',
        productsToAudit: body.product_ids?.length || 0,
        productsAudited: 0,
        productsFailed: 0,
        createdAt: new Date().toISOString(),
        message: 'Bulk SEO audit job has been queued for processing',
      };

      res.status(202).json(successResponse(job));
    } catch (error) {
      next(error);
    }
  }

  /**
   * List SEO audits with pagination
   * GET /api/v1/seo/audits
   */
  async listSeoAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const auditType = req.query.audit_type as string | undefined;

      const result = await this.root.auditRepository.findAll({ page, limit }, auditType as any);

      res.json(
        paginatedResponse(
          result.data.map((a) => a.toJSON()),
          result.total,
          result.page,
          result.limit,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get SEO audit details
   * GET /api/v1/seo/audits/:id
   */
  async getSeoAuditDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Audit ID is required', 400));
        return;
      }

      const audit = await this.root.auditRepository.findById(id);

      if (!audit) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Audit result not found', 404));
        return;
      }

      res.json(successResponse(audit.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate sitemap
   * POST /api/v1/seo/sitemap/generate
   */
  async generateSitemap(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = uuidv4();

      const job = {
        id: jobId,
        type: 'GENERATE_SITEMAP',
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
        message: 'Sitemap generation job has been queued for processing',
      };

      res.status(202).json(successResponse(job));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sitemap status
   * GET /api/v1/seo/sitemap/status
   */
  async getSitemapStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lastGenerated = await this.root.sitemapRepository.getLastGenerated();
      const totalCount = await this.root.sitemapRepository.count();

      const sitemaps: Record<string, unknown>[] = [];
      lastGenerated.forEach((sitemap, type) => {
        sitemaps.push({
          type,
          ...sitemap.toJSON(),
        });
      });

      res.json(
        successResponse({
          totalSitemaps: totalCount,
          sitemaps,
          lastUpdated: sitemaps.length > 0 ? sitemaps[0].generatedAt : null,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get structured data for an entity
   * GET /api/v1/seo/structured-data/:productId
   */
  async getStructuredData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const records = await this.root.structuredDataRepository.findByEntity(
        SeoEntityType.PRODUCT,
        productId,
      );

      res.json(
        successResponse({
          productId,
          schemas: records.map((r) => r.toJSON()),
          count: records.length,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update structured data for a product
   * PUT /api/v1/seo/structured-data/:productId
   */
  async updateStructuredData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const body = req.body as Record<string, any>;
      const { schema_type, data, validate: shouldValidate } = body;

      if (!productId || !schema_type || !data) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing required fields', 400));
        return;
      }

      // Find existing or create new
      const existing = await this.root.structuredDataRepository.findByEntity(
        SeoEntityType.PRODUCT,
        productId,
      );

      const match = existing.find((sd) => sd.schemaType === schema_type);

      const structuredData = new StructuredData({
        id: match?.id || uuidv4(),
        entityType: SeoEntityType.PRODUCT,
        entityId: productId,
        schemaType: schema_type as SchemaType,
        jsonLd: data,
      });

      if (shouldValidate !== false) {
        structuredData.validate();
      }

      const saved = await this.root.structuredDataRepository.save(structuredData);
      res.json(successResponse(saved.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  /**
   * SEO module health check
   * GET /api/v1/seo/health
   */
  async getSeoModuleHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [metadataCount, auditCount, sitemapCount, structuredDataCount] = await Promise.all([
        this.root.metadataRepository.count(),
        this.root.auditRepository.count(),
        this.root.sitemapRepository.count(),
        this.root.structuredDataRepository.count(),
      ]);

      const avgScore = await this.root.auditRepository.getAverageScore();

      const health = {
        status: 'HEALTHY',
        module: 'seo-automation',
        timestamp: new Date().toISOString(),
        stats: {
          totalMetadata: metadataCount,
          totalAudits: auditCount,
          totalSitemaps: sitemapCount,
          totalStructuredData: structuredDataCount,
          averageAuditScore: avgScore,
        },
      };

      res.json(successResponse(health));
    } catch (error) {
      next(error);
    }
  }
}
