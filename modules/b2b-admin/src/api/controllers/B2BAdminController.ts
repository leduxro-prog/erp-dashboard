import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { requireRole } from '../../../../../shared/middleware/auth.middleware';

export class B2BAdminController {
  private router: Router;

  constructor(private dataSource: DataSource) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // GET routes allowed for admin, manager, and sales
    this.router.get(
      '/customers',
      requireRole(['admin', 'manager', 'sales']),
      this.listCustomers.bind(this),
    );
    this.router.get(
      '/customers/search',
      requireRole(['admin', 'manager', 'sales']),
      this.searchCustomers.bind(this),
    );
    this.router.get(
      '/customers/:id',
      requireRole(['admin', 'manager', 'sales']),
      this.getCustomer.bind(this),
    );
    this.router.get(
      '/analytics/top-customers',
      requireRole(['admin', 'manager', 'sales']),
      this.getTopCustomers.bind(this),
    );
    this.router.get(
      '/registrations',
      requireRole(['admin', 'manager', 'sales']),
      this.listRegistrations.bind(this),
    );

    // Modification routes restricted to admin and manager only
    this.router.patch(
      '/customers/:id/credit',
      requireRole(['admin', 'manager']),
      this.adjustCredit.bind(this),
    );
    this.router.post(
      '/registrations/:id/approve',
      requireRole(['admin', 'manager']),
      this.approveRegistration.bind(this),
    );
    this.router.post(
      '/registrations/:id/reject',
      requireRole(['admin', 'manager']),
      this.rejectRegistration.bind(this),
    );
  }

  private async searchCustomers(req: Request, res: Response): Promise<void> {
    try {
      const { q, sources = 'b2b,erp' } = req.query;
      const queryStr = String(q || '');
      const sourceList = String(sources).split(',');

      let unifiedResults: any[] = [];

      if (sourceList.includes('b2b') || sourceList.includes('erp')) {
        const b2bCustomers = await this.dataSource.query(
          `SELECT id, company_name, email, cui, phone, tier, discount_percentage, 
                  credit_limit, credit_used, 'b2b' as source
           FROM b2b_customers
           WHERE company_name ILIKE $1 OR email ILIKE $1 OR cui ILIKE $1
           LIMIT 50`,
          [`%${queryStr}%`],
        );

        unifiedResults = b2bCustomers.map((c: any) => ({
          id: String(c.id),
          display_name: c.company_name,
          company_name: c.company_name,
          cui: c.cui,
          email: c.email,
          phone: c.phone,
          source: c.source,
          credit_limit: parseFloat(c.credit_limit),
          credit_used: parseFloat(c.credit_used),
          discount_percentage: parseFloat(c.discount_percentage),
          tier: c.tier,
        }));
      }

      // TODO: Add SmartBill search logic here when WS3 is ready
      // if (sourceList.includes('smartbill')) { ... }

      res.json({ customers: unifiedResults });
    } catch (error) {
      console.error('Search customers error:', error);
      res.status(500).json({ error: 'Failed to search customers' });
    }
  }

  private async listCustomers(req: Request, res: Response): Promise<void> {
    try {
      const { tier, search, status } = req.query;

      let query = `
        SELECT id, company_name, email, cui, tier, credit_limit, credit_used,
               discount_percentage, status, total_orders, total_spent, created_at
        FROM b2b_customers
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (tier) {
        query += ` AND tier = $${paramIndex++}`;
        params.push(tier);
      }

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      if (search) {
        query += ` AND (company_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR cui ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT 100`;

      const customers = await this.dataSource.query(query, params);

      res.json({ customers, total: customers.length });
    } catch (error) {
      console.error('List customers error:', error);
      res.status(500).json({ error: 'Failed to list customers' });
    }
  }

  private async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const customerResult = await this.dataSource.query(
        `SELECT * FROM b2b_customers WHERE id = $1`,
        [id],
      );

      if (!customerResult || customerResult.length === 0) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      const customer = customerResult[0];

      // Get last 10 orders
      const orders = await this.dataSource.query(
        `SELECT * FROM b2b_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [id],
      );

      // Get last 10 quotes (using email match since quotations table might not have customer_id foreign key yet)
      const quotations = await this.dataSource.query(
        `SELECT id, quote_number, status, total_amount, created_at 
         FROM quotations 
         WHERE customer_email = $1 
         ORDER BY created_at DESC LIMIT 10`,
        [customer.email],
      );

      // Get credit history
      const creditHistory = await this.dataSource.query(
        `SELECT h.*, u.first_name || ' ' || u.last_name as admin_name
         FROM b2b_credit_history h
         LEFT JOIN users u ON h.created_by = u.id
         WHERE h.customer_id = $1
         ORDER BY h.created_at DESC LIMIT 10`,
        [id],
      );

      // Get favorites
      const favorites = await this.dataSource.query(
        `SELECT f.id, f.product_id, p.name, p.sku, p.base_price
         FROM b2b_favorites f
         JOIN products p ON f.product_id = p.id
         WHERE f.customer_id = $1`,
        [id],
      );

      // Invoice Summary (from b2b_orders where payment_status is not PAID)
      const invoiceSummary = await this.dataSource.query(
        `SELECT 
            COUNT(*) as unpaid_count,
            COALESCE(SUM(COALESCE(total_amount, total, 0)), 0) as total_unpaid,
            COALESCE(SUM(CASE WHEN payment_due_date < CURRENT_DATE THEN COALESCE(total_amount, total, 0) ELSE 0 END), 0) as total_overdue
         FROM b2b_orders 
         WHERE customer_id = $1 AND payment_status != 'PAID' AND status != 'CANCELLED'`,
        [id],
      );

      // Unpaid invoices list (based on B2B orders payment state)
      let unpaidInvoices: any[] = [];
      try {
        unpaidInvoices = await this.dataSource.query(
          `SELECT 
              id,
              order_number,
              COALESCE(total_amount, total, 0) as total_amount,
              COALESCE(currency_code, 'RON') as currency_code,
              payment_status,
              payment_due_date,
              created_at,
              CASE
                WHEN payment_due_date IS NULL THEN 0
                WHEN payment_due_date < CURRENT_DATE THEN (CURRENT_DATE - payment_due_date)
                ELSE 0
              END as days_overdue
           FROM b2b_orders
           WHERE customer_id = $1
             AND COALESCE(payment_status, 'UNPAID') != 'PAID'
             AND status != 'CANCELLED'
           ORDER BY payment_due_date ASC NULLS LAST, created_at DESC
           LIMIT 20`,
          [id],
        );
      } catch (invoiceError) {
        console.warn('Could not load unpaid invoices for customer detail', invoiceError);
      }

      // Recommended products: top purchased products for this customer, excluding favorites.
      // Fallback behavior: if customer has no purchase history, returns globally popular active products.
      let recommendedProducts: any[] = [];
      try {
        recommendedProducts = await this.dataSource.query(
          `SELECT
              p.id,
              p.name,
              p.sku,
              p.base_price,
              COALESCE(stats.purchase_count, 0) as purchase_count
           FROM products p
           LEFT JOIN (
             SELECT
               oi.product_id,
               COUNT(*) as purchase_count
             FROM b2b_order_items oi
             JOIN b2b_orders o ON o.id = oi.order_id
             WHERE o.customer_id = $1
             GROUP BY oi.product_id
           ) stats ON stats.product_id = p.id
           LEFT JOIN b2b_favorites f ON f.product_id = p.id AND f.customer_id = $1
           WHERE p.is_active = true
             AND f.id IS NULL
           ORDER BY COALESCE(stats.purchase_count, 0) DESC, p.updated_at DESC
           LIMIT 10`,
          [id],
        );
      } catch (recommendationError) {
        console.warn(
          'Could not load recommended products for customer detail',
          recommendationError,
        );
      }

      res.json({
        customer,
        orders,
        quotations,
        creditHistory,
        favorites,
        recommendedProducts,
        unpaidInvoices,
        financialSummary: invoiceSummary[0],
      });
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({ error: 'Failed to get customer' });
    }
  }

  private async getTopCustomers(req: Request, res: Response): Promise<void> {
    try {
      const metric = String(req.query.metric || 'revenue').toLowerCase();
      const days = Math.min(Math.max(parseInt(String(req.query.days || '30'), 10) || 30, 1), 365);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '5'), 10) || 5, 1), 20);

      const rows = await this.dataSource.query(
        `WITH orders_filtered AS (
           SELECT
             o.id,
             o.customer_id,
             (COALESCE(o.subtotal, 0) - COALESCE(o.discount_amount, 0) + COALESCE(o.shipping_cost, 0)) AS revenue_ex_vat
           FROM b2b_orders o
           WHERE o.created_at >= NOW() - ($1::text || ' days')::interval
             AND o.status NOT IN ('CANCELLED', 'DRAFT')
         ),
         order_item_costs AS (
           SELECT
             oi.order_id,
             SUM(
               oi.quantity * COALESCE(
                 CASE
                   WHEN COALESCE(p.metadata->>'cost', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                     THEN (p.metadata->>'cost')::numeric
                   ELSE NULL
                 END,
                 p.base_price * 0.7
               )
             ) AS estimated_cost_from_items
           FROM b2b_order_items oi
           JOIN products p ON p.id = oi.product_id
           GROUP BY oi.order_id
         ),
         global_cost_ratio AS (
           SELECT
             COALESCE(
               AVG(
                 CASE
                   WHEN p.base_price > 0
                     AND COALESCE(p.metadata->>'cost', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                     THEN ((p.metadata->>'cost')::numeric / p.base_price)
                   ELSE NULL
                 END
               ),
               0.7
             ) AS ratio
           FROM products p
           WHERE p.is_active = true
         ),
         order_profit AS (
           SELECT
             ofi.customer_id,
             ofi.id AS order_id,
             ofi.revenue_ex_vat,
             COALESCE(oic.estimated_cost_from_items, ofi.revenue_ex_vat * gcr.ratio) AS estimated_cost,
             ofi.revenue_ex_vat - COALESCE(oic.estimated_cost_from_items, ofi.revenue_ex_vat * gcr.ratio) AS estimated_profit,
             CASE WHEN oic.estimated_cost_from_items IS NULL THEN false ELSE true END AS uses_item_cost
           FROM orders_filtered ofi
           LEFT JOIN order_item_costs oic ON oic.order_id = ofi.id
           CROSS JOIN global_cost_ratio gcr
         ),
         unpaid AS (
           SELECT
             customer_id,
             COALESCE(SUM(COALESCE(total_amount, total, 0)), 0) AS unpaid_total
           FROM b2b_orders
           WHERE COALESCE(payment_status, 'UNPAID') != 'PAID'
             AND status != 'CANCELLED'
           GROUP BY customer_id
         )
         SELECT
           c.id,
           c.company_name,
           c.email,
           c.tier,
           c.discount_percentage,
           c.credit_limit,
           c.credit_used,
           COALESCE(SUM(op.revenue_ex_vat), 0) AS revenue,
           COALESCE(SUM(op.estimated_cost), 0) AS estimated_cost,
           COALESCE(SUM(op.estimated_profit), 0) AS estimated_profit,
           CASE
             WHEN COALESCE(SUM(op.revenue_ex_vat), 0) > 0
               THEN (COALESCE(SUM(op.estimated_profit), 0) / COALESCE(SUM(op.revenue_ex_vat), 0)) * 100
             ELSE 0
           END AS estimated_margin_pct,
           COUNT(op.order_id) AS orders_count,
           COALESCE(MAX(u.unpaid_total), 0) AS unpaid_total,
           COALESCE(SUM(CASE WHEN op.uses_item_cost THEN 1 ELSE 0 END), 0) AS orders_with_item_cost
         FROM b2b_customers c
         LEFT JOIN order_profit op ON op.customer_id = c.id
         LEFT JOIN unpaid u ON u.customer_id = c.id
         GROUP BY c.id, c.company_name, c.email, c.tier, c.discount_percentage, c.credit_limit, c.credit_used`,
        [days],
      );

      const data = rows.map((row: any) => {
        const revenue = Number(row.revenue || 0);
        const estimatedCost = Number(row.estimated_cost || 0);
        const estimatedProfit = Number(row.estimated_profit || 0);
        const estimatedMarginPct = Number(row.estimated_margin_pct || 0);
        const unpaidTotal = Number(row.unpaid_total || 0);
        const creditUsed = Number(row.credit_used || 0);
        const ordersCount = Number(row.orders_count || 0);
        const ordersWithItemCost = Number(row.orders_with_item_cost || 0);

        return {
          id: Number(row.id),
          company_name: row.company_name,
          email: row.email,
          tier: row.tier,
          discount_percentage: Number(row.discount_percentage || 0),
          credit_limit: Number(row.credit_limit || 0),
          credit_used: creditUsed,
          revenue,
          estimated_cost: estimatedCost,
          estimated_profit: estimatedProfit,
          estimated_margin_pct: estimatedMarginPct,
          unpaid_total: unpaidTotal,
          orders_count: ordersCount,
          orders_with_item_cost: ordersWithItemCost,
          profitability_method:
            ordersCount > 0 && ordersWithItemCost === ordersCount
              ? 'item_cost'
              : 'estimated_fallback_global_ratio',
        };
      });

      const sorters: Record<string, (a: any, b: any) => number> = {
        revenue: (a, b) => b.revenue - a.revenue,
        profit: (a, b) => b.estimated_profit - a.estimated_profit,
        margin: (a, b) => b.estimated_margin_pct - a.estimated_margin_pct,
        unpaid: (a, b) => b.unpaid_total - a.unpaid_total,
        credit_used: (a, b) => b.credit_used - a.credit_used,
      };

      const sorter = sorters[metric] || sorters.revenue;
      const top = data.sort(sorter).slice(0, limit);

      res.json({
        topCustomers: top,
        meta: {
          metric,
          days,
          limit,
          note: 'Profitability uses product metadata.cost when available; otherwise fallback uses adaptive global cost ratio from synced product costs.',
        },
      });
    } catch (error) {
      console.error('Top customers analytics error:', error);
      res.status(500).json({ error: 'Failed to load top customers analytics' });
    }
  }

  private async adjustCredit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { credit_limit, reason } = req.body;
      const parsedCreditLimit = Number(credit_limit);
      const reasonText = String(reason || '').trim();

      if (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0 || !reasonText) {
        res.status(400).json({ error: 'credit_limit and reason are required' });
        return;
      }

      // Get current limit for history
      const currentResult = await this.dataSource.query(
        `SELECT credit_limit FROM b2b_customers WHERE id = $1`,
        [id],
      );
      const previousLimit = Number(currentResult[0]?.credit_limit || 0);

      await this.dataSource.query(
        `UPDATE b2b_customers SET credit_limit = $1, updated_at = NOW() WHERE id = $2`,
        [parsedCreditLimit, id],
      );

      // Audit logging (best effort - should not block the business action)
      const adminId = this.getActorUserId(req);
      await this.safeInsertAuditLog({
        action: 'ADJUST_CREDIT',
        entityType: 'B2B_CUSTOMER',
        entityId: id,
        userId: adminId,
        oldValues: { credit_limit: previousLimit, reason: reasonText },
        newValues: { credit_limit: parsedCreditLimit },
        metadata: { ip: req.ip },
      });

      // 2. Business Credit History
      await this.dataSource.query(
        `INSERT INTO b2b_credit_history (customer_id, previous_limit, new_limit, change_amount, reason, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          id,
          previousLimit,
          parsedCreditLimit,
          parsedCreditLimit - previousLimit,
          reasonText,
          adminId,
        ],
      );

      console.log(
        `Credit adjusted for customer ${id}: ${parsedCreditLimit} RON. Reason: ${reasonText}`,
      );

      res.json({ message: 'Credit limit updated successfully' });
    } catch (error) {
      console.error('Adjust credit error:', error);
      res.status(500).json({ error: 'Failed to adjust credit' });
    }
  }

  private async listRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;

      let query = `
        SELECT id, company_name, cui, email, contact_person, status, created_at
        FROM b2b_registrations
        WHERE 1=1
      `;

      const params: any[] = [];
      if (status) {
        query += ` AND status = $1`;
        params.push(status);
      } else {
        query += ` AND status = 'PENDING'`;
      }

      query += ` ORDER BY created_at DESC LIMIT 100`;

      const registrations = await this.dataSource.query(query, params);

      res.json({ registrations, total: registrations.length });
    } catch (error) {
      console.error('List registrations error:', error);
      res.status(500).json({ error: 'Failed to list registrations' });
    }
  }

  private async approveRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { credit_limit = 50000, tier = 'STANDARD' } = req.body;

      // Get registration
      const registration = await this.dataSource.query(
        `SELECT * FROM b2b_registrations WHERE id = $1`,
        [id],
      );

      if (!registration || registration.length === 0) {
        res.status(404).json({ error: 'Registration not found' });
        return;
      }

      const reg = registration[0];

      // Create customer
      const customerResult = await this.dataSource.query(
        `INSERT INTO b2b_customers
         (company_name, cui, email, contact_person, phone, tier, credit_limit, status, registration_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, NOW(), NOW())
         RETURNING id`,
        [
          reg.company_name,
          reg.cui,
          reg.email,
          reg.contact_person,
          reg.phone,
          tier,
          credit_limit,
          id,
        ],
      );

      const customerId = customerResult[0].id;

      // Create auth credentials with temporary password
      const tempPassword = Math.random().toString(36).slice(-10);
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await this.dataSource.query(
        `INSERT INTO b2b_auth_credentials (customer_id, email, password_hash, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
        [customerId, reg.email, passwordHash],
      );

      // Update registration status
      await this.dataSource.query(
        `UPDATE b2b_registrations SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [id],
      );

      // Audit logging
      const adminId = this.getActorUserId(req);
      await this.safeInsertAuditLog({
        action: 'APPROVE_B2B_REGISTRATION',
        entityType: 'B2B_REGISTRATION',
        entityId: id,
        userId: adminId,
        newValues: { customer_id: customerId, tier, credit_limit },
        metadata: { ip: req.ip },
      });

      // TODO: Send email with credentials

      res.json({
        message: 'Registration approved',
        customer_id: customerId,
        temporary_password: tempPassword,
      });
    } catch (error) {
      console.error('Approve registration error:', error);
      res.status(500).json({ error: 'Failed to approve registration' });
    }
  }

  private async rejectRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const reasonText = String(reason || '').trim();

      if (!reasonText) {
        res.status(400).json({ error: 'reason is required' });
        return;
      }

      await this.dataSource.query(
        `UPDATE b2b_registrations
         SET status = 'REJECTED', updated_at = NOW()
         WHERE id = $1`,
        [id],
      );

      const adminId = this.getActorUserId(req);
      await this.safeInsertAuditLog({
        action: 'REJECT_B2B_REGISTRATION',
        entityType: 'B2B_REGISTRATION',
        entityId: id,
        userId: adminId,
        newValues: { status: 'REJECTED', reason: reasonText },
        metadata: { ip: req.ip },
      });

      // TODO: Send rejection email

      res.json({ message: 'Registration rejected' });
    } catch (error) {
      console.error('Reject registration error:', error);
      res.status(500).json({ error: 'Failed to reject registration' });
    }
  }

  private getActorUserId(req: Request): number | null {
    const rawUserId = (req as any).user?.id;
    if (rawUserId === undefined || rawUserId === null) {
      return null;
    }

    const parsed = Number(rawUserId);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async safeInsertAuditLog(input: {
    action: string;
    entityType: string;
    entityId: string | number;
    userId: number | null;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, old_values, new_values, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          input.action,
          input.entityType,
          String(input.entityId),
          input.userId,
          input.oldValues ? JSON.stringify(input.oldValues) : null,
          input.newValues ? JSON.stringify(input.newValues) : null,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      );
    } catch (error) {
      console.warn('Failed to insert audit log entry', {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error,
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
