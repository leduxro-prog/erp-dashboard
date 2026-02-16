/**
 * CustomerController
 * Handles unified customer search across ERP, B2B, and SmartBill sources.
 */


import { authenticate } from '@shared/middleware/auth.middleware';
import { createModuleLogger } from '@shared/utils/logger';
import { Request, Response, Router } from 'express';

import { Customer360Service } from '../../application/services/Customer360Service';
import {
  UnifiedCustomerSearchService,
  CustomerSource,
} from '../../application/services/UnifiedCustomerSearchService';

export class CustomerController {
  private readonly router: Router;
  private readonly logger = createModuleLogger('CustomerController');

  constructor(
    private readonly searchService: UnifiedCustomerSearchService,
    private readonly customer360Service?: Customer360Service,
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // All routes require ERP authentication
    this.router.use(authenticate);

    // GET /customers/search?q=...&sources=erp,b2b,smartbill&limit=50&offset=0
    this.router.get('/search', this.search.bind(this));

    // GET /customers/top-customers?limit=20
    this.router.get('/top-customers', this.getTopCustomers.bind(this));

    // GET /customers/:source/:id/360 - full 360 profile
    this.router.get('/:source/:id/360', this.getCustomer360.bind(this));

    // GET /customers/:source/:id - get single customer by source and ID
    this.router.get('/:source/:id', this.getById.bind(this));

    // GET /customers - list all (backward compatible with CreateQuoteForm)
    this.router.get('/', this.listAll.bind(this));
  }

  /**
   * Unified customer search across all sources.
   * GET /customers/search?q=<query>&sources=erp,b2b,smartbill&limit=50&offset=0
   */
  private async search(req: Request, res: Response): Promise<void> {
    try {
      const q = (req.query.q as string) || '';
      const sourcesParam = (req.query.sources as string) || 'erp,b2b';
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const sources = sourcesParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ['erp', 'b2b', 'smartbill'].includes(s)) as CustomerSource[];

      if (q.length < 1) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Query must be at least 1 character' },
        });
        return;
      }

      const result = await this.searchService.search({
        query: q,
        sources,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: result.customers,
        meta: {
          total: result.total,
          limit,
          offset,
          sources: result.sources,
        },
      });
    } catch (error) {
      this.logger.error('Customer search error', error);
      res.status(500).json({
        success: false,
        error: { code: 'SEARCH_FAILED', message: 'Failed to search customers' },
      });
    }
  }

  /**
   * Get a single customer by source and ID.
   * GET /customers/:source/:id
   */
  private async getById(req: Request, res: Response): Promise<void> {
    try {
      const { source, id } = req.params;

      if (!['erp', 'b2b', 'smartbill'].includes(source)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_SOURCE', message: 'Source must be erp, b2b, or smartbill' },
        });
        return;
      }

      const customer = await this.searchService.getById(source as CustomerSource, id);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
        });
        return;
      }

      res.json({ success: true, data: customer });
    } catch (error) {
      this.logger.error('Get customer error', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_FAILED', message: 'Failed to get customer' },
      });
    }
  }

  /**
   * List all customers (backward compatible).
   * GET /customers?limit=100&search=...
   *
   * This provides backward compatibility with the existing CreateQuoteForm
   * which calls GET /customers?limit=100 and expects an array of customer objects.
   */
  private async listAll(req: Request, res: Response): Promise<void> {
    try {
      const searchQuery = (req.query.search as string) || '';
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 200);

      // If no search query, return most recent customers from ERP
      if (!searchQuery) {
        const rows = await this.searchService['dataSource'].query(
          `SELECT id, company_name AS "firstName", '' AS "lastName",
                  email, phone_number AS phone,
                  company_name AS company
           FROM customers
           WHERE deleted_at IS NULL AND status = 'ACTIVE'
           ORDER BY updated_at DESC
           LIMIT $1`,
          [limit],
        );

        res.json({ success: true, data: rows });
        return;
      }

      // With search query, use unified search
      const result = await this.searchService.search({
        query: searchQuery,
        sources: ['erp', 'b2b'],
        limit,
      });

      // Map to backward-compatible format
      const mapped = result.customers.map((c) => ({
        id: c.sourceId,
        firstName: c.displayName,
        lastName: '',
        email: c.email,
        phone: c.phone || '',
        company: c.companyName || '',
        source: c.source,
      }));

      res.json({ success: true, data: mapped });
    } catch (error) {
      this.logger.error('List customers error', error);
      res.status(500).json({
        success: false,
        error: { code: 'LIST_FAILED', message: 'Failed to list customers' },
      });
    }
  }

  /**
   * Get full 360-degree customer profile.
   * GET /customers/:source/:id/360
   */
  private async getCustomer360(req: Request, res: Response): Promise<void> {
    try {
      const { source, id } = req.params;

      if (!['erp', 'b2b'].includes(source)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_SOURCE', message: 'Source must be erp or b2b' },
        });
        return;
      }

      if (!this.customer360Service) {
        res.status(501).json({
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Customer 360 service not configured' },
        });
        return;
      }

      const parsedId = parseInt(id, 10);
      if (isNaN(parsedId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'ID must be a number' },
        });
        return;
      }

      const profile = await this.customer360Service.getProfile(source as 'erp' | 'b2b', parsedId);
      res.json({ success: true, data: profile });
    } catch (error: any) {
      if (error?.message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }
      this.logger.error('Customer 360 error', error);
      res.status(500).json({
        success: false,
        error: { code: 'PROFILE_FAILED', message: 'Failed to build customer profile' },
      });
    }
  }

  /**
   * Get top customers by revenue.
   * GET /customers/top-customers?limit=20
   */
  private async getTopCustomers(req: Request, res: Response): Promise<void> {
    try {
      if (!this.customer360Service) {
        res.status(501).json({
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Customer 360 service not configured' },
        });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const customers = await this.customer360Service.getTopCustomers(limit);
      res.json({ success: true, data: customers, meta: { limit } });
    } catch (error) {
      this.logger.error('Top customers error', error);
      res.status(500).json({
        success: false,
        error: { code: 'TOP_CUSTOMERS_FAILED', message: 'Failed to get top customers' },
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
