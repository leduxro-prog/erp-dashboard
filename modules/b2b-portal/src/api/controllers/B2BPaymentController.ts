import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource } from 'typeorm';

export interface PaymentResponse {
  id: string;
  date: string;
  reference: string;
  reference_type: string;
  amount: number;
  type: 'invoice' | 'adjustment' | 'credit' | 'debit';
  status: 'completed' | 'pending' | 'failed';
  description: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export interface PaymentSummaryResponse {
  total_debt: number;
  credit_limit: number;
  credit_available: number;
  credit_used: number;
  next_due_date: string | null;
  next_due_amount: number;
  current_month_payments: number;
  current_month_invoices: number;
  overdue_amount: number;
  payment_terms_days: number;
}

export class B2BPaymentController {
  constructor(private readonly dataSource: DataSource) {}

  private getB2BCustomerId(req: AuthenticatedRequest): number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    const id = b2bCustomer?.customer_id ?? b2bCustomer?.id ?? b2bCustomer?.customer?.id;
    return id ? parseInt(id, 10) : undefined;
  }

  /**
   * Get credit_account_id for a b2b_customer
   * b2b_customers.id is used, and b2b.credit_transactions uses credit_account_id
   */
  private async getCreditAccountId(customerId: number): Promise<string | null> {
    // Check if b2b.credit_accounts exists (new schema)
    try {
      const result = await this.dataSource.query(
        `SELECT id FROM b2b.credit_accounts WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      return result.length > 0 ? result[0].id : null;
    } catch {
      // Fall back to using customer_id directly if credit_accounts doesn't exist
      // For legacy compatibility with b2b_customers table
      return null;
    }
  }

  async getPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const { from, to, type, page = 1, limit = 20 } = req.query;

      // Get credit_account_id from new schema or use customer_id for legacy
      const creditAccountId = await this.getCreditAccountId(customerId);

      let whereConditions: string[];
      const params: any[] = [];
      let paramIndex = 1;

      if (creditAccountId) {
        // New schema: b2b.credit_transactions with credit_account_id
        whereConditions = ['ct.credit_account_id = $1'];
        params.push(creditAccountId);
        paramIndex = 2;
      } else {
        // Legacy: might use customer_id directly
        whereConditions = ['ct.customer_id = $1'];
        params.push(customerId);
        paramIndex = 2;
      }

      if (from) {
        whereConditions.push(`ct.created_at >= $${paramIndex}`);
        params.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`ct.created_at <= $${paramIndex}`);
        params.push(to);
        paramIndex++;
      }

      if (type && ['invoice', 'adjustment', 'credit', 'debit'].includes(type as string)) {
        whereConditions.push(`ct.entry_type = $${paramIndex}`);
        params.push(type.toString().toLowerCase());
        paramIndex++;
      }

      const countResult = await this.dataSource.query(
        `SELECT COUNT(*) as total FROM b2b.credit_transactions ct WHERE ${whereConditions.join(' AND ')}`,
        params,
      );
      const total = parseInt(countResult[0].total, 10);

      const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
      params.push(parseInt(limit as string, 10), offset);

      const transactions = await this.dataSource.query(
        `SELECT
          ct.id,
          ct.entry_type,
          ct.amount,
          ct.balance_after,
          ct.description,
          ct.reference_type,
          ct.reference_id,
          ct.reference_number,
          ct.created_at,
          ct.metadata
        FROM b2b.credit_transactions ct
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ct.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
      );

      const payments: PaymentResponse[] = transactions.map((t: any) => ({
        id: t.id,
        date: t.created_at,
        reference: t.reference_number || t.reference_id || '-',
        reference_type: t.reference_type || 'adjustment',
        amount: Math.abs(parseFloat(t.amount) || 0),
        type: this.mapTransactionType(t.entry_type, t.reference_type),
        status: 'completed',
        description: t.description || '',
        balance_before: 0, // Not available in ledger, would need calculation
        balance_after: parseFloat(t.balance_after) || 0,
        created_at: t.created_at,
      }));

      res.status(200).json({
        success: true,
        data: {
          items: payments,
          total,
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
          totalPages: Math.ceil(total / parseInt(limit as string, 10)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' },
        });
        return;
      }

      const creditAccountId = await this.getCreditAccountId(customerId);

      // Try new schema first (b2b.credit_accounts), fall back to legacy (b2b_customers)
      let customer: any;
      if (creditAccountId) {
        const accountResult = await this.dataSource.query(
          `SELECT
            ca.credit_limit,
            ca.current_balance as credit_used,
            ca.available_credit,
            c.payment_terms_days
          FROM b2b.credit_accounts ca
          JOIN b2b.customers c ON ca.customer_id = c.id
          WHERE c.id = $1`,
          [customerId],
        );
        if (accountResult.length > 0) {
          customer = accountResult[0];
        }
      }

      if (!customer) {
        // Fall back to legacy b2b_customers table
        const legacyResult = await this.dataSource.query(
          `SELECT
            credit_limit,
            credit_used,
            payment_terms_days,
            (credit_limit - credit_used) as credit_available
          FROM b2b_customers
          WHERE id = $1`,
          [customerId],
        );
        if (legacyResult.length === 0) {
          res.status(404).json({
            success: false,
            error: { code: 'CUSTOMER_NOT_FOUND', message: 'B2B customer not found' },
          });
          return;
        }
        customer = legacyResult[0];
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const transactionWhere = creditAccountId ? `credit_account_id = $1` : `customer_id = $1`;
      const transactionParam = creditAccountId ? [creditAccountId] : [customerId];

      const monthPaymentsResult = await this.dataSource.query(
        `SELECT
          COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN amount ELSE 0 END), 0) as total_credits,
          COALESCE(SUM(CASE WHEN entry_type = 'capture' OR entry_type = 'reserve' THEN ABS(amount) ELSE 0 END), 0) as total_debits,
          COALESCE(SUM(CASE WHEN entry_type = 'manual_adjustment' THEN amount ELSE 0 END), 0) as total_adjustments
        FROM b2b.credit_transactions
        WHERE ${transactionWhere}
        AND created_at >= $2
        AND created_at <= $3`,
        [...transactionParam, startOfMonth.toISOString(), endOfMonth.toISOString()],
      );

      const monthStats = monthPaymentsResult[0];

      // Use b2b_orders table
      const upcomingDueDate = await this.dataSource.query(
        `SELECT
          o.id,
          o.total,
          o.created_at,
          o.created_at + INTERVAL '1 day' * $2 as due_date
        FROM b2b_orders o
        WHERE o.customer_id = $1
        AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'REFUNDED')
        AND o.payment_status != 'PAID'
        ORDER BY o.created_at ASC
        LIMIT 1`,
        [customerId, customer.payment_terms_days || 30],
      );

      let nextDueDate: string | null = null;
      let nextDueAmount = 0;

      if (upcomingDueDate.length > 0) {
        nextDueDate = upcomingDueDate[0].due_date;
        nextDueAmount = parseFloat(upcomingDueDate[0].total) || 0;
      }

      const overdueResult = await this.dataSource.query(
        `SELECT COALESCE(SUM(o.total), 0) as overdue_amount
        FROM b2b_orders o
        WHERE o.customer_id = $1
        AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'REFUNDED')
        AND o.payment_status != 'PAID'
        AND o.created_at + INTERVAL '1 day' * $2 < NOW()`,
        [customerId, customer.payment_terms_days || 30],
      );

      const overdueAmount = parseFloat(overdueResult[0]?.overdue_amount) || 0;

      const summary: PaymentSummaryResponse = {
        total_debt: parseFloat(customer.credit_used) || 0,
        credit_limit: parseFloat(customer.credit_limit) || 0,
        credit_available: parseFloat(customer.credit_available) || 0,
        credit_used: parseFloat(customer.credit_used) || 0,
        next_due_date: nextDueDate,
        next_due_amount: nextDueAmount,
        current_month_payments: Math.abs(parseFloat(monthStats.total_credits) || 0),
        current_month_invoices: parseFloat(monthStats.total_debits) || 0,
        overdue_amount: overdueAmount,
        payment_terms_days: customer.payment_terms_days || 30,
      };

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  private mapTransactionType(
    dbType: string,
    referenceType: string,
  ): 'invoice' | 'adjustment' | 'credit' | 'debit' {
    if (referenceType === 'ORDER' || referenceType === 'INVOICE') {
      return 'invoice';
    }
    // Handle both old uppercase and new lowercase entry types
    const type = dbType?.toLowerCase();
    switch (type) {
      case 'credit':
      case 'payment':
      case 'capture':
      case 'release':
        return 'credit';
      case 'debit':
      case 'reserve':
      case 'penalty':
      case 'interest':
        return 'debit';
      case 'adjustment':
      case 'manual_adjustment':
      case 'credit_limit_decrease':
        return 'adjustment';
      default:
        return 'adjustment';
    }
  }
}
