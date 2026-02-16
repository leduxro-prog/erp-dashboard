/**
 * Quote Analytics Service
 * Provides comprehensive analytics and metrics for quotations
 */

import { DataSource } from 'typeorm';

export interface QuoteMetrics {
  totalQuotes: number;
  draftQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  expiredQuotes: number;
  convertedQuotes: number;

  totalValue: number;
  acceptedValue: number;
  conversionRate: number;
  averageQuoteValue: number;
  averageTimeToAccept: number; // in days

  periodComparison: {
    quotesChange: number; // percentage change vs previous period
    valueChange: number; // percentage change vs previous period
    conversionRateChange: number;
  };
}

export interface QuoteTrend {
  date: string;
  count: number;
  value: number;
  acceptedCount: number;
  acceptedValue: number;
}

export interface CustomerQuoteStats {
  customerId: string;
  customerName: string;
  totalQuotes: number;
  acceptedQuotes: number;
  totalValue: number;
  acceptedValue: number;
  conversionRate: number;
  lastQuoteDate: Date;
}

export interface ProductQuoteStats {
  productId: string;
  productName: string;
  sku: string;
  timesQuoted: number;
  totalQuantity: number;
  totalValue: number;
  conversionRate: number;
}

export class QuoteAnalyticsService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get overall quote metrics for a date range
   */
  async getQuoteMetrics(startDate: Date, endDate: Date): Promise<QuoteMetrics> {
    const query = `
      WITH current_period AS (
        SELECT
          COUNT(*) as total_quotes,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_quotes,
          SUM(CASE WHEN status = 'sent' OR status = 'viewed' THEN 1 ELSE 0 END) as sent_quotes,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotes,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_quotes,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_quotes,
          SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_quotes,
          SUM(total_amount) as total_value,
          SUM(CASE WHEN status IN ('accepted', 'converted') THEN total_amount ELSE 0 END) as accepted_value,
          AVG(total_amount) as average_quote_value,
          AVG(CASE
            WHEN status IN ('accepted', 'converted') AND accepted_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (accepted_at - created_at)) / 86400
            ELSE NULL
          END) as average_time_to_accept
        FROM quotations
        WHERE created_at >= $1 AND created_at <= $2
          AND deleted_at IS NULL
      ),
      previous_period AS (
        SELECT
          COUNT(*) as total_quotes,
          SUM(total_amount) as total_value,
          SUM(CASE WHEN status IN ('accepted', 'converted') THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) as conversion_rate
        FROM quotations
        WHERE created_at >= $3 AND created_at < $1
          AND deleted_at IS NULL
      )
      SELECT
        cp.*,
        pp.total_quotes as prev_total_quotes,
        pp.total_value as prev_total_value,
        pp.conversion_rate as prev_conversion_rate
      FROM current_period cp, previous_period pp
    `;

    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);

    const result = await this.dataSource.query(query, [
      startDate,
      endDate,
      previousStartDate,
    ]);

    const row = result[0] || {};

    const totalQuotes = parseInt(row.total_quotes) || 0;
    const acceptedQuotes = parseInt(row.accepted_quotes) || 0;
    const convertedQuotes = parseInt(row.converted_quotes) || 0;
    const conversionRate = totalQuotes > 0
      ? ((acceptedQuotes + convertedQuotes) / totalQuotes) * 100
      : 0;

    const prevTotalQuotes = parseInt(row.prev_total_quotes) || 0;
    const prevTotalValue = parseFloat(row.prev_total_value) || 0;
    const prevConversionRate = parseFloat(row.prev_conversion_rate) || 0;

    return {
      totalQuotes,
      draftQuotes: parseInt(row.draft_quotes) || 0,
      sentQuotes: parseInt(row.sent_quotes) || 0,
      acceptedQuotes,
      rejectedQuotes: parseInt(row.rejected_quotes) || 0,
      expiredQuotes: parseInt(row.expired_quotes) || 0,
      convertedQuotes,
      totalValue: parseFloat(row.total_value) || 0,
      acceptedValue: parseFloat(row.accepted_value) || 0,
      conversionRate,
      averageQuoteValue: parseFloat(row.average_quote_value) || 0,
      averageTimeToAccept: parseFloat(row.average_time_to_accept) || 0,
      periodComparison: {
        quotesChange: prevTotalQuotes > 0
          ? ((totalQuotes - prevTotalQuotes) / prevTotalQuotes) * 100
          : 0,
        valueChange: prevTotalValue > 0
          ? ((parseFloat(row.total_value) || 0) - prevTotalValue) / prevTotalValue * 100
          : 0,
        conversionRateChange: prevConversionRate > 0
          ? ((conversionRate - prevConversionRate * 100) / (prevConversionRate * 100)) * 100
          : 0,
      },
    };
  }

  /**
   * Get quote trends over time (daily/weekly/monthly)
   */
  async getQuoteTrends(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<QuoteTrend[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-IW'; // ISO week
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const query = `
      SELECT
        TO_CHAR(created_at, $3) as date,
        COUNT(*) as count,
        SUM(total_amount) as value,
        SUM(CASE WHEN status IN ('accepted', 'converted') THEN 1 ELSE 0 END) as accepted_count,
        SUM(CASE WHEN status IN ('accepted', 'converted') THEN total_amount ELSE 0 END) as accepted_value
      FROM quotations
      WHERE created_at >= $1 AND created_at <= $2
        AND deleted_at IS NULL
      GROUP BY TO_CHAR(created_at, $3)
      ORDER BY date ASC
    `;

    const results = await this.dataSource.query(query, [
      startDate,
      endDate,
      dateFormat,
    ]);

    return results.map((row: any) => ({
      date: row.date,
      count: parseInt(row.count),
      value: parseFloat(row.value),
      acceptedCount: parseInt(row.accepted_count),
      acceptedValue: parseFloat(row.accepted_value),
    }));
  }

  /**
   * Get top customers by quote value
   */
  async getTopCustomers(limit: number = 10): Promise<CustomerQuoteStats[]> {
    const query = `
      SELECT
        c.id as customer_id,
        c.name as customer_name,
        COUNT(q.id) as total_quotes,
        SUM(CASE WHEN q.status IN ('accepted', 'converted') THEN 1 ELSE 0 END) as accepted_quotes,
        SUM(q.total_amount) as total_value,
        SUM(CASE WHEN q.status IN ('accepted', 'converted') THEN q.total_amount ELSE 0 END) as accepted_value,
        MAX(q.created_at) as last_quote_date
      FROM customers c
      INNER JOIN quotations q ON q.customer_id = c.id
      WHERE q.deleted_at IS NULL
      GROUP BY c.id, c.name
      ORDER BY total_value DESC
      LIMIT $1
    `;

    const results = await this.dataSource.query(query, [limit]);

    return results.map((row: any) => {
      const totalQuotes = parseInt(row.total_quotes);
      const acceptedQuotes = parseInt(row.accepted_quotes);
      return {
        customerId: row.customer_id,
        customerName: row.customer_name,
        totalQuotes,
        acceptedQuotes,
        totalValue: parseFloat(row.total_value),
        acceptedValue: parseFloat(row.accepted_value),
        conversionRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
        lastQuoteDate: row.last_quote_date,
      };
    });
  }

  /**
   * Get top quoted products
   */
  async getTopProducts(limit: number = 10): Promise<ProductQuoteStats[]> {
    const query = `
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku,
        COUNT(DISTINCT qi.quotation_id) as times_quoted,
        SUM(qi.quantity) as total_quantity,
        SUM(qi.total_amount) as total_value,
        SUM(CASE WHEN q.status IN ('accepted', 'converted') THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(DISTINCT qi.quotation_id), 0) * 100 as conversion_rate
      FROM products p
      INNER JOIN quotation_items qi ON qi.product_id = p.id
      INNER JOIN quotations q ON q.id = qi.quotation_id
      WHERE q.deleted_at IS NULL
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_value DESC
      LIMIT $1
    `;

    const results = await this.dataSource.query(query, [limit]);

    return results.map((row: any) => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      timesQuoted: parseInt(row.times_quoted),
      totalQuantity: parseFloat(row.total_quantity),
      totalValue: parseFloat(row.total_value),
      conversionRate: parseFloat(row.conversion_rate) || 0,
    }));
  }

  /**
   * Get quotes expiring soon (within specified days)
   */
  async getExpiringQuotes(withinDays: number = 7): Promise<any[]> {
    const query = `
      SELECT
        q.id,
        q.quote_number,
        q.expiry_date,
        q.total_amount,
        q.currency_code,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        EXTRACT(EPOCH FROM (q.expiry_date - NOW())) / 86400 as days_until_expiry
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.status IN ('sent', 'viewed')
        AND q.expiry_date > NOW()
        AND q.expiry_date <= NOW() + INTERVAL '1 day' * $1
        AND q.deleted_at IS NULL
      ORDER BY q.expiry_date ASC
    `;

    return await this.dataSource.query(query, [withinDays]);
  }

  /**
   * Get quotes requiring follow-up (sent but no response)
   */
  async getQuotesNeedingFollowUp(daysWithoutResponse: number = 3): Promise<any[]> {
    const query = `
      SELECT
        q.id,
        q.quote_number,
        q.created_at,
        q.sent_at,
        q.total_amount,
        q.currency_code,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        EXTRACT(EPOCH FROM (NOW() - q.sent_at)) / 86400 as days_since_sent
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.status = 'sent'
        AND q.sent_at IS NOT NULL
        AND q.sent_at <= NOW() - INTERVAL '1 day' * $1
        AND q.expiry_date > NOW()
        AND q.deleted_at IS NULL
      ORDER BY q.sent_at ASC
    `;

    return await this.dataSource.query(query, [daysWithoutResponse]);
  }
}
