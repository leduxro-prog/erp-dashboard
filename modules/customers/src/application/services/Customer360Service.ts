/**
 * Customer360Service
 *
 * Builds a comprehensive 360-degree customer profile by aggregating data
 * from ERP, B2B, and SmartBill sources. Uses raw SQL via DataSource.
 */

import { createModuleLogger } from '@shared/utils/logger';
import { DataSource } from 'typeorm';

const logger = createModuleLogger('Customer360Service');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Customer360Profile {
  // Identity
  id: number;
  source: 'erp' | 'b2b';
  companyName: string;
  cui: string | null;
  email: string;
  phone: string | null;
  status: string;

  // Linked sources
  linkedSources: {
    erp: { id: number; status: string } | null;
    b2b: { id: number; tier: string; status: string } | null;
    smartbill: { externalId: string; lastSyncAt: string } | null;
  };

  // Financial summary
  financials: {
    creditLimit: number;
    creditUsed: number;
    creditAvailable: number;
    tier: string | null;
    discountPercentage: number;
    paymentTermsDays: number;
  };

  // Order summary
  orderSummary: {
    totalOrders: number;
    totalSpent: number;
    avgOrderValue: number;
    lastOrderDate: string | null;
    ordersByStatus: Record<string, number>;
  };

  // Recent activity timeline (last 20 items)
  timeline: Array<{
    type: 'order' | 'quote' | 'proforma' | 'invoice' | 'payment' | 'registration';
    date: string;
    description: string;
    amount: number | null;
    status: string;
    referenceId: string;
    source: 'erp' | 'b2b' | 'smartbill';
  }>;

  // Profitability (if cost_price_snapshot available)
  profitability: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    grossMarginPercent: number;
    avgMarginPerOrder: number;
  } | null;

  // Risk indicators
  riskIndicators: {
    creditUtilization: number;
    overdueInvoices: number;
    avgPaymentDays: number | null;
    isHighRisk: boolean;
    riskReasons: string[];
  };
}

