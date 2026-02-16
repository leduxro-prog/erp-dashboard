/**
 * SEO Service
 */

import { apiClient } from './api';
import { ApiResponse, PaginatedResponse } from '../types/common';

// Helper to build query string
const buildQueryString = (params: Record<string, any> | undefined): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

// Helper to unwrap ApiResponse
const unwrapData = <T>(response: ApiResponse<T>): T => {
  if (!response.data) {
    throw new Error('No data in response');
  }
  return response.data;
};

// SEO Types
export interface SEOData {
  productId: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  schema?: Record<string, any>;
  h1Tag?: string;
  h2Tags?: string[];
  altTags?: Record<string, string>;
  updatedAt: string;
}

export interface ProductSEOStatus {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  title?: string;
  metaDescription?: string;
  seoScore: number;
  status: 'excellent' | 'good' | 'needs_work' | 'poor';
  issues: number;
  lastAuditedAt?: string;
  updatedAt: string;
}

export interface SEOAudit {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  score: number;
  status: 'passed' | 'warning' | 'failed';
  issues: Array<{
    id: string;
    type: 'title' | 'meta_description' | 'h1' | 'h2' | 'alt_text' | 'canonical' | 'schema' | 'keywords' | 'content_length' | 'images' | 'performance' | 'mobile' | 'https' | 'redirect' | 'duplicate';
    severity: 'critical' | 'high' | 'medium' | 'low';
    issue: string;
    suggestion: string;
    fieldName?: string;
    currentValue?: string;
    recommendedValue?: string;
    fixed?: boolean;
  }>;
  categories: {
    on_page: { score: number; issues: number };
    technical: { score: number; issues: number };
    content: { score: number; issues: number };
    images: { score: number; issues: number };
  };
  auditedAt: string;
  createdBy?: string;
}

export interface SEOIssueSummary {
  type: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  actionLabel: string;
}

export interface SitemapSection {
  type: 'products' | 'categories' | 'blog' | 'pages' | 'custom';
  name: string;
  url: string;
  pages: number;
  lastGeneratedAt: string;
  status: 'active' | 'stale' | 'error' | 'pending';
  lastError?: string;
}

export interface SitemapStatus {
  enabled: boolean;
  autoRegenerate: boolean;
  lastGeneratedAt?: string;
  sections: SitemapSection[];
  totalUrls: number;
  submittedToSearchEngines: boolean;
  submittedEngines: ('google' | 'bing' | 'yandex')[];
}

