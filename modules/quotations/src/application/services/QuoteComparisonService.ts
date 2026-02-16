/**
 * Quote Comparison Service
 * Allows comparing multiple quotes side-by-side
 */

import { DataSource } from 'typeorm';

export interface QuoteComparisonItem {
  quoteId: string;
  quoteNumber: string;
  quoteDate: Date;
  expiryDate: Date;
  status: string;
  customerName: string;
  totalAmount: number;
  currencyCode: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  notes?: string;
  termsAndConditions?: string;
}

export interface ComparisonResult {
  quotes: QuoteComparisonItem[];
  summary: {
    totalQuotes: number;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    bestDeal: string; // Quote ID with best price
  };
  productComparison: Array<{
    productId: string;
    productName: string;
    sku: string;
    appearances: number; // How many quotes include this product
    prices: Array<{
      quoteId: string;
      quoteNumber: string;
      unitPrice: number;
      quantity: number;
      total: number;
    }>;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
  }>;
  differences: Array<{
    field: string;
    values: Array<{
      quoteId: string;
      value: any;
    }>;
  }>;
}

export class QuoteComparisonService {
  constructor(private dataSource: DataSource) {}

  /**
   * Compare multiple quotes
   */
  async compareQuotes(quoteIds: string[]): Promise<ComparisonResult> {
    if (quoteIds.length < 2) {
      throw new Error('At least 2 quotes are required for comparison');
    }

    if (quoteIds.length > 10) {
      throw new Error('Maximum 10 quotes can be compared at once');
    }

    // Fetch all quotes
    const quotes = await this.fetchQuotes(quoteIds);

    if (quotes.length !== quoteIds.length) {
      throw new Error('One or more quotes not found');
    }

    // Calculate summary
    const summary = this.calculateSummary(quotes);

    // Compare products across quotes
    const productComparison = this.compareProducts(quotes);

    // Find differences in quote-level fields
    const differences = this.findDifferences(quotes);

    return {
      quotes,
      summary,
      productComparison,
      differences,
    };
  }

  /**
   * Save comparison for future reference
   */
  async saveComparison(
    customerId: string,
    quoteIds: string[],
    userId?: string,
    notes?: string,
    expiresInDays: number = 30
  ): Promise<string> {
    const comparison = await this.compareQuotes(quoteIds);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const query = `
      INSERT INTO quotation_comparisons
        (customer_id, quotation_ids, comparison_data, created_by_user_id, notes, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const [result] = await this.dataSource.query(query, [
      customerId,
      quoteIds,
      JSON.stringify(comparison),
      userId || null,
      notes || null,
      expiresAt,
    ]);

    return result.id;
  }

  /**
   * Get saved comparison
   */
  async getSavedComparison(comparisonId: string): Promise<ComparisonResult | null> {
    const query = `
      SELECT comparison_data
      FROM quotation_comparisons
      WHERE id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const [result] = await this.dataSource.query(query, [comparisonId]);

    return result?.comparison_data || null;
  }

