# SEO Automation Module

## Overview

The SEO Automation Module (`seo-automation`) is a comprehensive solution for automating SEO optimization of Ledux.ro's LED lighting products on WooCommerce. It generates metadata, audits SEO health, manages sitemaps, and validates structured data.

### Key Features

- **Automated Metadata Generation**: Auto-generate meta titles, descriptions, and slugs from product data
- **SEO Auditing**: Comprehensive audit system with scoring and issue detection
- **Structured Data (JSON-LD)**: Generate and validate schema.org markup for rich snippets
- **Sitemap Management**: Generate and manage XML sitemaps for search engines
- **Multi-Locale Support**: Support for Romanian (ro) and English (en) languages
- **Event-Driven**: React to product changes and synchronize SEO metadata
- **Background Jobs**: Bulk operations with progress tracking
- **WooCommerce Integration**: Sync SEO metadata back to WooCommerce

## Architecture

### Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer (Express)                   │
│              /api/v1/seo/* endpoints                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Application Layer                          │
│  Use Cases (GenerateProductSeo, AuditProductSeo, etc.)      │
│  Orchestrates business logic                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Domain Layer                              │
│  Entities: SeoMetadata, Sitemap, StructuredData, etc.       │
│  Services: SeoScoreCalculator, MetaTagGenerator, etc.       │
│  Repositories (Ports): ISeoMetadataRepository, etc.         │
└──────┬──────────────────────────────┬──────────────────────┘
       │                              │
┌──────▼────────────────┐    ┌────────▼───────────────────┐
│ Infrastructure Layer   │    │  External Adapters        │
│ TypeORM Repositories  │    │  (Ports Implementation)    │
│ Background Jobs       │    │                            │
│ Cache Management      │    │ - IProductPort             │
└──────────────────────┘    │ - ICategoryPort            │
                            │ - IWooCommercePort         │
                            └────────────────────────────┘
```

### Directory Structure

```
seo-automation/
├── src/
│   ├── domain/
│   │   ├── entities/           # Domain entities
│   │   │   ├── SeoMetadata.ts
│   │   │   ├── Sitemap.ts
│   │   │   ├── StructuredData.ts
│   │   │   ├── SeoAuditResult.ts
│   │   │   └── SeoIssue.ts
│   │   ├── repositories/       # Repository interfaces (ports)
│   │   │   ├── ISeoMetadataRepository.ts
│   │   │   ├── ISitemapRepository.ts
│   │   │   ├── IStructuredDataRepository.ts
│   │   │   └── IAuditRepository.ts
│   │   ├── services/          # Domain services (business logic)
│   │   │   ├── SeoScoreCalculator.ts
│   │   │   ├── MetaTagGenerator.ts
│   │   │   ├── SlugGenerator.ts
│   │   │   └── StructuredDataGenerator.ts
│   │   └── errors/            # Domain-specific errors
│   │       └── seo.errors.ts
│   ├── application/
│   │   ├── use-cases/         # Application use cases
│   │   │   ├── GenerateProductSeo.ts
│   │   │   ├── BulkGenerateProductSeo.ts
│   │   │   ├── UpdateSeoMetadata.ts
│   │   │   ├── AuditProductSeo.ts
│   │   │   ├── AuditAllProducts.ts
│   │   │   ├── GenerateSitemap.ts
│   │   │   ├── GenerateStructuredData.ts
│   │   │   ├── ValidateStructuredData.ts
│   │   │   ├── GetSeoOverview.ts
│   │   │   ├── GetProductSeoStatus.ts
│   │   │   ├── FixCommonIssues.ts
│   │   │   ├── MonitorSeoChanges.ts
│   │   │   └── ExportSeoReport.ts
│   │   └── ports/             # External adapters (ports)
│   │       ├── IProductPort.ts
│   │       ├── ICategoryPort.ts
│   │       └── IWooCommercePort.ts
│   ├── infrastructure/
│   │   ├── entities/          # TypeORM entities
│   │   │   ├── SeoMetadataEntity.ts
│   │   │   ├── SitemapEntity.ts
│   │   │   ├── StructuredDataEntity.ts
│   │   │   └── SeoAuditResultEntity.ts
│   │   ├── repositories/      # Repository implementations
│   │   │   ├── TypeOrmSeoMetadataRepository.ts
│   │   │   ├── TypeOrmSitemapRepository.ts
│   │   │   ├── TypeOrmStructuredDataRepository.ts
│   │   │   └── TypeOrmAuditRepository.ts
│   │   ├── jobs/              # Background jobs
│   │   │   ├── SeoAuditJob.ts
│   │   │   ├── SitemapRegenerationJob.ts
│   │   │   ├── StructuredDataValidationJob.ts
│   │   │   └── SeoMonitorJob.ts
│   │   └── composition-root.ts
│   └── seo-module.ts          # Main module implementation
├── tests/
│   ├── domain/                # Domain tests
│   │   ├── SeoMetadata.test.ts
│   │   ├── Sitemap.test.ts
│   │   ├── StructuredData.test.ts
│   │   ├── SeoScoreCalculator.test.ts
│   │   ├── MetaTagGenerator.test.ts
│   │   └── SlugGenerator.test.ts
│   └── application/           # Application tests
│       ├── GenerateProductSeo.test.ts
│       ├── AuditProductSeo.test.ts
│       ├── GenerateSitemap.test.ts
│       ├── BulkGenerateProductSeo.test.ts
│       └── FixCommonIssues.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Core Entities

### SeoMetadata
Represents SEO metadata for a product, category, or page.

**Properties:**
- `id`: Unique identifier
- `entityType`: PRODUCT | CATEGORY | PAGE
- `entityId`: ID of the entity
- `locale`: ro | en
- `metaTitle`: Meta title (max 60 chars)
- `metaDescription`: Meta description (max 160 chars)
- `slug`: URL-safe slug
- `focusKeyword`: Primary keyword to target
- `secondaryKeywords[]`: Additional keywords
- `seoScore`: 0-100 score based on completeness
- `issues[]`: List of SEO issues found

**Key Methods:**
- `validate()`: Validate constraints
- `calculateScore()`: Calculate SEO score
- `generateSlug(title)`: Create URL slug from title
- `isPublished()`: Check if published to WooCommerce
- `needsUpdate()`: Check if update needed

### Sitemap
Represents XML sitemaps for search engines.

**Supported Types:**
- PRODUCTS: All product URLs
- CATEGORIES: All category URLs
- PAGES: Static page URLs
- INDEX: Master sitemap index

**Key Methods:**
- `addEntry(url, lastmod, priority)`: Add/update entry
- `removeEntry(url)`: Remove entry
- `generateXml()`: Generate XML sitemap
- `isStale()`: Check if > 24 hours old

### StructuredData
Manages JSON-LD structured data (schema.org).

**Supported Schema Types:**
- Product
- Organization
- BreadcrumbList
- FAQPage
- WebPage
- LocalBusiness
- AggregateRating

**Key Methods:**
- `validate()`: Validate against schema.org specs
- `toJsonLd()`: Convert to JSON-LD string
- `addProperty(key, value)`: Add property
- `merge(other)`: Merge with another StructuredData

### SeoAuditResult
Records results of SEO audits.

**Audit Types:**
- FULL: Complete audit
- PRODUCT: Product-specific
- CATEGORY: Category-specific
- TECHNICAL: Technical checks only

**Key Methods:**
- `getHighPriorityIssues()`: Get critical + warning issues
- `hasCriticalIssues()`: Check for critical issues
- `getScoreGrade()`: Get human-readable grade

## Domain Services

### SeoScoreCalculator
Pure function service for calculating SEO scores.

**Scoring Breakdown (max 100):**
- Meta title present: +15
- Meta description present: +15
- Title correct length (30-60): +10
- Description correct length (120-160): +10
- Focus keyword in title: +10
- Focus keyword in description: +5
- Slug contains keyword: +5
- Canonical URL: +5
- OG tags: +5
- Structured data: +10
- No duplicate title: +10
- No multiple H1: +10

### MetaTagGenerator
Generates SEO-optimized meta tags from product data.

**Templates:**
```
Title: "[Product Name] - [Category] | Ledux.ro"
Description: "Cumpara [Product Name] cu [Feature]. Livrare rapida."
```

### SlugGenerator
Generates URL-safe slugs with Romanian diacritic support.

**Transformations:**
- Diacritics: ă→a, î→i, ț→t, ș→s
- Lowercase conversion
- Space/underscore to hyphen
- Special character removal
- Duplicate hyphen removal

### StructuredDataGenerator
Generates valid JSON-LD for various schema types.

## Use Cases

### 1. GenerateProductSeo
Generates SEO metadata for a single product.

```typescript
const result = await generateProductSeo.execute({
  productId: 'prod-123',
  locale: 'ro'
});
// Returns: { metadata, structuredData, score, focusKeyword }
```

### 2. AuditProductSeo
Performs comprehensive SEO audit on a product.

```typescript
const result = await auditProductSeo.execute({
  entityType: 'PRODUCT',
  entityId: 'prod-123',
  locale: 'ro'
});
// Returns: { auditResult, score, criticalIssues, warnings, recommendations }
```

### 3. BulkGenerateProductSeo
Generates SEO for all products missing metadata.

### 4. GenerateSitemap
Generates XML sitemaps for products, categories, and pages.

### 5. FixCommonIssues
Auto-fixes common SEO issues.

## API Endpoints

### GET /api/v1/seo/overview
Get SEO dashboard overview with metrics.

### GET /api/v1/seo/products/:productId
Get SEO status for a single product.

### POST /api/v1/seo/products/:productId/generate
Generate SEO metadata for a product.

### PUT /api/v1/seo/products/:productId
Update SEO metadata manually.

### POST /api/v1/seo/products/:productId/audit
Audit SEO for a product.

### POST /api/v1/seo/bulk-generate
Bulk generate missing SEO metadata.

### POST /api/v1/seo/bulk-audit
Audit all products.

### POST /api/v1/seo/auto-fix
Auto-fix common SEO issues.

### GET /api/v1/seo/sitemap
Get sitemap index.

### POST /api/v1/seo/sitemap/regenerate
Regenerate all sitemaps.

### GET /api/v1/seo/structured-data/:entityType/:entityId
Get structured data for entity.

### POST /api/v1/seo/structured-data/validate
Validate JSON-LD schema.

### GET /api/v1/seo/issues
List all SEO issues with filtering.

### GET /api/v1/seo/export
Export SEO report as CSV/Excel.

## Background Jobs

### SeoAuditJob
- **Schedule:** Weekly, Sunday 04:00
- **Action:** Full SEO audit of all products
- **Progress:** Tracked and visible in dashboard

### SitemapRegenerationJob
- **Schedule:** Daily 05:00
- **Action:** Regenerate all sitemaps
- **Output:** Upload to WooCommerce

### StructuredDataValidationJob
- **Schedule:** Weekly, Wednesday 04:00
- **Action:** Validate all structured data records
- **Output:** Report invalid schemas

### SeoMonitorJob
- **Schedule:** Every 6 hours
- **Action:** Check for products with missing/outdated SEO
- **Output:** Flag products needing attention

## External Adapters (Ports)

### IProductPort
Retrieves product data.

```typescript
interface IProductPort {
  getProduct(productId: string): Promise<Product>;
  getAllProducts(pagination): Promise<PaginatedResult<Product>>;
  getProductsByCategory(categoryId): Promise<Product[]>;
  searchProducts(query): Promise<PaginatedResult<Product>>;
}
```

### ICategoryPort
Retrieves category data.

### IWooCommercePort
Syncs SEO metadata to WooCommerce.

```typescript
interface IWooCommercePort {
  updateProductMeta(meta): Promise<void>;
  uploadSitemap(url): Promise<void>;
  updateCanonicalUrl(productId, url): Promise<void>;
  isConnected(): Promise<boolean>;
  getApiVersion(): Promise<string>;
}
```

## Events

### Published Events

**seo.metadata_generated**
- Triggered when new SEO metadata is generated
- Payload: `{ productId, locale, score, focusKeyword, executionTimeMs }`

**seo.metadata_updated**
- Triggered when metadata is updated
- Payload: Same as above

**seo.sitemap_regenerated**
- Triggered when sitemaps are regenerated
- Payload: `{ sitemapTypes[], entryCount, executionTimeMs }`

**seo.audit_completed**
- Triggered when audit completes
- Payload: `{ auditId, entityType, entityId, score, issueCount }`

### Subscribed Events

**product.created**
- Generate initial SEO metadata

**product.updated**
- Regenerate SEO if product details changed

**category.updated**
- Regenerate category SEO metadata

**woocommerce.product_synced**
- Sync SEO metadata back to WooCommerce

## Error Handling

### Custom Errors

All errors extend `BaseError` for consistent handling:

- `MetadataNotFoundError` (404)
- `InvalidSchemaError` (400)
- `SitemapGenerationError` (500)
- `AuditError` (500)
- `DuplicateSlugError` (409)
- `InvalidMetaLengthError` (422)
- `ProductNotFoundError` (404)
- `WooCommerceError` (503)

## Testing

### Test Coverage

- Domain entities: 80%+
- Domain services: 85%+
- Use cases: 75%+
- Overall target: 75%+

### Running Tests

```bash
npm test                    # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

## Performance

### Caching Strategy

- **L1 Cache (Redis):** SEO metadata, sitemaps, scores
- **L2 Cache (Memory):** Frequently accessed items
- **TTL:** 24 hours for metadata, 12 hours for scores

### Optimization

- Batch operations for bulk updates
- Lazy loading of related data
- Query optimization with indexes
- Async processing of background jobs

## Configuration

### Environment Variables

```env
SEO_BASE_URL=https://ledux.ro
SEO_CACHE_TTL=86400
SEO_SITEMAP_INDEX_URL=https://ledux.ro/sitemap_index.xml
SEO_AUDIT_BATCH_SIZE=100
SEO_JOB_TIMEOUT=300000
```

### Feature Flags

```typescript
featureFlag: 'enable_seo_automation'
```

## Maintenance

### Health Checks

Module includes health check endpoint: `/api/v1/seo/health`

Checks:
- Database connectivity
- Cache/Redis connectivity
- Module status

### Metrics

- Request count
- Error rate
- Average response time
- Active background workers
- Cache hit rate
- Event count (published/received)

## Development

### Building

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode compilation
```

### Linting

```bash
npm run lint       # Run ESLint
npm run lint:fix   # Auto-fix linting issues
```

## Dependencies

### Production
- `express`: Web framework
- `typeorm`: ORM for database
- `ioredis`: Redis client
- `winston`: Structured logging
- `uuid`: UUID generation

### Development
- `typescript`: Type safety
- `jest`: Testing framework
- `eslint`: Code quality
- `ts-jest`: TypeScript testing support

## Contributing

### Code Standards

- **Zero `as any`:** Use proper typing
- **Full JSDoc:** Every public method documented
- **SRP:** Single responsibility principle
- **DDD:** Domain-driven design patterns
- **Hexagonal Architecture:** Ports and adapters

### Commit Message Format

```
[FEATURE/FIX/REFACTOR] Brief description

Detailed explanation of changes and why.
```

## License

PROPRIETARY - All rights reserved by CYPHER ERP Development Team