export interface SitemapGenerateOptions {
  sections?: ('products' | 'categories' | 'blog' | 'pages' | 'custom')[];
  includeUnlisted?: boolean;
  priorityRules?: Record<string, number>;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

export interface StructuredDataTemplate {
  id: string;
  name: string;
  type: 'Product' | 'Organization' | 'Article' | 'BreadcrumbList' | 'FAQPage' | 'LocalBusiness' | 'WebSite';
  schema: Record<string, any>;
  description?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface PageSpeedInsight {
  mobileScore: number;
  desktopScore: number;
  overallStatus: 'good' | 'needs_improvement' | 'poor';
  metrics: Array<{
    id: string;
    name: string;
    value: number;
    threshold: number;
    unit: string;
    status: 'good' | 'needs_improvement' | 'poor';
  }>;
  opportunities: Array<{
    description: string;
    potentialSavings: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  diagnostics: Array<{
    description: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
  }>;
}

export interface SearchConsoleData {
  dateRange: { start: string; end: string };
  totalQueries: number;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  avgCtr: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    title: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  byDate: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export interface RobotsTxtRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export interface RobotsTxtContent {
  rules: RobotsTxtRule[];
  sitemapUrl?: string;
  createdAt: string;
  updatedAt: string;
}

class SEOService {
  // ============================================================
  // AUDIT METHODS
  // ============================================================

  /**
   * Get all product SEO statuses with filters
   */
  async getProductSEOStatus(params?: {
    page?: number;
    pageSize?: number;
    status?: 'excellent' | 'good' | 'needs_work' | 'poor';
    search?: string;
  }): Promise<PaginatedResponse<ProductSEOStatus>> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<PaginatedResponse<ProductSEOStatus>>(
      `/seo/products/status${qs}`,
    );
    return response;
  }

  /**
   * Get audit list with filters
   */
  async getAuditList(params?: {
    page?: number;
    pageSize?: number;
    status?: 'passed' | 'warning' | 'failed';
    severity?: 'critical' | 'high' | 'medium' | 'low';
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<SEOAudit>> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<PaginatedResponse<SEOAudit>>(
      `/seo/audits${qs}`,
    );
    return response;
  }

  /**
   * Get single audit details
   */
  async getAuditDetails(auditId: string): Promise<SEOAudit> {
    const response = await apiClient.get<ApiResponse<SEOAudit>>(
      `/seo/audits/${auditId}`,
    );
    return unwrapData(response);
  }

  /**
   * Run audit for a single product
   */
  async runAudit(productId: string): Promise<SEOAudit> {
    const response = await apiClient.post<ApiResponse<SEOAudit>>(
      '/seo/audits/run',
      { productId },
    );
    return unwrapData(response);
  }

  /**
   * Run bulk audit for multiple products
   */
  async runBulkAudit(productIds: string[]): Promise<{ jobId: string; totalProducts: number }> {
    const response = await apiClient.post<ApiResponse<{ jobId: string; totalProducts: number }>>(
      '/seo/audits/bulk',
      { productIds },
    );
    return unwrapData(response);
  }

  /**
   * Fix a specific audit issue
   */
  async fixIssue(auditId: string, issueId: string, data: {
    value?: string;
    autoFix?: boolean;
  }): Promise<{ fixed: boolean; error?: string }> {
    const response = await apiClient.post<ApiResponse<{ fixed: boolean; error?: string }>>(
      `/seo/audits/${auditId}/issues/${issueId}/fix`,
      data,
    );
    return unwrapData(response);
  }

  /**
   * Mark issue as fixed manually
   */
  async markIssueFixed(auditId: string, issueId: string): Promise<void> {
    await apiClient.post(`/seo/audits/${auditId}/issues/${issueId}/mark-fixed`);
  }

  /**
   * Re-audit product
   */
  async reaudit(productId: string): Promise<SEOAudit> {
    const response = await apiClient.post<ApiResponse<SEOAudit>>(
      `/seo/audits/reaudit/${productId}`,
    );
    return unwrapData(response);
  }

  /**
   * Get audit summary statistics
   */
  async getAuditSummary(): Promise<{
    totalAudits: number;
    passed: number;
    warning: number;
    failed: number;
    avgScore: number;
    issueSummary: SEOIssueSummary[];
  }> {
    const response = await apiClient.get<ApiResponse<{
      totalAudits: number;
      passed: number;
      warning: number;
      failed: number;
      avgScore: number;
      issueSummary: SEOIssueSummary[];
    }>>(
      '/seo/audits/summary',
    );
    return unwrapData(response);
  }

  // ============================================================
  // METADATA METHODS
  // ============================================================

  /**
   * Get SEO metadata for product
   */
  async getSeoMetadata(productId: string): Promise<SEOData> {
    const response = await apiClient.get<ApiResponse<SEOData>>(
      `/seo/metadata/${productId}`,
    );
    return unwrapData(response);
  }

  /**
   * Generate AI-powered SEO metadata
   */
  async generateMetadata(productId: string, options?: {
    targetKeywords?: string[];
    tone?: string;
    language?: string;
  }): Promise<SEOData> {
    const response = await apiClient.post<ApiResponse<SEOData>>(
      `/seo/metadata/${productId}/generate`,
      options || {},
    );
    return unwrapData(response);
  }

  /**
   * Update SEO metadata
   */
  async updateSeoMetadata(productId: string, data: Partial<SEOData>): Promise<SEOData> {
    const response = await apiClient.put<ApiResponse<SEOData>>(
      `/seo/metadata/${productId}`,
      data,
    );
    return unwrapData(response);
  }

  /**
   * Bulk update metadata
   */
  async bulkUpdateMetadata(updates: Array<{ productId: string; data: Partial<SEOData> }>): Promise<{ success: number; failed: number }> {
    const response = await apiClient.put<ApiResponse<{ success: number; failed: number }>>(
      '/seo/metadata/bulk',
      { updates },
    );
    return unwrapData(response);
  }

  // ============================================================
  // SITEMAP METHODS
  // ============================================================

  /**
   * Get sitemap status
   */
  async getSitemapStatus(): Promise<SitemapStatus> {
    const response = await apiClient.get<ApiResponse<SitemapStatus>>(
      '/seo/sitemap/status',
    );
    return unwrapData(response);
  }

  /**
   * Regenerate sitemap
   */
  async regenerateSitemap(options?: SitemapGenerateOptions): Promise<{ jobId: string; estimatedUrls: number }> {
    const response = await apiClient.post<ApiResponse<{ jobId: string; estimatedUrls: number }>>(
      '/seo/sitemap/regenerate',
      options || {},
    );
    return unwrapData(response);
  }

  /**
   * Get sitemap XML content
   */
  async getSitemapXML(type?: string): Promise<Blob> {
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const url = type ? `${baseUrl}/seo/sitemap/${type}.xml` : `${baseUrl}/seo/sitemap.xml`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiClient.getToken() || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sitemap');
    }

    return response.blob();
  }

  /**
   * Submit sitemap to search engines
   */
  async submitSitemap(engines?: ('google' | 'bing' | 'yandex')[]): Promise<{ submitted: boolean; engines: string[]; errors?: Record<string, string> }> {
    const response = await apiClient.post<ApiResponse<{ submitted: boolean; engines: string[]; errors?: Record<string, string> }>>(
      '/seo/sitemap/submit',
      { engines },
    );
    return unwrapData(response);
  }

  /**
   * Update sitemap configuration
   */
  async updateSitemapConfig(config: {
    autoRegenerate: boolean;
    regenerateFrequency?: 'daily' | 'weekly' | 'monthly';
    priorityRules?: Record<string, number>;
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  }): Promise<SitemapStatus> {
    const response = await apiClient.put<ApiResponse<SitemapStatus>>(
      '/seo/sitemap/config',
      config,
    );
    return unwrapData(response);
  }

  // ============================================================
  // STRUCTURED DATA METHODS
  // ============================================================

  /**
   * Get structured data templates
   */
  async getStructuredDataTemplates(): Promise<StructuredDataTemplate[]> {
    const response = await apiClient.get<ApiResponse<StructuredDataTemplate[]>>(
      '/seo/structured-data/templates',
    );
    return unwrapData(response);
  }

  /**
   * Get product structured data
   */
  async getProductStructuredData(productId: string): Promise<Record<string, any>> {
    const response = await apiClient.get<ApiResponse<Record<string, any>>>(
      `/seo/structured-data/product/${productId}`,
    );
    return unwrapData(response);
  }

  /**
   * Update product structured data
   */
  async updateProductStructuredData(productId: string, schema: Record<string, any>): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await apiClient.put<ApiResponse<{ valid: boolean; errors?: string[] }>>(
      `/seo/structured-data/product/${productId}`,
      { schema },
    );
    return unwrapData(response);
  }

  /**
   * Validate structured data
   */
  async validateStructuredData(schema: Record<string, any>): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
    const response = await apiClient.post<ApiResponse<{ valid: boolean; errors?: Array<{ path: string; message: string }> }>>(
      '/seo/structured-data/validate',
      { schema },
    );
    return unwrapData(response);
  }

