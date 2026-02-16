import { BankTransaction } from '../../domain/entities/BankTransaction';
import { PaymentMatch } from '../../domain/entities/PaymentMatch';
import { IBankingRepository } from '../../infrastructure/repositories/IBankingRepository';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('banking-matching');

export interface MatchSuggestion {
  transactionId: number;
  matchType: 'invoice' | 'proforma' | 'order';
  matchId: number;
  matchNumber: string;
  amount: number;
  confidence: number;
  reason: string[];
}

/**
 * Payment reconciliation matching service
 * Matches bank transactions to invoices, proformas, and orders
 */
export class MatchingService {
  private readonly DATE_WINDOW_DAYS = 5;
  private readonly AMOUNT_TOLERANCE = 0.01; // 1 leu tolerance

  constructor(private readonly repository: IBankingRepository) {}

  /**
   * Suggest matches for a specific transaction
   */
  async suggestMatches(transaction: BankTransaction): Promise<MatchSuggestion[]> {
    if (transaction.amount <= 0) {
      // Only match incoming payments (positive amounts)
      return [];
    }

    const suggestions: MatchSuggestion[] = [];
    const dateFrom = new Date(transaction.date);
    dateFrom.setDate(dateFrom.getDate() - this.DATE_WINDOW_DAYS);
    const dateTo = new Date(transaction.date);
    dateTo.setDate(dateTo.getDate() + this.DATE_WINDOW_DAYS);

    const description = transaction.description.toLowerCase();

    // Try to find matching invoices
    const invoices = await this.repository.findMatchingInvoices(
      description,
      transaction.amount,
      dateFrom,
      dateTo,
    );

    for (const invoice of invoices) {
      const suggestion = this.createMatchSuggestion(
        transaction,
        'invoice',
        invoice.id,
        invoice.invoiceNumber || invoice.id.toString(),
        invoice.totalWithVat || invoice.total,
        description,
      );
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Try to find matching proformas
    const proformas = await this.repository.findMatchingProformas(
      description,
      transaction.amount,
      dateFrom,
      dateTo,
    );

    for (const proforma of proformas) {
      const suggestion = this.createMatchSuggestion(
        transaction,
        'proforma',
        proforma.id,
        proforma.proformaNumber || proforma.id.toString(),
        proforma.totalWithVat,
        description,
      );
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Try to find matching orders
    const orders = await this.repository.findMatchingOrders(
      description,
      transaction.amount,
      dateFrom,
      dateTo,
    );

    for (const order of orders) {
      const suggestion = this.createMatchSuggestion(
        transaction,
        'order',
        order.id,
        order.order_number || order.id.toString(),
        order.total,
        description,
      );
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Create a match suggestion with confidence scoring
   */
  private createMatchSuggestion(
    transaction: BankTransaction,
    matchType: 'invoice' | 'proforma' | 'order',
    matchId: number,
    matchNumber: string,
    matchAmount: number,
    description: string,
  ): MatchSuggestion | null {
    let confidence = 0;
    const reasons: string[] = [];

    // Amount match (highest priority)
    const amountDiff = Math.abs(transaction.amount - matchAmount);
    if (amountDiff <= this.AMOUNT_TOLERANCE) {
      confidence += 50;
      reasons.push('Exact amount match');
    } else if (amountDiff <= 1) {
      confidence += 30;
      reasons.push('Close amount match (±1 RON)');
    } else {
      confidence += Math.max(0, 20 - amountDiff * 10);
      reasons.push(`Amount difference: ${amountDiff.toFixed(2)} RON`);
    }

    // Reference/number match in description
    const refPatterns = [
      new RegExp(matchNumber, 'i'),
      new RegExp(`INV[-\\s]*${matchNumber}`, 'i'),
      new RegExp(`PF[-\\s]*${matchNumber}`, 'i'),
      new RegExp(`B2B[-\\s]*${matchNumber}`, 'i'),
    ];

    for (const pattern of refPatterns) {
      if (pattern.test(description)) {
        confidence += 40;
        reasons.push(`Reference number ${matchNumber} found in description`);
        break;
      }
    }

    // Pattern-based matching for invoice/proforma/order
    const invoicePatterns = [/factura/i, /invoice/i, /inv[-\s]*\d+/i];
    const proformaPatterns = [/proforma/i, /pf[-\s]*\d+/i];
    const orderPatterns = [/comanda/i, /order/i, /b2b[-\s]*\d+/i];

    if (matchType === 'invoice' && invoicePatterns.some(p => p.test(description))) {
      confidence += 10;
      reasons.push('Invoice pattern detected in description');
    } else if (matchType === 'proforma' && proformaPatterns.some(p => p.test(description))) {
      confidence += 10;
      reasons.push('Proforma pattern detected in description');
    } else if (matchType === 'order' && orderPatterns.some(p => p.test(description))) {
      confidence += 10;
      reasons.push('Order pattern detected in description');
    }

    // Only return if confidence is above threshold
    if (confidence >= 30) {
      return {
        transactionId: transaction.id!,
        matchType,
        matchId,
        matchNumber,
        amount: matchAmount,
        confidence: Math.min(100, confidence),
        reason: reasons,
      };
    }

    return null;
  }

  /**
   * Create a PaymentMatch entity from a suggestion
   */
  async confirmMatch(suggestion: MatchSuggestion): Promise<PaymentMatch> {
    const match = new PaymentMatch(
      undefined,
      suggestion.transactionId,
      suggestion.matchType,
      suggestion.matchId,
      suggestion.amount,
      suggestion.confidence,
      'confirmed',
      'user',
      new Date(),
    );

    return await this.repository.createMatch(match);
  }

  /**
   * Create a suggested match (system-generated)
   */
  async createSuggestedMatch(suggestion: MatchSuggestion): Promise<PaymentMatch> {
    const match = new PaymentMatch(
      undefined,
      suggestion.transactionId,
      suggestion.matchType,
      suggestion.matchId,
      suggestion.amount,
      suggestion.confidence,
      'suggested',
      'system',
      new Date(),
    );

    return await this.repository.createMatch(match);
  }
}
