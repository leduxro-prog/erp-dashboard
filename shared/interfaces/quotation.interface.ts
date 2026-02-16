import {
  Quote,
  CreateQuoteDTO,
  PaginatedResult,
} from '../types';

/**
 * Quote filtering options
 */
export interface QuoteFilters {
  status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  customerId?: number;
  salesPersonId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Quotation service interface for managing quotes and conversions
 */
export interface IQuotationService {
  /**
   * Create a new quotation
   * @param data - Quote creation data
   * @returns Created quote with generated ID
   */
  createQuote(data: CreateQuoteDTO): Promise<Quote>;

  /**
   * Get quotation details by ID
   * @param quoteId - Quote ID
   * @returns Quote details
   */
  getQuote(quoteId: number): Promise<Quote>;

  /**
   * List quotations with filtering and pagination
   * @param filters - Filter and pagination options
   * @returns Paginated list of quotes
   */
  listQuotes(filters: QuoteFilters): Promise<PaginatedResult<Quote>>;

  /**
   * Generate PDF for a quotation
   * @param quoteId - Quote ID
   * @returns PDF buffer
   */
  generateQuotePDF(quoteId: number): Promise<Buffer>;

  /**
   * Send quotation to customer
   * @param quoteId - Quote ID
   * @param method - Delivery method (email or WhatsApp)
   */
  sendQuote(quoteId: number, method: 'email' | 'whatsapp'): Promise<void>;

  /**
   * Accept a quotation (customer accepts)
   * @param quoteId - Quote ID
   */
  acceptQuote(quoteId: number): Promise<void>;

  /**
   * Decline a quotation (customer declines)
   * @param quoteId - Quote ID
   * @param reason - Optional reason for declining
   */
  declineQuote(quoteId: number, reason?: string): Promise<void>;

  /**
   * Convert accepted quote to order
   * @param quoteId - Quote ID to convert
   * @returns Generated order ID
   */
  convertToOrder(quoteId: number): Promise<number>;

  /**
   * Expire overdue quotations
   * @returns Number of quotes expired
   */
  expireOverdueQuotes(): Promise<number>;

  /**
   * Send reminders for pending quotations
   * @returns Number of reminders sent
   */
  sendReminders(): Promise<number>;
}