export interface TopCustomerRow {
  id: number;
  source: string;
  companyName: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string;
  grossMargin: number | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class Customer360Service {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Build a full 360-degree profile for a customer.
   */
  async getProfile(source: 'erp' | 'b2b', id: number): Promise<Customer360Profile> {
    // 1. Fetch base customer data
    const base = await this.fetchBaseCustomer(source, id);
    if (!base) {
      throw new Error(`Customer not found: ${source}/${id}`);
    }

    // 2. Cross-reference to find linked records
    const linkedSources = await this.findLinkedSources(source, id, base.cui, base.email);

    // 3. Fetch financial info (including tier)
    const financials = await this.buildFinancials(source, id, base, linkedSources);

    // 4. Aggregate orders from both sources
    const orderSummary = await this.buildOrderSummary(source, id, linkedSources);

    // 5. Build activity timeline
    const timeline = await this.buildTimeline(source, id, linkedSources);

    // 6. Calculate profitability
    const profitability = await this.buildProfitability(source, id, linkedSources);

    // 7. Calculate risk indicators
    const riskIndicators = await this.buildRiskIndicators(financials, linkedSources, orderSummary);

    return {
      id,
      source,
      companyName: base.companyName,
      cui: base.cui,
      email: base.email,
      phone: base.phone,
      status: base.status,
      linkedSources,
      financials,
      orderSummary,
      timeline,
      profitability,
      riskIndicators,
    };
  }

  /**
   * Return top customers by total revenue across ERP and B2B.
   */
  async getTopCustomers(limit = 20): Promise<TopCustomerRow[]> {
    try {
      const rows = await this.dataSource.query(
        `WITH erp_totals AS (
           SELECT
             c.id,
             'erp' AS source,
             c.company_name,
             COALESCE(SUM(o.total_amount), 0) AS total_spent,
             COUNT(o.id) AS order_count,
             MAX(o.order_date::text) AS last_order_date,
             CASE
               WHEN SUM(CASE WHEN oi.cost_price_snapshot IS NOT NULL THEN 1 ELSE 0 END) > 0
               THEN ROUND(
                 (1 - SUM(oi.quantity * COALESCE(oi.cost_price_snapshot, 0))
                      / NULLIF(SUM(oi.quantity * oi.unit_price), 0)
                 ) * 100, 2
               )
               ELSE NULL
             END AS gross_margin
           FROM customers c
           LEFT JOIN orders o ON o.customer_id = c.id AND o.deleted_at IS NULL
           LEFT JOIN order_items oi ON oi.order_id = o.id
           WHERE c.deleted_at IS NULL
           GROUP BY c.id
         ),
         b2b_totals AS (
           SELECT
             bc.id,
             'b2b' AS source,
             bc.company_name,
             COALESCE(SUM(bo.total), 0) AS total_spent,
             COUNT(bo.id) AS order_count,
             MAX(bo.created_at::text) AS last_order_date,
             CASE
               WHEN SUM(CASE WHEN bi.cost_price_snapshot IS NOT NULL THEN 1 ELSE 0 END) > 0
               THEN ROUND(
                 (1 - SUM(bi.quantity * COALESCE(bi.cost_price_snapshot, 0))
                      / NULLIF(SUM(bi.quantity * bi.unit_price), 0)
                 ) * 100, 2
               )
               ELSE NULL
             END AS gross_margin
           FROM b2b_customers bc
           LEFT JOIN b2b_orders bo ON bo.customer_id = bc.id
           LEFT JOIN b2b_order_items bi ON bi.order_id = bo.id
           WHERE bc.status = 'ACTIVE'
           GROUP BY bc.id
         ),
         combined AS (
           SELECT * FROM erp_totals
           UNION ALL
           SELECT * FROM b2b_totals
         )
         SELECT * FROM combined
         WHERE total_spent > 0
         ORDER BY total_spent DESC
         LIMIT $1`,
        [limit],
      );

      return rows.map((r: any) => ({
        id: parseInt(r.id, 10),
        source: r.source,
        companyName: r.company_name,
        totalSpent: parseFloat(r.total_spent) || 0,
        orderCount: parseInt(r.order_count, 10) || 0,
        lastOrderDate: r.last_order_date || '',
        grossMargin: r.gross_margin != null ? parseFloat(r.gross_margin) : null,
      }));
    } catch (err) {
      logger.error('Failed to fetch top customers', err);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchBaseCustomer(
    source: 'erp' | 'b2b',
    id: number,
  ): Promise<{
    companyName: string;
    cui: string | null;
    email: string;
    phone: string | null;
    status: string;
  } | null> {
    if (source === 'erp') {
      const rows = await this.dataSource.query(
        `SELECT company_name, tax_identification_number AS cui, email, phone_number, status
         FROM customers
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        companyName: r.company_name,
        cui: r.cui || null,
        email: r.email,
        phone: r.phone_number || null,
        status: r.status || 'ACTIVE',
      };
    }

    // source === 'b2b'
    const rows = await this.dataSource.query(
      `SELECT company_name, cui, email, phone, status
       FROM b2b_customers
       WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      companyName: r.company_name,
      cui: r.cui || null,
      email: r.email,
      phone: r.phone || null,
      status: r.status || 'ACTIVE',
    };
  }

  private async findLinkedSources(
    source: 'erp' | 'b2b',
    id: number,
    cui: string | null,
    email: string,
  ): Promise<Customer360Profile['linkedSources']> {
    const result: Customer360Profile['linkedSources'] = {
      erp: null,
      b2b: null,
      smartbill: null,
    };

    if (source === 'erp') {
      // The current record IS the ERP record
      const erpRows = await this.dataSource.query(
        `SELECT id, status FROM customers WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (erpRows.length > 0) {
        result.erp = { id: parseInt(erpRows[0].id, 10), status: erpRows[0].status };
      }

      // Find linked B2B by CUI or email
      const b2bRows = await this.dataSource.query(
        `SELECT id, tier, status FROM b2b_customers
         WHERE ($1::text IS NOT NULL AND cui = $1)
            OR email = $2
         LIMIT 1`,
        [cui, email],
      );
      if (b2bRows.length > 0) {
        result.b2b = {
          id: parseInt(b2bRows[0].id, 10),
          tier: b2bRows[0].tier,
          status: b2bRows[0].status,
        };
      }

      // Find SmartBill link
      result.smartbill = await this.findSmartBillLink(id);
    } else {
      // source === 'b2b' — the current record IS the B2B record
      const b2bRows = await this.dataSource.query(
        `SELECT id, tier, status FROM b2b_customers WHERE id = $1`,
        [id],
      );
      if (b2bRows.length > 0) {
        result.b2b = {
          id: parseInt(b2bRows[0].id, 10),
          tier: b2bRows[0].tier,
          status: b2bRows[0].status,
        };
      }

      // Find linked ERP by CUI or email
      const erpRows = await this.dataSource.query(
        `SELECT id, status FROM customers
         WHERE deleted_at IS NULL
           AND (($1::text IS NOT NULL AND tax_identification_number = $1)
                OR email = $2)
         LIMIT 1`,
        [cui, email],
      );
      if (erpRows.length > 0) {
        result.erp = { id: parseInt(erpRows[0].id, 10), status: erpRows[0].status };
        // Find SmartBill link via the ERP customer
        result.smartbill = await this.findSmartBillLink(parseInt(erpRows[0].id, 10));
      }
    }

    return result;
  }

  private async findSmartBillLink(
    erpCustomerId: number,
  ): Promise<{ externalId: string; lastSyncAt: string } | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT external_id, last_sync_at
         FROM customer_external_links
         WHERE customer_id = $1 AND provider = 'smartbill'
         ORDER BY last_sync_at DESC
         LIMIT 1`,
        [erpCustomerId],
      );
      if (rows.length === 0) return null;
      return {
        externalId: rows[0].external_id,
        lastSyncAt: rows[0].last_sync_at ? new Date(rows[0].last_sync_at).toISOString() : '',
      };
    } catch {
      // Table might not exist yet
      return null;
    }
  }

  private async buildFinancials(
    source: 'erp' | 'b2b',
    id: number,
    base: { cui: string | null; email: string },
    linked: Customer360Profile['linkedSources'],
  ): Promise<Customer360Profile['financials']> {
    let creditLimit = 0;
    let creditUsed = 0;
    let tier: string | null = null;
    let discountPercentage = 0;
    let paymentTermsDays = 30;

    if (source === 'erp') {
      const rows = await this.dataSource.query(
        `SELECT c.credit_limit, c.used_credit, c.payment_method,
                ct.name AS tier_name, ct.discount_percentage, ct.payment_terms_days
         FROM customers c
         LEFT JOIN customer_tiers ct ON ct.id = c.customer_tier_id
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [id],
      );
      if (rows.length > 0) {
        const r = rows[0];
        creditLimit = parseFloat(r.credit_limit) || 0;
        creditUsed = parseFloat(r.used_credit) || 0;
        tier = r.tier_name || null;
        discountPercentage = parseFloat(r.discount_percentage) || 0;
        paymentTermsDays = parseInt(r.payment_terms_days, 10) || 30;
      }
    } else {
      const rows = await this.dataSource.query(
        `SELECT credit_limit, credit_used, tier, discount_percentage, payment_terms_days
         FROM b2b_customers WHERE id = $1`,
        [id],
      );
      if (rows.length > 0) {
        const r = rows[0];
        creditLimit = parseFloat(r.credit_limit) || 0;
        creditUsed = parseFloat(r.credit_used) || 0;
        tier = r.tier || null;
        discountPercentage = parseFloat(r.discount_percentage) || 0;
        paymentTermsDays = parseInt(r.payment_terms_days, 10) || 0;
      }
    }

    // If there is a linked counterpart, pick the higher credit limit
    if (source === 'erp' && linked.b2b) {
      const b2bRows = await this.dataSource.query(
        `SELECT credit_limit, credit_used, discount_percentage, tier
         FROM b2b_customers WHERE id = $1`,
        [linked.b2b.id],
      );
      if (b2bRows.length > 0) {
        const b2bLimit = parseFloat(b2bRows[0].credit_limit) || 0;
        const b2bUsed = parseFloat(b2bRows[0].credit_used) || 0;
        if (b2bLimit > creditLimit) {
          creditLimit = b2bLimit;
          creditUsed = b2bUsed;
        }
        const b2bDiscount = parseFloat(b2bRows[0].discount_percentage) || 0;
        if (b2bDiscount > discountPercentage) {
          discountPercentage = b2bDiscount;
        }
        if (!tier) {
          tier = b2bRows[0].tier || null;
        }
      }
    } else if (source === 'b2b' && linked.erp) {
      const erpRows = await this.dataSource.query(
        `SELECT c.credit_limit, c.used_credit,
                ct.name AS tier_name, ct.discount_percentage, ct.payment_terms_days
         FROM customers c
         LEFT JOIN customer_tiers ct ON ct.id = c.customer_tier_id
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [linked.erp.id],
      );
      if (erpRows.length > 0) {
        const erpLimit = parseFloat(erpRows[0].credit_limit) || 0;
        const erpUsed = parseFloat(erpRows[0].used_credit) || 0;
        if (erpLimit > creditLimit) {
          creditLimit = erpLimit;
          creditUsed = erpUsed;
        }
        if (!tier) {
          tier = erpRows[0].tier_name || null;
        }
      }
    }

    return {
      creditLimit,
      creditUsed,
      creditAvailable: Math.max(creditLimit - creditUsed, 0),
      tier,
      discountPercentage,
      paymentTermsDays,
    };
  }

  private async buildOrderSummary(
    source: 'erp' | 'b2b',
    id: number,
    linked: Customer360Profile['linkedSources'],
  ): Promise<Customer360Profile['orderSummary']> {
    let totalOrders = 0;
    let totalSpent = 0;
    let lastOrderDate: string | null = null;
    const ordersByStatus: Record<string, number> = {};

    // ERP orders
    const erpCustomerId = source === 'erp' ? id : linked.erp?.id;
    if (erpCustomerId) {
      const rows = await this.dataSource.query(
        `SELECT status, COUNT(*)::int AS cnt, SUM(total_amount) AS total,
                MAX(order_date::text) AS last_date
         FROM orders
         WHERE customer_id = $1 AND deleted_at IS NULL
         GROUP BY status`,
        [erpCustomerId],
      );
      for (const r of rows) {
        const cnt = parseInt(r.cnt, 10) || 0;
        totalOrders += cnt;
        totalSpent += parseFloat(r.total) || 0;
        ordersByStatus[r.status] = (ordersByStatus[r.status] || 0) + cnt;
        if (r.last_date && (!lastOrderDate || r.last_date > lastOrderDate)) {
          lastOrderDate = r.last_date;
        }
      }
    }

    // B2B orders
    const b2bCustomerId = source === 'b2b' ? id : linked.b2b?.id;
    if (b2bCustomerId) {
      const rows = await this.dataSource.query(
        `SELECT status, COUNT(*)::int AS cnt, SUM(total) AS total,
                MAX(created_at::text) AS last_date
         FROM b2b_orders
         WHERE customer_id = $1
         GROUP BY status`,
        [b2bCustomerId],
      );
      for (const r of rows) {
        const cnt = parseInt(r.cnt, 10) || 0;
        totalOrders += cnt;
        totalSpent += parseFloat(r.total) || 0;
        const statusKey = `b2b_${r.status}`;
        ordersByStatus[statusKey] = (ordersByStatus[statusKey] || 0) + cnt;
        if (r.last_date && (!lastOrderDate || r.last_date > lastOrderDate)) {
          lastOrderDate = r.last_date;
        }
      }
    }

    return {
      totalOrders,
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgOrderValue: totalOrders > 0 ? Math.round((totalSpent / totalOrders) * 100) / 100 : 0,
      lastOrderDate,
      ordersByStatus,
    };
  }

  private async buildTimeline(
    source: 'erp' | 'b2b',
    id: number,
    linked: Customer360Profile['linkedSources'],
  ): Promise<Customer360Profile['timeline']> {
    const events: Customer360Profile['timeline'] = [];

    const erpCustomerId = source === 'erp' ? id : linked.erp?.id;
    const b2bCustomerId = source === 'b2b' ? id : linked.b2b?.id;

    // ERP orders
    if (erpCustomerId) {
      const erpOrders = await this.dataSource.query(
        `SELECT id, order_number, status, order_date, total_amount
         FROM orders
         WHERE customer_id = $1 AND deleted_at IS NULL
         ORDER BY order_date DESC
         LIMIT 20`,
        [erpCustomerId],
      );
      for (const o of erpOrders) {
        events.push({
          type: 'order',
          date: new Date(o.order_date).toISOString(),
          description: `ERP Order ${o.order_number}`,
          amount: parseFloat(o.total_amount) || null,
          status: o.status,
          referenceId: `erp-order-${o.id}`,
          source: 'erp',
        });
      }

      // Quotes
      const quotes = await this.dataSource.query(
        `SELECT id, quote_number, status, quote_date, total_amount
         FROM quotes
         WHERE customer_id = $1
         ORDER BY quote_date DESC
         LIMIT 10`,
        [erpCustomerId],
      );
      for (const q of quotes) {
        events.push({
          type: 'quote',
          date: new Date(q.quote_date).toISOString(),
          description: `Quote ${q.quote_number}`,
          amount: parseFloat(q.total_amount) || null,
          status: q.status,
          referenceId: `quote-${q.id}`,
          source: 'erp',
        });
      }

      // ERP proformas
      const erpProformas = await this.dataSource.query(
        `SELECT pi.id, pi.invoice_number, pi.issue_date, pi.total_amount
         FROM proforma_invoices pi
         JOIN orders o ON o.id = pi.order_id
         WHERE o.customer_id = $1 AND o.deleted_at IS NULL
         ORDER BY pi.issue_date DESC
         LIMIT 10`,
        [erpCustomerId],
      );
      for (const p of erpProformas) {
        events.push({
          type: 'proforma',
          date: new Date(p.issue_date).toISOString(),
          description: `Proforma ${p.invoice_number}`,
          amount: parseFloat(p.total_amount) || null,
          status: 'issued',
          referenceId: `proforma-${p.id}`,
          source: 'erp',
        });
      }

      // SmartBill invoices via ERP orders
      try {
        const sbInvoices = await this.dataSource.query(
          `SELECT si.id, si."invoiceNumber", si."issueDate", si."totalWithVat",
                  si.status, si."paidAmount", si."paymentDate", si."dueDate"
           FROM smartbill_invoices si
           JOIN orders o ON o.id::text = si."orderId"
           WHERE o.customer_id = $1 AND o.deleted_at IS NULL
           ORDER BY si."issueDate" DESC
           LIMIT 10`,
          [erpCustomerId],
        );
        for (const inv of sbInvoices) {
          events.push({
            type: 'invoice',
            date: new Date(inv.issueDate).toISOString(),
            description: `Invoice ${inv.invoiceNumber || 'draft'}`,
            amount: parseFloat(inv.totalWithVat) || null,
            status: inv.status,
            referenceId: `sb-invoice-${inv.id}`,
            source: 'smartbill',
          });

          // If paid, add a payment event
          if (inv.paymentDate && parseFloat(inv.paidAmount) > 0) {
            events.push({
              type: 'payment',
              date: new Date(inv.paymentDate).toISOString(),
              description: `Payment for Invoice ${inv.invoiceNumber || inv.id}`,
              amount: parseFloat(inv.paidAmount),
              status: 'paid',
              referenceId: `sb-payment-${inv.id}`,
              source: 'smartbill',
            });
          }
        }

        // SmartBill proformas via ERP orders
        const sbProformas = await this.dataSource.query(
          `SELECT sp.id, sp."proformaNumber", sp."issueDate", sp."totalWithVat", sp.status
           FROM smartbill_proformas sp
           JOIN orders o ON o.id::text = sp."orderId"
           WHERE o.customer_id = $1 AND o.deleted_at IS NULL
           ORDER BY sp."issueDate" DESC
           LIMIT 10`,
          [erpCustomerId],
        );
        for (const p of sbProformas) {
          events.push({
            type: 'proforma',
            date: new Date(p.issueDate).toISOString(),
            description: `SmartBill Proforma ${p.proformaNumber || 'draft'}`,
            amount: parseFloat(p.totalWithVat) || null,
            status: p.status,
            referenceId: `sb-proforma-${p.id}`,
            source: 'smartbill',
          });
        }
      } catch {
        // SmartBill tables may not exist
        logger.warn('SmartBill tables not available for timeline');
      }
    }

    // B2B orders
    if (b2bCustomerId) {
      const b2bOrders = await this.dataSource.query(
        `SELECT id, order_number, status, total, payment_status, created_at
         FROM b2b_orders
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [b2bCustomerId],
      );
      for (const o of b2bOrders) {
        events.push({
          type: 'order',
          date: new Date(o.created_at).toISOString(),
          description: `B2B Order ${o.order_number}`,
          amount: parseFloat(o.total) || null,
          status: o.status,
          referenceId: `b2b-order-${o.id}`,
          source: 'b2b',
        });
      }

      // B2B customer registration event
      const b2bReg = await this.dataSource.query(
        `SELECT created_at FROM b2b_customers WHERE id = $1`,
        [b2bCustomerId],
      );
      if (b2bReg.length > 0) {
        events.push({
          type: 'registration',
          date: new Date(b2bReg[0].created_at).toISOString(),
          description: 'B2B account created',
          amount: null,
          status: 'completed',
          referenceId: `b2b-reg-${b2bCustomerId}`,
          source: 'b2b',
        });
      }
    }

    // Sort by date DESC and take top 20
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events.slice(0, 20);
  }

  private async buildProfitability(
    source: 'erp' | 'b2b',
    id: number,
    linked: Customer360Profile['linkedSources'],
  ): Promise<Customer360Profile['profitability']> {
    let totalRevenue = 0;
    let totalCost = 0;
    let ordersWithCost = 0;
    let hasCostData = false;

    const erpCustomerId = source === 'erp' ? id : linked.erp?.id;
    const b2bCustomerId = source === 'b2b' ? id : linked.b2b?.id;

    // ERP order items with cost_price_snapshot
    if (erpCustomerId) {
      try {
        const rows = await this.dataSource.query(
          `SELECT
             SUM(oi.quantity * oi.unit_price) AS revenue,
             SUM(oi.quantity * oi.cost_price_snapshot) AS cost,
             COUNT(DISTINCT o.id)::int AS order_cnt
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.customer_id = $1
             AND o.deleted_at IS NULL
             AND oi.cost_price_snapshot IS NOT NULL`,
          [erpCustomerId],
        );
        if (rows.length > 0 && rows[0].revenue != null) {
          totalRevenue += parseFloat(rows[0].revenue) || 0;
          totalCost += parseFloat(rows[0].cost) || 0;
          ordersWithCost += parseInt(rows[0].order_cnt, 10) || 0;
          hasCostData = true;
        }
      } catch {
        // cost_price_snapshot column may not exist
      }
    }

    // B2B order items with cost_price_snapshot
    if (b2bCustomerId) {
      try {
        const rows = await this.dataSource.query(
          `SELECT
             SUM(bi.quantity * bi.unit_price) AS revenue,
             SUM(bi.quantity * bi.cost_price_snapshot) AS cost,
             COUNT(DISTINCT bo.id)::int AS order_cnt
           FROM b2b_order_items bi
           JOIN b2b_orders bo ON bo.id = bi.order_id
           WHERE bo.customer_id = $1
             AND bi.cost_price_snapshot IS NOT NULL`,
          [b2bCustomerId],
        );
        if (rows.length > 0 && rows[0].revenue != null) {
          totalRevenue += parseFloat(rows[0].revenue) || 0;
          totalCost += parseFloat(rows[0].cost) || 0;
          ordersWithCost += parseInt(rows[0].order_cnt, 10) || 0;
          hasCostData = true;
        }
      } catch {
        // cost_price_snapshot column may not exist
      }
    }

    if (!hasCostData || totalRevenue === 0) {
      return null;
    }

    const grossProfit = totalRevenue - totalCost;
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPercent:
        totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0,
      avgMarginPerOrder:
        ordersWithCost > 0 ? Math.round((grossProfit / ordersWithCost) * 100) / 100 : 0,
    };
  }

  private async buildRiskIndicators(
    financials: Customer360Profile['financials'],
    linked: Customer360Profile['linkedSources'],
    orderSummary: Customer360Profile['orderSummary'],
  ): Promise<Customer360Profile['riskIndicators']> {
    const riskReasons: string[] = [];

    // Credit utilization
    const creditUtilization =
      financials.creditLimit > 0
        ? Math.round((financials.creditUsed / financials.creditLimit) * 10000) / 100
        : 0;

    if (creditUtilization >= 90) {
      riskReasons.push('Credit utilization above 90%');
    } else if (creditUtilization >= 75) {
      riskReasons.push('Credit utilization above 75%');
    }

    // Overdue invoices & payment days
    let overdueInvoices = 0;
    let avgPaymentDays: number | null = null;

    if (linked.erp) {
      try {
        // Count overdue SmartBill invoices
        const overdueRows = await this.dataSource.query(
          `SELECT COUNT(*)::int AS cnt
           FROM smartbill_invoices si
           JOIN orders o ON o.id::text = si."orderId"
           WHERE o.customer_id = $1
             AND o.deleted_at IS NULL
             AND si.status NOT IN ('paid', 'cancelled')
             AND si."dueDate" < NOW()`,
          [linked.erp.id],
        );
        overdueInvoices = parseInt(overdueRows[0]?.cnt, 10) || 0;

        // Average payment days for paid invoices
        const payDaysRows = await this.dataSource.query(
          `SELECT AVG(
             EXTRACT(EPOCH FROM (si."paymentDate" - si."issueDate")) / 86400
           )::numeric(10,1) AS avg_days
           FROM smartbill_invoices si
           JOIN orders o ON o.id::text = si."orderId"
           WHERE o.customer_id = $1
             AND o.deleted_at IS NULL
             AND si.status = 'paid'
             AND si."paymentDate" IS NOT NULL`,
          [linked.erp.id],
        );
        if (payDaysRows.length > 0 && payDaysRows[0].avg_days != null) {
          avgPaymentDays = parseFloat(payDaysRows[0].avg_days);
        }
      } catch {
        // SmartBill tables may not exist
      }
    }

    if (overdueInvoices > 0) {
      riskReasons.push(`${overdueInvoices} overdue invoice(s)`);
    }

    if (avgPaymentDays != null && avgPaymentDays > financials.paymentTermsDays) {
      riskReasons.push(
        `Average payment (${avgPaymentDays.toFixed(0)}d) exceeds terms (${financials.paymentTermsDays}d)`,
      );
    }

    if (orderSummary.totalOrders === 0) {
      riskReasons.push('No order history');
    }

    const isHighRisk = creditUtilization >= 90 || overdueInvoices >= 3 || riskReasons.length >= 3;

    return {
      creditUtilization,
      overdueInvoices,
      avgPaymentDays,
      isHighRisk,
      riskReasons,
    };
  }
}
