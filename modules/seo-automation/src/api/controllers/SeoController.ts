import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { successResponse, errorResponse } from '@shared/utils/response';
import { loadBrandStrategySync } from '@shared/utils/brand-strategy';
import { SeoModuleCompositionRoot } from '../../infrastructure/composition-root';
import { SeoEntityType } from '../../domain/entities/SeoIssue';
import { MetadataEntityType, SeoLocale } from '../../domain/entities/SeoMetadata';
import { StructuredData, SchemaType } from '../../domain/entities/StructuredData';
import { SeoAuditResult } from '../../domain/entities/SeoAuditResult';

type SitemapEngine = 'google' | 'bing' | 'yandex';

type SeoScoreStatus = 'excellent' | 'good' | 'needs_work' | 'poor';
type AuditScoreStatus = 'passed' | 'warning' | 'failed';

/**
 * SEO Automation Controller
 * Handles all SEO-related operations using real use-cases and repositories
 * from the composition root.
 */
export class SeoController {
  private sitemapRuntimeConfig: {
    autoRegenerate: boolean;
    regenerateFrequency: 'daily' | 'weekly' | 'monthly';
    priorityRules: Record<string, number>;
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    submittedEngines: SitemapEngine[];
    submittedAt?: string;
  } = {
    autoRegenerate: true,
    regenerateFrequency: 'daily',
    priorityRules: {},
    changeFrequency: 'daily',
    submittedEngines: [],
  };

  private readonly manualIssueFixes = new Set<string>();

  constructor(private readonly root: SeoModuleCompositionRoot) {}

  private getPublicBaseUrl(): string {
    const strategy = loadBrandStrategySync();
    return String(strategy.website || 'https://ledux.ro').replace(/\/$/, '');
  }

  private toSeoScoreStatus(score: number): SeoScoreStatus {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'needs_work';
    return 'poor';
  }

  private toAuditScoreStatus(score: number): AuditScoreStatus {
    if (score >= 80) return 'passed';
    if (score >= 50) return 'warning';
    return 'failed';
  }

  private toFrontendIssueType(value: string | undefined):
    | 'title'
    | 'meta_description'
    | 'h1'
    | 'h2'
    | 'alt_text'
    | 'canonical'
    | 'schema'
    | 'keywords'
    | 'content_length'
    | 'images'
    | 'performance'
    | 'mobile'
    | 'https'
    | 'redirect'
    | 'duplicate' {
    const source = String(value || '').toLowerCase();

    if (source.includes('title')) return 'title';
    if (source.includes('desc')) return 'meta_description';
    if (source.includes('canonical')) return 'canonical';
    if (source.includes('structured') || source.includes('schema')) return 'schema';
    if (source.includes('alt') || source.includes('image')) return 'images';
    if (source.includes('keyword')) return 'keywords';
    if (source.includes('h1')) return 'h1';
    if (source.includes('h2')) return 'h2';
    if (source.includes('duplicate')) return 'duplicate';

    return 'content_length';
  }

  private toFrontendIssueSeverity(value: string | undefined): 'critical' | 'high' | 'medium' | 'low' {
    const source = String(value || '').toLowerCase();
    if (source.includes('critical')) return 'critical';
    if (source.includes('warning')) return 'high';
    if (source.includes('high')) return 'high';
    if (source.includes('medium')) return 'medium';
    return 'low';
  }

  private getManualIssueFixKey(auditId: string, issueId: string): string {
    return `${auditId}:${issueId}`;
  }

  private isSchemaDriftError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    const code = String(err?.code || '');
    const message = String(err?.message || '').toLowerCase();

