import Joi from 'joi';

/**
 * SEO metadata generation schema
 */
export const generateSeoMetadataSchema = Joi.object({
  auto_generate: Joi.boolean().optional().default(true),
  include_og_tags: Joi.boolean().optional().default(true),
  include_schema_markup: Joi.boolean().optional().default(true),
  target_keywords: Joi.array().items(Joi.string()).optional(),
});

/**
 * SEO audit schema
 */
export const auditSeoSchema = Joi.object({
  include_mobile_audit: Joi.boolean().optional().default(true),
  include_performance_audit: Joi.boolean().optional().default(true),
  check_backlinks: Joi.boolean().optional().default(false),
  check_competitors: Joi.boolean().optional().default(false),
  compare_keywords: Joi.array().items(Joi.string()).optional(),
});

/**
 * Get SEO metadata schema
 */
export const getSeoMetadataSchema = Joi.object({
  include_suggestions: Joi.boolean().optional().default(true),
  include_missing_fields: Joi.boolean().optional().default(true),
});

/**
 * Update SEO metadata schema
 */
export const updateSeoMetadataSchema = Joi.object({
  meta_title: Joi.string().max(60).optional(),
  meta_description: Joi.string().max(160).optional(),
  meta_keywords: Joi.array().items(Joi.string()).optional(),
  slug: Joi.string().optional(),
  canonical_url: Joi.string().uri().optional(),
  og_title: Joi.string().optional(),
  og_description: Joi.string().optional(),
  og_image: Joi.string().uri().optional(),
  og_url: Joi.string().uri().optional(),
  twitter_card: Joi.string()
    .valid('SUMMARY', 'SUMMARY_LARGE_IMAGE', 'APP', 'PLAYER')
    .optional(),
  twitter_title: Joi.string().optional(),
  twitter_description: Joi.string().optional(),
  twitter_image: Joi.string().uri().optional(),
  robots_meta: Joi.string().optional(),
  structured_data: Joi.object().optional(),
  focus_keywords: Joi.array().items(Joi.string()).optional(),
});

/**
 * Bulk SEO generation schema
 */
export const bulkGenerateSeoSchema = Joi.object({
  product_ids: Joi.array()
    .items(Joi.string().uuid())
    .optional(),
  category: Joi.string().optional(),
  filters: Joi.object().optional(),
  overwrite_existing: Joi.boolean().optional().default(false),
  target_language: Joi.string().optional(),
});

/**
 * Bulk SEO audit schema
 */
export const bulkAuditSeoSchema = Joi.object({
  product_ids: Joi.array()
    .items(Joi.string().uuid())
    .optional(),
  category: Joi.string().optional(),
  filters: Joi.object().optional(),
  priority: Joi.string()
    .valid('LOW', 'MEDIUM', 'HIGH')
    .optional()
    .default('MEDIUM'),
  schedule: Joi.string().optional(),
});

/**
 * List SEO audits schema
 */
export const listSeoAuditsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  product_id: Joi.string().uuid().optional(),
  status: Joi.string()
    .valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
    .optional(),
  severity: Joi.string()
    .valid('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')
    .optional(),
  search: Joi.string().optional(),
});

/**
 * Get SEO audit details schema
 */
export const getAuditDetailsSchema = Joi.object({
  include_recommendations: Joi.boolean().optional().default(true),
  include_fixes: Joi.boolean().optional().default(true),
});

/**
 * Generate sitemap schema
 */
export const generateSitemapSchema = Joi.object({
  include_product_sitemap: Joi.boolean().optional().default(true),
  include_category_sitemap: Joi.boolean().optional().default(true),
  include_blog_sitemap: Joi.boolean().optional().default(false),
  priority_rules: Joi.object().optional(),
  change_frequency: Joi.string()
    .valid('ALWAYS', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'NEVER')
    .optional(),
});

/**
 * Get sitemap status schema
 */
export const getSitemapStatusSchema = Joi.object({
  include_submission_status: Joi.boolean().optional().default(true),
});

/**
 * Get structured data schema
 */
export const getStructuredDataSchema = Joi.object({
  schema_type: Joi.string()
    .valid('PRODUCT', 'ORGANIZATION', 'BREADCRUMB', 'FAQ', 'REVIEW', 'EVENT', 'ALL')
    .optional()
    .default('ALL'),
  format: Joi.string()
    .valid('JSON_LD', 'MICRODATA', 'RDFA')
    .optional()
    .default('JSON_LD'),
});

/**
 * Update structured data schema
 */
export const updateStructuredDataSchema = Joi.object({
  schema_type: Joi.string()
    .valid('PRODUCT', 'ORGANIZATION', 'BREADCRUMB', 'FAQ', 'REVIEW', 'EVENT')
    .required(),
  data: Joi.object().required(),
  validate: Joi.boolean().optional().default(true),
});

/**
 * Validation middleware for requests
 */
export function validateRequest(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    // Validate body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const { error: bodyError, value: bodyValue } = schema.validate(req.body);
      if (bodyError) {
        return res.status(400).json({
          error: bodyError.details[0].message,
          code: 'VALIDATION_ERROR',
        });
      }
      req.validatedBody = bodyValue;
    }

    // Validate query for GET requests
    if (req.method === 'GET') {
      const { error: queryError, value: queryValue } = schema.validate(req.query);
      if (queryError) {
        return res.status(400).json({
          error: queryError.details[0].message,
          code: 'VALIDATION_ERROR',
        });
      }
      req.validatedQuery = queryValue;
    }

    next();
  };
}