  /**
   * Generate structured data from product
   */
  async generateStructuredData(productId: string): Promise<Record<string, any>> {
    const response = await apiClient.post<ApiResponse<Record<string, any>>>(
      `/seo/structured-data/generate/${productId}`,
    );
    return unwrapData(response);
  }

  // ============================================================
  // SEARCH CONSOLE METHODS
  // ============================================================

  /**
   * Get search console data
   */
  async getSearchConsoleData(params?: {
    dateFrom?: string;
    dateTo?: string;
    dimensions?: ('query' | 'page' | 'country' | 'device')[];
  }): Promise<SearchConsoleData> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<ApiResponse<SearchConsoleData>>(
      `/seo/search-console${qs}`,
    );
    return unwrapData(response);
  }

  /**
   * Connect search console
   */
  async connectSearchConsole(): Promise<{ authorizationUrl: string }> {
    const response = await apiClient.post<ApiResponse<{ authorizationUrl: string }>>(
      '/seo/search-console/connect',
    );
    return unwrapData(response);
  }

  /**
   * Disconnect search console
   */
  async disconnectSearchConsole(): Promise<void> {
    await apiClient.post('/seo/search-console/disconnect');
  }

  // ============================================================
  // ROBOTS.TXT METHODS
  // ============================================================

  /**
   * Get robots.txt content
   */
  async getRobotsTxt(): Promise<RobotsTxtContent> {
    const response = await apiClient.get<ApiResponse<RobotsTxtContent>>(
      '/seo/robots.txt',
    );
    return unwrapData(response);
  }

  /**
   * Update robots.txt
   */
  async updateRobotsTxt(content: Partial<RobotsTxtContent>): Promise<RobotsTxtContent> {
    const response = await apiClient.put<ApiResponse<RobotsTxtContent>>(
      '/seo/robots.txt',
      content,
    );
    return unwrapData(response);
  }

  /**
   * Validate robots.txt
   */
  async validateRobotsTxt(url: string): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await apiClient.post<ApiResponse<{ valid: boolean; errors?: string[] }>>(
      '/seo/robots.txt/validate',
      { url },
    );
    return unwrapData(response);
  }

  // ============================================================
  // PAGE SPEED METHODS
  // ============================================================

  /**
   * Get page speed insights
   */
  async getPageSpeedInsights(productId: string): Promise<PageSpeedInsight> {
    const response = await apiClient.get<ApiResponse<PageSpeedInsight>>(
      `/seo/page-speed/${productId}`,
    );
    return unwrapData(response);
  }

  /**
   * Run page speed analysis
   */
  async runPageSpeedAnalysis(productId: string, strategy?: 'mobile' | 'desktop'): Promise<PageSpeedInsight> {
    const response = await apiClient.post<ApiResponse<PageSpeedInsight>>(
      `/seo/page-speed/${productId}/analyze`,
      { strategy },
    );
    return unwrapData(response);
  }

  // ============================================================
  // JOBS / BACKGROUND TASKS
  // ============================================================

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    total: number;
    processed: number;
    error?: string;
    result?: any;
    startedAt: string;
    completedAt?: string;
  }> {
    const response = await apiClient.get<ApiResponse<{
      id: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress: number;
      total: number;
      processed: number;
      error?: string;
      result?: any;
      startedAt: string;
      completedAt?: string;
    }>>(
      `/seo/jobs/${jobId}`,
    );
    return unwrapData(response);
  }
}

export const seoService = new SEOService();
export default seoService;