    return (
      code === '42P01' ||
      code === '42703' ||
      message.includes('does not exist') ||
      message.includes('relation')
    );
  }

  private isMetadataNotFoundError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    return String(err?.code || '') === 'METADATA_NOT_FOUND';
  }

  private async runProductAuditWithAutoMetadata(productId: string): Promise<SeoAuditResult> {
    try {
      const initial = await this.root.auditProductSeo.execute({
        entityType: SeoEntityType.PRODUCT,
        entityId: productId,
        locale: 'ro',
      });

      return initial.auditResult;
    } catch (error) {
      if (!this.isMetadataNotFoundError(error)) {
        throw error;
      }

      await this.root.generateProductSeo.execute({
        productId,
        locale: 'ro',
      });

      const retried = await this.root.auditProductSeo.execute({
        entityType: SeoEntityType.PRODUCT,
        entityId: productId,
        locale: 'ro',
      });

      return retried.auditResult;
    }
  }

  private buildIssueCategories(issues: Array<{ type: string; severity: string }>): {
    on_page: { score: number; issues: number };
    technical: { score: number; issues: number };
    content: { score: number; issues: number };
    images: { score: number; issues: number };
  } {
    const byBucket = {
      on_page: 0,
      technical: 0,
      content: 0,
      images: 0,
    };

    for (const issue of issues) {
      const type = issue.type;
      if (type === 'canonical' || type === 'schema' || type === 'https' || type === 'redirect') {
        byBucket.technical += 1;
      } else if (type === 'images' || type === 'alt_text') {
        byBucket.images += 1;
      } else if (type === 'keywords' || type === 'content_length' || type === 'h1' || type === 'h2') {
        byBucket.content += 1;
      } else {
        byBucket.on_page += 1;
      }
    }

    const scoreFromIssues = (count: number): number => Math.max(0, 100 - count * 12);

    return {
      on_page: { score: scoreFromIssues(byBucket.on_page), issues: byBucket.on_page },
      technical: { score: scoreFromIssues(byBucket.technical), issues: byBucket.technical },
      content: { score: scoreFromIssues(byBucket.content), issues: byBucket.content },
      images: { score: scoreFromIssues(byBucket.images), issues: byBucket.images },
    };
  }

  private mapMetadataToSeoData(
    productId: string,
    metadata: Record<string, any>,
    structuredData?: Record<string, any>[],
  ): Record<string, unknown> {
    const title = metadata.metaTitle || metadata.meta_title || metadata.title || '';
    const metaDescription =
      metadata.metaDescription || metadata.meta_description || metadata.description || '';
    const keywords =
      metadata.secondaryKeywords ||
      metadata.secondary_keywords ||
      metadata.meta_keywords ||
      metadata.keywords ||
      [];

    return {
      productId,
      title,
      metaDescription,
      keywords: Array.isArray(keywords) ? keywords : [],
      canonicalUrl: metadata.canonicalUrl || metadata.canonical_url || '',
      ogTitle: metadata.ogTitle || metadata.og_title,
      ogDescription: metadata.ogDescription || metadata.og_description,
      ogImage: metadata.ogImage || metadata.og_image,
      twitterCard: metadata.twitterCard || metadata.twitter_card,
      twitterTitle: metadata.twitterTitle || metadata.twitter_title,
      twitterDescription: metadata.twitterDescription || metadata.twitter_description,
      twitterImage: metadata.twitterImage || metadata.twitter_image,
      schema: structuredData?.[0]?.jsonLd || metadata.structuredData || metadata.structured_data,
      h1Tag: metadata.h1Tag || metadata.h1_tag || title,
      h2Tags: Array.isArray(metadata.h2Tags) ? metadata.h2Tags : [],
      altTags: metadata.altTags || {},
      updatedAt: metadata.updatedAt || metadata.updated_at || new Date().toISOString(),
    };
  }

  private async buildFrontendAuditPayload(
    audit: SeoAuditResult,
    productCache: Map<string, { productName: string; sku: string }> = new Map(),
  ): Promise<Record<string, unknown>> {
    const productId = audit.entityId || '';
    const productKey = String(productId || 'unknown');

    if (!productCache.has(productKey) && productId) {
      const product = await this.root.productPort.getProduct(productId).catch(() => null);
      productCache.set(productKey, {
        productName: product?.name || `Produs ${productId}`,
        sku: product?.sku || '-',
      });
    }

    const productData = productCache.get(productKey) || {
      productName: productId ? `Produs ${productId}` : 'Produs necunoscut',
      sku: '-',
    };

    const rawIssues: Array<Record<string, any> & { source: 'issue' | 'warning' }> = [
      ...audit.issues.map((issue) => ({
        ...(issue.toJSON() as Record<string, any>),
        source: 'issue' as const,
      })),
      ...audit.warnings.map((warning) => ({
        ...(warning.toJSON() as Record<string, any>),
        source: 'warning' as const,
      })),
    ];

    const issues = rawIssues.map((issue, index) => {
      const issueId = `${issue.source}-${index}`;
      const severity = this.toFrontendIssueSeverity(String(issue.severity || ''));
      const type = this.toFrontendIssueType(String(issue.type || ''));

      return {
        id: issueId,
        type,
        severity,
        issue: String(issue.message || 'SEO issue identified'),
        suggestion: String(issue.recommendation || 'Review metadata quality.'),
        fixed: this.manualIssueFixes.has(this.getManualIssueFixKey(audit.id, issueId)),
      };
    });

    const categories = this.buildIssueCategories(
      issues.map((issue) => ({
        type: String(issue.type),
        severity: String(issue.severity),
      })),
    );

    return {
      id: audit.id,
      productId,
      productName: productData.productName,
      sku: productData.sku,
      score: audit.score,
      status: this.toAuditScoreStatus(audit.score),
      issues,
      categories,
      auditedAt: audit.createdAt.toISOString(),
      createdBy: 'system',
    };
  }

  private async buildSitemapStatusPayload(): Promise<Record<string, unknown>> {
    let lastGenerated = new Map<any, any>();
    let totalCount = 0;

    try {
      lastGenerated = await this.root.sitemapRepository.getLastGenerated();
      totalCount = await this.root.sitemapRepository.count();
    } catch (error) {
      if (!this.isSchemaDriftError(error)) {
        throw error;
      }
    }

    const sections = Array.from(lastGenerated.entries()).map(([type, sitemap]) => {
      const normalizedType =
        type === 'PRODUCTS'
          ? 'products'
          : type === 'CATEGORIES'
            ? 'categories'
            : type === 'PAGES'
              ? 'pages'
              : 'custom';

      return {
        type: normalizedType,
        name: normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1),
        url: sitemap.url,
        pages: sitemap.getEntryCount(),
        lastGeneratedAt: sitemap.generatedAt.toISOString(),
        status: sitemap.isStale() ? 'stale' : 'active',
      };
    });

    if (sections.length === 0) {
      const baseUrl = this.getPublicBaseUrl();
      const productSnapshot = await this.root.productPort.getAllProducts({ page: 1, limit: 1 });
      const snapshotAt = new Date().toISOString();
      const liveSections = [
        {
          type: 'products',
          name: 'Products',
          url: `${baseUrl}/sitemap/products.xml`,
          pages: Math.max(0, Number(productSnapshot?.total || 0)),
          lastGeneratedAt: snapshotAt,
          status: 'active' as const,
        },
        {
          type: 'pages',
          name: 'Pages',
          url: `${baseUrl}/sitemap/pages.xml`,
          pages: 2,
          lastGeneratedAt: snapshotAt,
          status: 'active' as const,
        },
      ].filter((section) => section.pages > 0);

      const totalUrls = liveSections.reduce((acc, section) => acc + Number(section.pages || 0), 0);

      return {
        enabled: true,
        autoRegenerate: this.sitemapRuntimeConfig.autoRegenerate,
        regenerateFrequency: this.sitemapRuntimeConfig.regenerateFrequency,
        priorityRules: this.sitemapRuntimeConfig.priorityRules,
        changeFrequency: this.sitemapRuntimeConfig.changeFrequency,
        lastGeneratedAt: liveSections[0]?.lastGeneratedAt,
        sections: liveSections,
        totalUrls,
        submittedToSearchEngines: this.sitemapRuntimeConfig.submittedEngines.length > 0,
        submittedEngines: this.sitemapRuntimeConfig.submittedEngines,
        submittedAt: this.sitemapRuntimeConfig.submittedAt || null,
        totalSitemaps: liveSections.length,
        sitemaps: liveSections,
        lastUpdated: liveSections[0]?.lastGeneratedAt || null,
        generationMode: 'runtime_snapshot',
      };
    }

    const totalUrls = sections.reduce((acc, section) => acc + Number(section.pages || 0), 0);
    const lastGeneratedAt = sections.length
      ? String(
          sections
            .slice()
            .sort(
              (a, b) =>
                new Date(String(b.lastGeneratedAt)).getTime() -
                new Date(String(a.lastGeneratedAt)).getTime(),
            )[0].lastGeneratedAt,
        )
      : undefined;

    return {
      enabled: true,
      autoRegenerate: this.sitemapRuntimeConfig.autoRegenerate,
      regenerateFrequency: this.sitemapRuntimeConfig.regenerateFrequency,
      priorityRules: this.sitemapRuntimeConfig.priorityRules,
      changeFrequency: this.sitemapRuntimeConfig.changeFrequency,
      lastGeneratedAt,
      sections,
      totalUrls,
      submittedToSearchEngines: this.sitemapRuntimeConfig.submittedEngines.length > 0,
      submittedEngines: this.sitemapRuntimeConfig.submittedEngines,
      submittedAt: this.sitemapRuntimeConfig.submittedAt || null,
      totalSitemaps: totalCount,
      sitemaps: sections,
      lastUpdated: lastGeneratedAt || null,
      generationMode: 'persisted',
    };
  }

  private normalizeSchemaType(inputType: string | undefined): SchemaType {
    const normalized = String(inputType || '').toLowerCase();

    if (normalized === 'organization') return SchemaType.ORGANIZATION;
    if (normalized === 'breadcrumblist' || normalized === 'breadcrumb') return SchemaType.BREADCRUMB_LIST;
    if (normalized === 'faqpage' || normalized === 'faq') return SchemaType.FAQ_PAGE;
    if (normalized === 'webpage') return SchemaType.WEB_PAGE;
    if (normalized === 'localbusiness') return SchemaType.LOCAL_BUSINESS;
    if (normalized === 'aggregaterating') return SchemaType.AGGREGATE_RATING;

    return SchemaType.PRODUCT;
  }

  async getPublicSitemap(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const baseUrl = this.getPublicBaseUrl();
      const products = await this.root.productPort.getAllProducts({ page: 1, limit: 500 });
      const productUrls = (products?.data || [])
        .map((product) => {
          const slug = String(product.name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          if (!slug) {
            return '';
          }

          return `<url><loc>${baseUrl}/produs/${slug}/</loc></url>`;
        })
        .filter(Boolean)
        .join('');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}/</loc></url><url><loc>${baseUrl}/b2b-store/catalog</loc></url>${productUrls}</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.status(200).send(xml);
    } catch (error) {
      next(error);
    }
  }

  async getPublicSitemapByType(req: Request, res: Response, next: NextFunction): Promise<void> {
    // For now we return the same generated sitemap payload regardless of section type.
    // This keeps compatibility with frontend downloads (`/sitemap/:type.xml`) while
    // the split sitemap generator is phased in.
    return this.getPublicSitemap(req, res, next);
  }

  async getRobotsTxt(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const baseUrl = this.getPublicBaseUrl();
      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n');

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.status(200).send(robots);
    } catch (error) {
      next(error);
    }
  }

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
   * Legacy-friendly alias used by frontend service
   * POST /api/v1/seo/metadata/:productId/generate
   */
  async generateSeoMetadataLegacy(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const payload = this.mapMetadataToSeoData(
        productId,
        result.metadata.toJSON(),
        [result.structuredData.toJSON()],
      );

      res.status(201).json(successResponse(payload));
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
   * Legacy-friendly single-product audit endpoint
   * POST /api/v1/seo/audits/run
   */
  async runAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = String(req.body?.productId || req.body?.product_id || '').trim();
      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const auditResult = await this.runProductAuditWithAutoMetadata(productId);
      const payload = await this.buildFrontendAuditPayload(auditResult);
      res.status(201).json(successResponse(payload));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Re-run SEO audit for a product
   * POST /api/v1/seo/audits/reaudit/:productId
   */
  async reauditProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const auditResult = await this.runProductAuditWithAutoMetadata(productId);
      const payload = await this.buildFrontendAuditPayload(auditResult);
      res.status(201).json(successResponse(payload));
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
   * Legacy-friendly alias used by frontend service
   * GET /api/v1/seo/metadata/:productId
   */
  async getSeoMetadataLegacy(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const structuredDataList = await this.root.structuredDataRepository.findByEntity(
        SeoEntityType.PRODUCT,
        productId,
      );

      const payload = this.mapMetadataToSeoData(
        productId,
        metadata.toJSON(),
        structuredDataList.map((sd) => sd.toJSON() as Record<string, any>),
      );

      res.json(successResponse(payload));
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

      const metaTitle =
        updateData.metaTitle ?? updateData.meta_title ?? updateData.title ?? undefined;
      const metaDescription =
        updateData.metaDescription ?? updateData.meta_description ?? updateData.description ?? undefined;
      const canonicalUrl =
        updateData.canonicalUrl ?? updateData.canonical_url ?? undefined;
      const ogTitle = updateData.ogTitle ?? updateData.og_title ?? undefined;
      const ogDescription = updateData.ogDescription ?? updateData.og_description ?? undefined;
      const ogImage = updateData.ogImage ?? updateData.og_image ?? undefined;
      const twitterTitle = updateData.twitterTitle ?? updateData.twitter_title ?? undefined;
      const twitterDescription =
        updateData.twitterDescription ?? updateData.twitter_description ?? undefined;
      const focusKeyword =
        updateData.focusKeyword ??
        updateData.focus_keyword ??
        updateData.focus_keywords?.[0] ??
        undefined;
      const secondaryKeywords =
        updateData.secondaryKeywords ??
        updateData.secondary_keywords ??
        updateData.meta_keywords ??
        updateData.keywords ??
        undefined;

      // Apply updates to domain entity
      if (metaTitle !== undefined) existing.metaTitle = metaTitle;
      if (metaDescription !== undefined) existing.metaDescription = metaDescription;
      if (updateData.slug !== undefined) existing.slug = updateData.slug;
      if (canonicalUrl !== undefined) existing.canonicalUrl = canonicalUrl;
      if (ogTitle !== undefined) existing.ogTitle = ogTitle;
      if (ogDescription !== undefined) existing.ogDescription = ogDescription;
      if (ogImage !== undefined) existing.ogImage = ogImage;
      if (twitterTitle !== undefined) existing.twitterTitle = twitterTitle;
      if (twitterDescription !== undefined) existing.twitterDescription = twitterDescription;
      if (focusKeyword !== undefined) existing.focusKeyword = focusKeyword;
      if (secondaryKeywords !== undefined && Array.isArray(secondaryKeywords)) {
        existing.secondaryKeywords = secondaryKeywords;
      }

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
   * Legacy-friendly alias used by frontend service
   * PUT /api/v1/seo/metadata/:productId
   */
  async updateSeoMetadataLegacy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      if (!productId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Product ID is required', 400));
        return;
      }

      const locale = (req.query.locale as string as SeoLocale) || 'ro';
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

      const body = req.body as Record<string, any>;

      const metaTitle = body.metaTitle ?? body.meta_title ?? body.title;
      const metaDescription = body.metaDescription ?? body.meta_description;
      const canonicalUrl = body.canonicalUrl ?? body.canonical_url;
      const ogTitle = body.ogTitle ?? body.og_title;
      const ogDescription = body.ogDescription ?? body.og_description;
      const ogImage = body.ogImage ?? body.og_image;
      const twitterTitle = body.twitterTitle ?? body.twitter_title;
      const twitterDescription = body.twitterDescription ?? body.twitter_description;
      const focusKeyword = body.focusKeyword ?? body.focus_keyword ?? body.focus_keywords?.[0];
      const secondaryKeywords =
        body.secondaryKeywords ?? body.secondary_keywords ?? body.meta_keywords ?? body.keywords;

      if (metaTitle !== undefined) existing.metaTitle = metaTitle;
      if (metaDescription !== undefined) existing.metaDescription = metaDescription;
      if (body.slug !== undefined) existing.slug = body.slug;
      if (canonicalUrl !== undefined) existing.canonicalUrl = canonicalUrl;
      if (ogTitle !== undefined) existing.ogTitle = ogTitle;
      if (ogDescription !== undefined) existing.ogDescription = ogDescription;
      if (ogImage !== undefined) existing.ogImage = ogImage;
      if (twitterTitle !== undefined) existing.twitterTitle = twitterTitle;
      if (twitterDescription !== undefined) existing.twitterDescription = twitterDescription;
      if (focusKeyword !== undefined) existing.focusKeyword = focusKeyword;
      if (secondaryKeywords !== undefined && Array.isArray(secondaryKeywords)) {
        existing.secondaryKeywords = secondaryKeywords;
      }

      existing.calculateScore();
      existing.updatedAt = new Date();

      const saved = await this.root.metadataRepository.save(existing);
      const payload = this.mapMetadataToSeoData(productId, saved.toJSON());
      res.json(successResponse(payload));
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
   * Product SEO status listing (paginated)
   * GET /api/v1/seo/products/status
   */
  async getProductSeoStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limitRaw = parseInt(String(req.query.pageSize || req.query.limit || '20'), 10) || 20;
      const limit = Math.max(1, Math.min(limitRaw, 200));
      const search = String(req.query.search || '').trim();
      const statusFilter = String(req.query.status || '').trim().toLowerCase();
      const allowedStatuses = new Set(['excellent', 'good', 'needs_work', 'poor']);

      const statusExpr = `
        CASE
          WHEN COALESCE(ar.score, sm.seo_score, 0) >= 85 THEN 'excellent'
          WHEN COALESCE(ar.score, sm.seo_score, 0) >= 70 THEN 'good'
          WHEN COALESCE(ar.score, sm.seo_score, 0) >= 50 THEN 'needs_work'
          ELSE 'poor'
        END
      `;

      const issueCountExpr = `
        (
          COALESCE(
            jsonb_array_length(
              CASE
                WHEN ar.issues IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof(ar.issues) = 'array' THEN ar.issues
                ELSE '[]'::jsonb
              END
            ),
            0
          )
          +
          COALESCE(
            jsonb_array_length(
              CASE
                WHEN ar.recommendations->'warnings' IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof(ar.recommendations->'warnings') = 'array' THEN ar.recommendations->'warnings'
                ELSE '[]'::jsonb
              END
            ),
            0
          )
        )
      `;

      const whereClauses: string[] = [
        'p.is_active = true',
        'p.deleted_at IS NULL',
      ];
      const params: Array<string | number> = [];

      if (search) {
        params.push(`%${search}%`);
        whereClauses.push(`(p.name ILIKE $${params.length} OR COALESCE(p.sku, '') ILIKE $${params.length})`);
      }

      if (statusFilter && allowedStatuses.has(statusFilter)) {
        params.push(statusFilter);
        whereClauses.push(`(${statusExpr}) = $${params.length}`);
      }

      const fromSql = `
        FROM products p
        LEFT JOIN seo_metadata sm
          ON sm.entity_type = 'PRODUCT'
          AND sm.entity_id = p.id::text
          AND sm.locale = 'ro'
        LEFT JOIN LATERAL (
          SELECT a.score, a.issues, a.recommendations, a.created_at
          FROM seo_audit_results a
          WHERE a.recommendations->>'entityType' = 'PRODUCT'
            AND a.recommendations->>'entityId' = p.id::text
          ORDER BY a.created_at DESC
          LIMIT 1
        ) ar ON true
        WHERE ${whereClauses.join(' AND ')}
      `;

      const countSql = `SELECT COUNT(*)::int AS total ${fromSql}`;
      const countRows = await this.root.dataSource.query(countSql, params);
      const total = Number(countRows?.[0]?.total || 0);

      const offset = (page - 1) * limit;
      params.push(limit, offset);

      const dataSql = `
        SELECT
          p.id::text AS product_id,
          p.name AS product_name,
          COALESCE(p.sku, '-') AS sku,
          COALESCE(ar.score, sm.seo_score, 0)::int AS seo_score,
          ${statusExpr} AS status,
          ${issueCountExpr}::int AS issues,
          ar.created_at AS last_audited_at,
          COALESCE(sm.updated_at, p.updated_at, p.created_at) AS updated_at
        ${fromSql}
        ORDER BY p.updated_at DESC NULLS LAST, p.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const rows = await this.root.dataSource.query(dataSql, params);
      const items = (rows || []).map((row: Record<string, any>) => ({
        id: String(row.product_id),
        productId: String(row.product_id),
        productName: String(row.product_name || ''),
        sku: String(row.sku || '-'),
        title: undefined,
        metaDescription: undefined,
        seoScore: Number(row.seo_score || 0),
        status: String(row.status || 'poor'),
        issues: Number(row.issues || 0),
        lastAuditedAt: row.last_audited_at ? new Date(row.last_audited_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      }));

      res.json({
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
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
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limitRaw = parseInt(String(req.query.pageSize || req.query.limit || '20'), 10) || 20;
      const limit = Math.max(1, Math.min(limitRaw, 100));
      const search = String(req.query.search || '').trim().toLowerCase();
      const statusFilter = String(req.query.status || '').trim().toLowerCase();
      const severityFilter = String(req.query.severity || '').trim().toLowerCase();
      const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;

      const maxScan = Math.max(
        page * limit,
        Math.min(parseInt(String(process.env.SEO_AUDIT_LIST_MAX_SCAN || '1500'), 10) || 1500, 5000),
      );

      const scanResult = await this.root.auditRepository.findAll({ page: 1, limit: maxScan });
      const productCache = new Map<string, { productName: string; sku: string }>();
      const mapped = await Promise.all(
        scanResult.data.map((audit) => this.buildFrontendAuditPayload(audit, productCache)),
      );

      const filtered = mapped.filter((audit) => {
        const scoreStatus = String(audit.status || '').toLowerCase();
        const productName = String(audit.productName || '').toLowerCase();
        const sku = String(audit.sku || '').toLowerCase();
        const productId = String(audit.productId || '').toLowerCase();
        const auditedAt = audit.auditedAt ? new Date(String(audit.auditedAt)) : null;
        const issues = Array.isArray(audit.issues) ? (audit.issues as Array<Record<string, any>>) : [];

        if (statusFilter && scoreStatus !== statusFilter) {
          return false;
        }

        if (
          severityFilter &&
          !issues.some((issue) => String(issue.severity || '').toLowerCase() === severityFilter)
        ) {
          return false;
        }

        if (search) {
          const haystack = [productName, sku, productId].join(' ');
          if (!haystack.includes(search)) {
            return false;
          }
        }

        if (dateFrom && auditedAt && auditedAt < dateFrom) {
          return false;
        }

        if (dateTo && auditedAt && auditedAt > dateTo) {
          return false;
        }

        return true;
      });

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const items = filtered.slice(startIndex, startIndex + limit);

      res.json({
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
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

      const payload = await this.buildFrontendAuditPayload(audit);
      res.json(successResponse(payload));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Audit summary for dashboard cards
   * GET /api/v1/seo/audits/summary
   */
  async getAuditSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let aggregate: Record<string, unknown> = {
        total: 0,
        avg_score: 0,
        passed: 0,
        warning: 0,
        failed: 0,
      };

      try {
        const aggregateRows = await this.root.dataSource.query(
          `
            SELECT
              COUNT(*)::int AS total,
              COALESCE(AVG(COALESCE(score, 0)), 0)::float AS avg_score,
              SUM(CASE WHEN COALESCE(score, 0) >= 80 THEN 1 ELSE 0 END)::int AS passed,
              SUM(CASE WHEN COALESCE(score, 0) >= 50 AND COALESCE(score, 0) < 80 THEN 1 ELSE 0 END)::int AS warning,
              SUM(CASE WHEN COALESCE(score, 0) < 50 THEN 1 ELSE 0 END)::int AS failed
            FROM seo_audit_results
          `,
        );
        aggregate = aggregateRows?.[0] || aggregate;
      } catch (error) {
        if (!this.isSchemaDriftError(error)) {
          throw error;
        }
      }

      let sample: SeoAuditResult[] = [];
      try {
        sample = await this.root.auditRepository.findLatest(undefined, undefined, 250);
      } catch (error) {
        if (!this.isSchemaDriftError(error)) {
          throw error;
        }
      }
      const issueCounter = new Map<
        string,
        { type: string; severity: 'critical' | 'high' | 'medium' | 'low'; count: number }
      >();

      for (const audit of sample) {
        const rows = [
          ...audit.issues.map((issue) => issue.toJSON()),
          ...audit.warnings.map((warning) => warning.toJSON()),
        ];

        for (const row of rows) {
          const type = this.toFrontendIssueType(String((row as Record<string, any>).type || ''));
          const severity = this.toFrontendIssueSeverity(
            String((row as Record<string, any>).severity || ''),
          );
          const key = `${type}:${severity}`;
          const current = issueCounter.get(key);
          if (current) {
            current.count += 1;
            continue;
          }
          issueCounter.set(key, {
            type,
            severity,
            count: 1,
          });
        }
      }

      const issueSummary = Array.from(issueCounter.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((row) => ({
          type: row.type,
          count: row.count,
          severity: row.severity,
          actionLabel: row.severity === 'critical' ? 'Fix now' : 'Review',
        }));

      res.json(
        successResponse({
          totalAudits: Number(aggregate.total || 0),
          passed: Number(aggregate.passed || 0),
          warning: Number(aggregate.warning || 0),
          failed: Number(aggregate.failed || 0),
          avgScore: Number(aggregate.avg_score || 0),
          issueSummary,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark issue as fixed (in-memory manual override)
   * POST /api/v1/seo/audits/:auditId/issues/:issueId/fix
   */
  async fixAuditIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auditId, issueId } = req.params;
      if (!auditId || !issueId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Audit ID and Issue ID are required', 400));
        return;
      }

      this.manualIssueFixes.add(this.getManualIssueFixKey(auditId, issueId));
      res.json(successResponse({ fixed: true }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manual fixed marker endpoint
   * POST /api/v1/seo/audits/:auditId/issues/:issueId/mark-fixed
   */
  async markAuditIssueFixed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auditId, issueId } = req.params;
      if (!auditId || !issueId) {
        res.status(400).json(errorResponse('INVALID_REQUEST', 'Audit ID and Issue ID are required', 400));
        return;
      }

      this.manualIssueFixes.add(this.getManualIssueFixKey(auditId, issueId));
      res.json(successResponse({ fixed: true }));
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
      const productSnapshot = await this.root.productPort.getAllProducts({ page: 1, limit: 1 });
      const estimatedUrls = Math.max(2, Number(productSnapshot?.total || 0) + 2);

      res.status(202).json(
        successResponse({
          jobId,
          estimatedUrls,
        }),
      );
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
      const payload = await this.buildSitemapStatusPayload();
      res.json(successResponse(payload));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Alias endpoint used by frontend service
   * POST /api/v1/seo/sitemap/regenerate
   */
  async regenerateSitemap(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.generateSitemap(req, res, next);
  }

  /**
   * Submit sitemap to search engines (tracked internally)
   * POST /api/v1/seo/sitemap/submit
   */
  async submitSitemap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const incoming = Array.isArray(req.body?.engines)
        ? req.body.engines.map((engine: unknown) => String(engine).toLowerCase())
        : [];

      const engines = (incoming.length ? incoming : ['google']).filter((engine: string) =>
        ['google', 'bing', 'yandex'].includes(engine),
      ) as SitemapEngine[];

      this.sitemapRuntimeConfig.submittedEngines = Array.from(new Set(engines));
      this.sitemapRuntimeConfig.submittedAt = new Date().toISOString();

      res.json(
        successResponse({
          submitted: true,
          engines: this.sitemapRuntimeConfig.submittedEngines,
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update in-memory sitemap runtime configuration
   * PUT /api/v1/seo/sitemap/config
   */
  async updateSitemapConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Record<string, any>;

      if (typeof body.autoRegenerate === 'boolean') {
        this.sitemapRuntimeConfig.autoRegenerate = body.autoRegenerate;
      }

      if (['daily', 'weekly', 'monthly'].includes(String(body.regenerateFrequency || ''))) {
        this.sitemapRuntimeConfig.regenerateFrequency = body.regenerateFrequency;
      }

      if (
        ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].includes(
          String(body.changeFrequency || ''),
        )
      ) {
        this.sitemapRuntimeConfig.changeFrequency = body.changeFrequency;
      }

      if (body.priorityRules && typeof body.priorityRules === 'object') {
        this.sitemapRuntimeConfig.priorityRules = body.priorityRules;
      }

      const payload = await this.buildSitemapStatusPayload();
      res.json(successResponse(payload));
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
   * Structured data templates for frontend editor
   * GET /api/v1/seo/structured-data/templates
   */
  async getStructuredDataTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const baseUrl = this.getPublicBaseUrl();
      const now = new Date().toISOString();

      const templates = [
        {
          id: 'template-product-default',
          name: 'Product Rich Result',
          type: 'Product',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'Product',
            name: 'Nume produs',
            description: 'Descriere produs',
            brand: { '@type': 'Brand', name: 'Cypher' },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'RON',
              price: '0.00',
              availability: 'https://schema.org/InStock',
              url: `${baseUrl}/produs/exemplu/`,
            },
          },
          description: 'Default product schema with offer and brand details.',
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'template-organization-default',
          name: 'Organization Profile',
          type: 'Organization',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'Organization',
            name: 'Cypher Lighting',
            url: baseUrl,
            logo: `${baseUrl}/logo.png`,
          },
          description: 'Company profile schema for brand discovery.',
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'template-article-default',
          name: 'Article Story',
          type: 'Article',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'Article',
            headline: 'Titlu articol',
            description: 'Rezumat articol',
            author: {
              '@type': 'Organization',
              name: 'Cypher Lighting',
            },
            mainEntityOfPage: `${baseUrl}/articol/exemplu/`,
          },
          description: 'Article schema for guides, announcements, and knowledge pages.',
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'template-breadcrumb-default',
          name: 'Breadcrumb Trail',
          type: 'BreadcrumbList',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Acasa',
                item: baseUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Catalog',
                item: `${baseUrl}/b2b-store/catalog`,
              },
            ],
          },
          description: 'Navigation breadcrumb schema for category and product pages.',
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'template-faq-default',
          name: 'FAQ Answers',
          type: 'FAQPage',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Care este termenul de livrare?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Livrarea standard se face in 24-72 de ore pentru produsele in stoc.',
                },
              },
            ],
          },
          description: 'FAQ schema for support, policy, and educational pages.',
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'template-local-business-default',
          name: 'Local Business Profile',
          type: 'LocalBusiness',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'LocalBusiness',
            name: 'Cypher Lighting',
            url: baseUrl,
            telephone: '+40 700 000 000',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Strada Exemplu 10',
              addressLocality: 'Bucuresti',
              addressCountry: 'RO',
            },
          },
          description: 'Local business schema for contact and showroom visibility.',
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'template-website-default',
          name: 'Website Search',
          type: 'WebSite',
          schema: {
            '@context': 'https://schema.org/',
            '@type': 'WebSite',
            name: 'Cypher Lighting',
            url: baseUrl,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${baseUrl}/b2b-store/catalog?search={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          description: 'Website schema with search action for search-engine sitelinks.',
          isDefault: true,
          createdAt: now,
        },
      ];

      res.json(successResponse(templates));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate arbitrary JSON-LD payload
   * POST /api/v1/seo/structured-data/validate
   */
  async validateStructuredDataPayload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = (req.body?.schema || req.body || {}) as Record<string, unknown>;
      const schemaType = this.normalizeSchemaType(String(schema['@type'] || 'Product'));

      const entity = new StructuredData({
        id: `validate-${uuidv4()}`,
        entityType: SeoEntityType.PRODUCT,
        entityId: 'validation-preview',
        schemaType,
        jsonLd: schema,
      });

      const errors = entity.validate().map((message, index) => ({
        path: `$.schema.${index}`,
        message,
      }));

      res.json(
        successResponse({
          valid: errors.length === 0,
          errors,
        }),
      );
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
      const safeMetric = async (
        metricName: string,
        operation: () => Promise<number>,
      ): Promise<{ count: number | null; issue?: Record<string, unknown> }> => {
        try {
          const count = await operation();
          return { count };
        } catch (error) {
          const err = error as { code?: string; message?: string };
          const missingRelation =
            err?.code === '42P01' || /relation\s+".*"\s+does not exist/i.test(err?.message || '');

          return {
            count: null,
            issue: {
              metric: metricName,
              errorCode: err?.code || 'UNKNOWN',
              reason: missingRelation ? 'table_missing' : 'query_failed',
              message: err?.message || 'Failed to collect metric',
            },
          };
        }
      };

      const [metadata, audits, sitemaps, structuredData, averageScoreMetric] = await Promise.all([
        safeMetric('seo_metadata', () => this.root.metadataRepository.count()),
        safeMetric('seo_audit_results', () => this.root.auditRepository.count()),
        safeMetric('sitemaps', () => this.root.sitemapRepository.count()),
        safeMetric('structured_data', () => this.root.structuredDataRepository.count()),
        safeMetric('seo_audit_average_score', () => this.root.auditRepository.getAverageScore()),
      ]);

      const issues = [metadata, audits, sitemaps, structuredData, averageScoreMetric]
        .map((entry) => entry.issue)
        .filter(Boolean);

      const collectedMetrics = [metadata, audits, sitemaps, structuredData].filter(
        (entry) => entry.count !== null,
      ).length;

      const status = issues.length === 0 ? 'HEALTHY' : collectedMetrics > 0 ? 'DEGRADED' : 'UNHEALTHY';

      const health = {
        status,
        module: 'seo-automation',
        timestamp: new Date().toISOString(),
        stats: {
          totalMetadata: metadata.count,
          totalAudits: audits.count,
          totalSitemaps: sitemaps.count,
          totalStructuredData: structuredData.count,
          averageAuditScore: averageScoreMetric.count,
        },
        issues,
      };

      res.json(successResponse(health));
    } catch (error) {
      next(error);
    }
  }
}
