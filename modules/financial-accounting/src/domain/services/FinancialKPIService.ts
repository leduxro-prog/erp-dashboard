/**
 * Financial KPI Service
 * Extracts and calculates daily financial KPIs from the accounting data.
 *
 * Runs at end-of-day (23:59) to generate:
 * - Gross Revenue (sum of invoices in T-24h)
 * - Net Profit (Revenue - COGS - OpEx)
 * - Tax Liabilities (TVA collected + estimated corporate tax)
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';
import { DailyFinancialKPIs } from '../../application/dtos/DailyFinancialKPIs';

const logger = createModuleLogger('financial-kpi');

export interface FinancialKPIConfig {
  /** Default daily OpEx if not available live (€) */
  defaultOpExDaily: number;
  /** TVA rate as percentage (e.g., 19) */
  tvaRate: number;
  /** Tax rate type: 'micro' (1%) or 'standard' (16%) */
  taxRateType: 'micro' | 'standard';
}

export class FinancialKPIService {
  private config: FinancialKPIConfig;

  constructor(
    private dataSource: DataSource,
    config?: Partial<FinancialKPIConfig>,
  ) {
    this.config = {
      defaultOpExDaily:
        config?.defaultOpExDaily ?? parseFloat(process.env.DEFAULT_OPEX_DAILY || '150'),
      tvaRate: config?.tvaRate ?? parseFloat(process.env.TVA_RATE || '19'),
      taxRateType: (config?.taxRateType ?? process.env.TAX_RATE_TYPE ?? 'micro') as
        | 'micro'
        | 'standard',
    };
  }

  /**
   * Calculate all daily financial KPIs for a given date.
   * Queries invoices, calculates COGS from inventory costs, and estimates taxes.
   */
  async calculateDailyKPIs(date: Date = new Date()): Promise<DailyFinancialKPIs> {
    const dateStr = this.formatDate(date);
    logger.info(`Calculating daily KPIs for ${dateStr}`);

    try {
      // 1. Calculate Gross Revenue — sum of all invoices emitted in T-24h
      const grossRevenue = await this.getGrossRevenue(date);

      // 2. Calculate COGS — cost of goods from sold items
      const cogs = await this.getCOGS(date);

      // 3. Get OpEx — live if available, otherwise config fallback
      const opEx = await this.getOpEx(date);

      // 4. Calculate Net Profit
      const netProfit = Math.round((grossRevenue - cogs - opEx) * 100) / 100;

      // 5. Calculate Tax Liabilities
      const tvaCollected = Math.round(((grossRevenue * this.config.tvaRate) / 100) * 100) / 100;
      const taxRate = this.config.taxRateType === 'micro' ? 0.01 : 0.16;
      const estimatedTax = Math.round(grossRevenue * taxRate * 100) / 100;

      // 6. Get invoice count
      const invoiceCount = await this.getInvoiceCount(date);

      // 7. Validate completeness
      const isComplete =
        grossRevenue !== null && cogs !== null && !isNaN(grossRevenue) && !isNaN(cogs);

      const kpis: DailyFinancialKPIs = {
        date: dateStr,
        grossRevenue,
        cogs,
        opEx,
        netProfit,
        tvaCollected,
        estimatedTax,
        invoiceCount,
        isComplete,
        incompleteReason: isComplete
          ? undefined
          : 'Date financiare incomplete — verificați conexiunea API contabilitate.',
      };

      logger.info('Daily KPIs calculated successfully', {
        date: dateStr,
        grossRevenue,
        netProfit,
        invoiceCount,
        isComplete,
      });

      return kpis;
    } catch (error) {
      logger.error('Failed to calculate daily KPIs', {
        error: error instanceof Error ? error.message : String(error),
        date: dateStr,
      });

      return {
        date: dateStr,
        grossRevenue: 0,
        cogs: 0,
        opEx: this.config.defaultOpExDaily,
        netProfit: 0,
        tvaCollected: 0,
        estimatedTax: 0,
        invoiceCount: 0,
        isComplete: false,
        incompleteReason: `Eroare la extragerea datelor: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Sum of all invoices emitted in the last 24 hours.
   */
  private async getGrossRevenue(date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      // Query the invoices/journal_entries table for revenue in T-24h
      // Uses a flexible approach — tries invoice table first, falls back to journal entries
      const result = await this.dataSource.query(
        `
        SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
               COUNT(*) as invoice_count
        FROM invoices
        WHERE created_at >= $1 AND created_at <= $2
          AND status IN ('issued', 'paid', 'sent')
      `,
        [startOfDay.toISOString(), endOfDay.toISOString()],
      );

      return parseFloat(result[0]?.total_revenue || '0');
    } catch (error) {
      // Fallback: try journal entries for revenue accounts
      try {
        const result = await this.dataSource.query(
          `
          SELECT COALESCE(SUM(je.credit_amount), 0) as total_revenue
          FROM journal_entries je
          JOIN accounts a ON je.account_id = a.id
          WHERE je.entry_date >= $1 AND je.entry_date <= $2
            AND a.account_type = 'revenue'
        `,
          [startOfDay.toISOString(), endOfDay.toISOString()],
        );

        return parseFloat(result[0]?.total_revenue || '0');
      } catch {
        logger.warn('Could not query revenue from DB, returning 0');
        return 0;
      }
    }
  }

  /**
   * Cost of Goods Sold — cost price snapshot × quantity for all items sold today.
   * Uses the cost_price_snapshot column captured at time of sale.
   */
  private async getCOGS(date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const result = await this.dataSource.query(
        `
        SELECT COALESCE(SUM(oi.quantity * oi.cost_price_snapshot), 0) as cogs
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= $1 AND o.created_at <= $2
          AND o.status NOT IN ('cancelled', 'draft')
          AND oi.cost_price_snapshot IS NOT NULL
      `,
        [startOfDay.toISOString(), endOfDay.toISOString()],
      );

      return parseFloat(result[0]?.cogs || '0');
    } catch {
      logger.warn('Could not calculate COGS, returning 0');
      return 0;
    }
  }

  /**
   * Operational Expenses — live query or config fallback.
   */
  private async getOpEx(date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const result = await this.dataSource.query(
        `
        SELECT COALESCE(SUM(je.debit_amount), 0) as total_opex
        FROM journal_entries je
        JOIN accounts a ON je.account_id = a.id
        WHERE je.entry_date >= $1 AND je.entry_date <= $2
          AND a.account_type = 'expense'
      `,
        [startOfDay.toISOString(), endOfDay.toISOString()],
      );

      const liveOpEx = parseFloat(result[0]?.total_opex || '0');

      if (liveOpEx > 0) {
        return liveOpEx;
      }
    } catch {
      // Continue to fallback
    }

    // Fallback to configured daily OpEx
    logger.info(`Using default OpEx: ${this.config.defaultOpExDaily}€`);
    return this.config.defaultOpExDaily;
  }

  /**
   * Count of invoices issued today.
   */
  private async getInvoiceCount(date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const result = await this.dataSource.query(
        `
        SELECT COUNT(*) as count
        FROM invoices
        WHERE created_at >= $1 AND created_at <= $2
          AND status IN ('issued', 'paid', 'sent')
      `,
        [startOfDay.toISOString(), endOfDay.toISOString()],
      );

      return parseInt(result[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Format date as DD.MM.YYYY (Romanian standard).
   */
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Get current config for reporting.
   */
  getConfig(): FinancialKPIConfig {
    return { ...this.config };
  }
}