  /**
   * Get customer's saved comparisons
   */
  async getCustomerComparisons(customerId: string): Promise<any[]> {
    const query = `
      SELECT
        id,
        quotation_ids as "quotationIds",
        created_at as "createdAt",
        expires_at as "expiresAt",
        notes
      FROM quotation_comparisons
      WHERE customer_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return await this.dataSource.query(query, [customerId]);
  }

  /**
   * Fetch quotes with items
   */
  private async fetchQuotes(quoteIds: string[]): Promise<QuoteComparisonItem[]> {
    const query = `
      SELECT
        q.id as quote_id,
        q.quote_number,
        q.quote_date,
        q.expiry_date,
        q.status,
        q.subtotal,
        q.discount_amount,
        q.tax_amount,
        q.total_amount,
        q.currency_code,
        q.notes,
        q.terms_and_conditions,
        c.name as customer_name
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.id = ANY($1)
        AND q.deleted_at IS NULL
      ORDER BY q.quote_date DESC
    `;

    const quotesData = await this.dataSource.query(query, [quoteIds]);

    // Fetch items for each quote
    const itemsQuery = `
      SELECT
        qi.quotation_id,
        qi.product_id,
        p.name as product_name,
        p.sku,
        qi.quantity,
        qi.unit_price,
        qi.discount_percentage as discount,
        qi.tax_rate,
        qi.total_amount as total
      FROM quotation_items qi
      INNER JOIN products p ON p.id = qi.product_id
      WHERE qi.quotation_id = ANY($1)
      ORDER BY qi.sort_order ASC
    `;

    const itemsData = await this.dataSource.query(itemsQuery, [quoteIds]);

    // Group items by quote
    const itemsByQuote: Record<string, any[]> = {};
    itemsData.forEach((item: any) => {
      if (!itemsByQuote[item.quotation_id]) {
        itemsByQuote[item.quotation_id] = [];
      }
      itemsByQuote[item.quotation_id].push({
        productId: item.product_id,
        productName: item.product_name,
        sku: item.sku,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price),
        discount: parseFloat(item.discount),
        taxRate: parseFloat(item.tax_rate),
        total: parseFloat(item.total),
      });
    });

    // Combine quotes with items
    return quotesData.map((quote: any) => ({
      quoteId: quote.quote_id,
      quoteNumber: quote.quote_number,
      quoteDate: quote.quote_date,
      expiryDate: quote.expiry_date,
      status: quote.status,
      customerName: quote.customer_name,
      totalAmount: parseFloat(quote.total_amount),
      currencyCode: quote.currency_code,
      items: itemsByQuote[quote.quote_id] || [],
      subtotal: parseFloat(quote.subtotal),
      discountAmount: parseFloat(quote.discount_amount),
      taxAmount: parseFloat(quote.tax_amount),
      notes: quote.notes,
      termsAndConditions: quote.terms_and_conditions,
    }));
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(quotes: QuoteComparisonItem[]): ComparisonResult['summary'] {
    const prices = quotes.map(q => q.totalAmount);

    return {
      totalQuotes: quotes.length,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averagePrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      bestDeal: quotes.find(q => q.totalAmount === Math.min(...prices))!.quoteId,
    };
  }

  /**
   * Compare products across quotes
   */
  private compareProducts(quotes: QuoteComparisonItem[]): ComparisonResult['productComparison'] {
    const productMap: Map<string, any> = new Map();

    // Collect all products from all quotes
    quotes.forEach(quote => {
      quote.items.forEach(item => {
        if (!productMap.has(item.productId)) {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            appearances: 0,
            prices: [],
          });
        }

        const product = productMap.get(item.productId);
        product.appearances++;
        product.prices.push({
          quoteId: quote.quoteId,
          quoteNumber: quote.quoteNumber,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          total: item.total,
        });
      });
    });

    // Calculate statistics for each product
    const comparison = Array.from(productMap.values()).map(product => {
      const prices = product.prices.map((p: any) => p.unitPrice);

      return {
        ...product,
        lowestPrice: Math.min(...prices),
        highestPrice: Math.max(...prices),
        averagePrice: prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length,
      };
    });

    // Sort by appearances (most common products first)
    return comparison.sort((a, b) => b.appearances - a.appearances);
  }

  /**
   * Find differences in quote-level fields
   */
  private findDifferences(quotes: QuoteComparisonItem[]): ComparisonResult['differences'] {
    const fields = ['status', 'expiryDate', 'discountAmount', 'taxAmount', 'notes'];
    const differences: ComparisonResult['differences'] = [];

    fields.forEach(field => {
      const values = quotes.map(q => ({
        quoteId: q.quoteId,
        value: (q as any)[field],
      }));

      // Check if there are differences
      const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));

      if (uniqueValues.size > 1) {
        differences.push({
          field,
          values,
        });
      }
    });

    return differences;
  }

  /**
   * Get best quote based on criteria
   */
  getBestQuote(
    comparison: ComparisonResult,
    criteria: 'lowest-price' | 'highest-discount' | 'most-items' = 'lowest-price'
  ): QuoteComparisonItem {
    const { quotes } = comparison;

    switch (criteria) {
      case 'lowest-price':
        return quotes.reduce((best, current) =>
          current.totalAmount < best.totalAmount ? current : best
        );

      case 'highest-discount':
        return quotes.reduce((best, current) =>
          current.discountAmount > best.discountAmount ? current : best
        );

      case 'most-items':
        return quotes.reduce((best, current) =>
          current.items.length > best.items.length ? current : best
        );

      default:
        return quotes[0];
    }
  }
}
