/**
 * Daily Financial KPIs DTO
 * Extracted at end-of-day (23:59) for daily reporting.
 */
export interface DailyFinancialKPIs {
    /** Report date in DD.MM.YYYY format */
    date: string;
    /** Total invoiced revenue in last 24h (€) */
    grossRevenue: number;
    /** Cost of Goods Sold (€) */
    cogs: number;
    /** Operational expenses — live or config fallback (€) */
    opEx: number;
    /** grossRevenue - cogs - opEx (€) */
    netProfit: number;
    /** TVA collected = revenue × TVA rate (€) */
    tvaCollected: number;
    /** Estimated corporate tax (€) */
    estimatedTax: number;
    /** Number of invoices emitted in T-24h */
    invoiceCount: number;
    /** false = data incomplete → report must NOT be sent */
    isComplete: boolean;
    /** Human-readable reason if isComplete is false */
    incompleteReason?: string;
}
