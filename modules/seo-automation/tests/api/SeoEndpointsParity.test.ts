import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';

import { createSeoModuleCompositionRoot } from '../../src/infrastructure/composition-root';
import { SeoEntityType } from '../../src/domain/entities/SeoIssue';

const mockResolved = <T,>(value: T) => (jest.fn() as any).mockResolvedValue(value);

function createQueryBuilder(result: {
  many?: unknown[];
  count?: number;
  rawOne?: Record<string, unknown>;
}) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: mockResolved(result.many || []),
    getCount: mockResolved(result.count || 0),
    getManyAndCount: mockResolved([result.many || [], result.count || 0]),
    getRawOne: mockResolved(result.rawOne || {}),
  };
}

async function buildApp(): Promise<{
  app: Express;
  productPort: { getAllProducts: jest.Mock };
}> {
  const sitemapRepo = {
    save: jest.fn(),
    findOne: mockResolved(null),
    findAndCount: mockResolved([[], 0]),
    find: mockResolved([]),
    count: mockResolved(0),
    delete: mockResolved({ affected: 0 }),
    createQueryBuilder: jest.fn(() => createQueryBuilder({ many: [], count: 0 })),
  };

  const auditRepo = {
    save: jest.fn(),
    findOne: mockResolved(null),
    findAndCount: mockResolved([[], 0]),
    find: mockResolved([]),
    count: mockResolved(0),
    delete: mockResolved({ affected: 0 }),
    createQueryBuilder: jest.fn(() =>
      createQueryBuilder({
        many: [
          {
            id: 'audit-1',
            score: 81,
            createdAt: new Date('2026-03-08T10:00:00.000Z'),
            issues: [{ type: 'missing_title', severity: 'critical', message: 'Missing title' }],
            recommendations: {
              entityType: SeoEntityType.PRODUCT,
              entityId: 'product-1',
              auditType: 'full',
              passed: [],
              recommendations: [],
              warnings: [{ type: 'missing_h2', severity: 'warning', message: 'Missing h2' }],
              executionTimeMs: 12,
            },
            startedAt: new Date('2026-03-08T10:00:00.000Z'),
            completedAt: new Date('2026-03-08T10:00:01.000Z'),
          },
        ],
        rawOne: { avg: '81' },
      }),
    ),
  };

  const structuredDataRepo = {
    save: jest.fn(),
    findOne: mockResolved(null),
    findAndCount: mockResolved([[], 0]),
    find: mockResolved([]),
    count: mockResolved(0),
    delete: mockResolved({ affected: 0 }),
    createQueryBuilder: jest.fn(() => createQueryBuilder({ many: [], count: 0 })),
  };

  const metadataRepo = {
    save: jest.fn(),
    findOne: mockResolved(null),
    findAndCount: mockResolved([[], 0]),
    find: mockResolved([]),
    count: mockResolved(0),
    delete: mockResolved({ affected: 0 }),
    createQueryBuilder: jest.fn(() => createQueryBuilder({ many: [], count: 0 })),
  };

  const dataSource = {
    query: mockResolved([
      { total: 5, avg_score: 78, passed: 2, warning: 2, failed: 1 },
    ]),
    getRepository: jest.fn((entity: { name: string }) => {
      switch (entity.name) {
        case 'SitemapEntity':
          return sitemapRepo;
        case 'SeoAuditResultEntity':
          return auditRepo;
        case 'StructuredDataEntity':
          return structuredDataRepo;
        case 'SeoMetadataEntity':
          return metadataRepo;
        default:
          throw new Error(`Unexpected repository request: ${entity.name}`);
      }
    }),
  } as any;

  const productPort = {
    getProduct: mockResolved(null),
    getAllProducts: mockResolved({
      data: [
        { id: 'p-1', name: 'Produs Unu' },
        { id: 'p-2', name: 'Produs Doi' },
        { id: 'p-3', name: 'Produs Trei' },
      ],
      total: 3,
      page: 1,
      limit: 500,
      hasMore: false,
    }),
    getProductsByCategory: mockResolved([]),
    searchProducts: mockResolved({ data: [], total: 0, page: 1, limit: 20, hasMore: false }),
  };

  const eventBus = {
    publish: mockResolved(undefined),
    subscribe: mockResolved(undefined),
    client: {},
  };

  const root = await createSeoModuleCompositionRoot(
    dataSource,
    eventBus as any,
    {} as any,
    productPort as any,
    {} as any,
    {} as any,
  );

  const app = express();
  app.use(express.json());
  app.use('/api/v1/seo', root.router);
  app.use('/api/v1/seo-automation', root.router);

  return { app, productPort: productPort as any };
}

describe('SEO endpoints parity', () => {
  let app: Express;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  it('returns a truthful sitemap status payload even when no sitemap rows are persisted yet', async () => {
    const response = await request(app).get('/api/v1/seo/sitemap/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totalUrls: 5,
          lastGeneratedAt: expect.any(String),
          sections: expect.arrayContaining([
            expect.objectContaining({
              type: 'products',
              pages: 3,
              status: 'active',
            }),
            expect.objectContaining({
              type: 'pages',
              pages: 2,
              status: 'active',
            }),
          ]),
        }),
      }),
    );
  });

  it('keeps the sitemap config update route mounted for the authenticated admin UI contract', async () => {
    const response = await request(app).put('/api/v1/seo/sitemap/config').send({
      autoRegenerate: false,
      regenerateFrequency: 'weekly',
      changeFrequency: 'weekly',
      priorityRules: {
        products: 0.9,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          autoRegenerate: false,
        }),
      }),
    );
  });

  it('keeps structured data templates anonymously reachable for every schema card rendered by the frontend', async () => {
    const response = await request(app).get('/api/v1/seo/structured-data/templates');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ type: 'Product' }),
          expect.objectContaining({ type: 'Organization' }),
          expect.objectContaining({ type: 'Article' }),
          expect.objectContaining({ type: 'BreadcrumbList' }),
          expect.objectContaining({ type: 'FAQPage' }),
          expect.objectContaining({ type: 'LocalBusiness' }),
          expect.objectContaining({ type: 'WebSite' }),
        ]),
      }),
    );
  });

  it('keeps the audit summary cards payload anonymously reachable for the frontend dashboard', async () => {
    const response = await request(app).get('/api/v1/seo/audits/summary');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          totalAudits: 5,
          passed: 2,
          warning: 2,
          failed: 1,
          avgScore: 78,
          issueSummary: expect.any(Array),
        },
      }),
    );
  });

  it('serves the same anonymous SEO surface on both production mount paths', async () => {
    const canonicalResponse = await request(app).get('/api/v1/seo/sitemap/status');
    const legacyAliasResponse = await request(app).get('/api/v1/seo-automation/sitemap/status');

    expect(canonicalResponse.status).toBe(200);
    expect(legacyAliasResponse.status).toBe(200);
    expect(legacyAliasResponse.body).toEqual(
      expect.objectContaining({
        success: canonicalResponse.body.success,
        data: expect.objectContaining({
          totalUrls: canonicalResponse.body.data.totalUrls,
          generationMode: canonicalResponse.body.data.generationMode,
          sections: expect.arrayContaining([
            expect.objectContaining({
              type: canonicalResponse.body.data.sections[0].type,
              pages: canonicalResponse.body.data.sections[0].pages,
              status: canonicalResponse.body.data.sections[0].status,
            }),
            expect.objectContaining({
              type: canonicalResponse.body.data.sections[1].type,
              pages: canonicalResponse.body.data.sections[1].pages,
              status: canonicalResponse.body.data.sections[1].status,
            }),
          ]),
        }),
      }),
    );
  });
});
