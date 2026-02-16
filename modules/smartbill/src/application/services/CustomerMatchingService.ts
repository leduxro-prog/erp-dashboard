/**
 * CustomerMatchingService
 *
 * Implements intelligent customer matching between SmartBill external customers
 * and ERP customers using a weighted scoring algorithm.
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('CustomerMatchingService');

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  customerId: number;
  companyName: string;
  cui: string | null;
  email: string | null;
  phone: string | null;
  matchScore: number; // 0-100
  matchReasons: string[]; // e.g. ['CUI exact match (+50)', 'Email domain match (+15)']
  confidence: 'high' | 'medium' | 'low';
}

export interface MatchResult {
  smartBillCustomerId: string;
  smartBillName: string;
  candidates: MatchCandidate[]; // Top 5, sorted by score DESC
  autoMatchSuggestion: MatchCandidate | null; // If score >= 80, suggest auto-link
}

interface SmartBillCustomerData {
  name: string;
  vatCode: string;
  email: string;
  phone: string;
}

interface ErpCustomerRow {
  id: number;
  company_name: string;
  tax_identification_number: string | null;
  email: string | null;
  phone_number: string | null;
  contact_person_name: string | null;
  contact_person_email: string | null;
  contact_person_phone: string | null;
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const SCORE_CUI_EXACT = 50;
const SCORE_EMAIL_EXACT = 35;
const SCORE_EMAIL_DOMAIN = 15;
const SCORE_PHONE_EXACT = 25;
const SCORE_COMPANY_NAME_EXACT = 30;
const SCORE_COMPANY_NAME_FUZZY = 20;
const SCORE_CONTACT_NAME = 10;

const MAX_TOP_CANDIDATES = 5;
const HIGH_CONFIDENCE_THRESHOLD = 80;
const MEDIUM_CONFIDENCE_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a Romanian phone number for comparison.
 * Strips +40, leading 0, spaces, dashes, dots, and parentheses.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let phone = raw.replace(/[\s\-().]/g, '');
  // Remove +40 prefix
  if (phone.startsWith('+40')) {
    phone = phone.slice(3);
  }
  // Remove leading 0
  if (phone.startsWith('0')) {
    phone = phone.slice(1);
  }
  return phone;
}

/**
 * Extract domain from an email address (lowercase).
 */
function emailDomain(email: string | null | undefined): string {
  if (!email) return '';
  const atIdx = email.lastIndexOf('@');
  if (atIdx < 0) return '';
  return email
    .slice(atIdx + 1)
    .toLowerCase()
    .trim();
}

/**
 * Simple Levenshtein distance implementation.
 */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const matrix: number[][] = [];

  for (let i = 0; i <= la; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[la][lb];
}

/**
 * Determine confidence level from a numeric score.
 */
function scoreToConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CustomerMatchingService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Find match candidates for a single SmartBill customer against all ERP customers.
   */
  async findMatches(smartBillCustomer: SmartBillCustomerData): Promise<MatchResult> {
    const erpCustomers = await this.fetchAllErpCustomers();

    const candidates = this.scoreCustomers(smartBillCustomer, erpCustomers);

    // Sort DESC by score, take top 5
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    const topCandidates = candidates.filter((c) => c.matchScore > 0).slice(0, MAX_TOP_CANDIDATES);

    const autoMatchSuggestion =
      topCandidates.length > 0 && topCandidates[0].matchScore >= HIGH_CONFIDENCE_THRESHOLD
        ? topCandidates[0]
        : null;

    return {
      smartBillCustomerId: smartBillCustomer.vatCode || `name:${smartBillCustomer.name}`,
      smartBillName: smartBillCustomer.name,
      candidates: topCandidates,
      autoMatchSuggestion,
    };
  }

  /**
   * Find match candidates for all unlinked customer_external_links entries.
   */
  async findMatchesForUnlinked(): Promise<MatchResult[]> {
    const unlinkedRows = await this.dataSource.query(
      `SELECT id, external_id, external_data
       FROM customer_external_links
       WHERE provider = 'smartbill'
         AND customer_id IS NULL
         AND COALESCE(sync_status, '') <> 'ignored'
       ORDER BY updated_at DESC`,
    );

    if (unlinkedRows.length === 0) {
      return [];
    }

    const erpCustomers = await this.fetchAllErpCustomers();
    const results: MatchResult[] = [];

    for (const row of unlinkedRows) {
      const externalData = this.parseExternalData(row.external_data);
      const sbCustomer: SmartBillCustomerData = {
        name: externalData.name || '',
        vatCode: externalData.vatCode || '',
        email: externalData.email || '',
        phone: externalData.phone || '',
      };

      const candidates = this.scoreCustomers(sbCustomer, erpCustomers);
      candidates.sort((a, b) => b.matchScore - a.matchScore);
      const topCandidates = candidates.filter((c) => c.matchScore > 0).slice(0, MAX_TOP_CANDIDATES);

      const autoMatchSuggestion =
        topCandidates.length > 0 && topCandidates[0].matchScore >= HIGH_CONFIDENCE_THRESHOLD
          ? topCandidates[0]
          : null;

      results.push({
        smartBillCustomerId: row.external_id,
        smartBillName: sbCustomer.name,
        candidates: topCandidates,
        autoMatchSuggestion,
      });
    }

    return results;
  }

  /**
   * Find match candidates for a specific customer_external_links entry by ID.
   */
  async findMatchesForLink(linkId: number): Promise<MatchResult | null> {
    const rows = await this.dataSource.query(
      `SELECT id, external_id, external_data
       FROM customer_external_links
       WHERE id = $1 AND provider = 'smartbill'
       LIMIT 1`,
      [linkId],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const externalData = this.parseExternalData(row.external_data);
    const sbCustomer: SmartBillCustomerData = {
      name: externalData.name || '',
      vatCode: externalData.vatCode || '',
      email: externalData.email || '',
      phone: externalData.phone || '',
    };

    return this.findMatches(sbCustomer);
  }

  /**
   * Automatically link all high-confidence matches.
   * In dryRun mode, no DB changes are made.
   */
  async autoLinkHighConfidence(dryRun = false): Promise<{
    linked: number;
    skipped: number;
    details: Array<{ smartBillId: string; customerId: number; score: number }>;
  }> {
    const allMatches = await this.findMatchesForUnlinked();

    let linked = 0;
    let skipped = 0;
    const details: Array<{ smartBillId: string; customerId: number; score: number }> = [];

    for (const match of allMatches) {
      if (!match.autoMatchSuggestion) {
        skipped++;
        continue;
      }

      const suggestion = match.autoMatchSuggestion;
      details.push({
        smartBillId: match.smartBillCustomerId,
        customerId: suggestion.customerId,
        score: suggestion.matchScore,
      });

      if (!dryRun) {
        try {
          await this.dataSource.query(
            `UPDATE customer_external_links
             SET customer_id = $1,
                 sync_status = 'synced',
                 last_sync_at = NOW(),
                 updated_at = NOW()
             WHERE provider = 'smartbill'
               AND external_id = $2
               AND customer_id IS NULL`,
            [suggestion.customerId, match.smartBillCustomerId],
          );
          linked++;
        } catch (err) {
          logger.error(`Failed to auto-link SmartBill customer ${match.smartBillCustomerId}`, {
            error: err instanceof Error ? err.message : String(err),
          });
          skipped++;
        }
      } else {
        linked++;
      }
    }

    logger.info('Auto-link high confidence completed', {
      dryRun,
      linked,
      skipped,
      total: allMatches.length,
    });

    return { linked, skipped, details };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchAllErpCustomers(): Promise<ErpCustomerRow[]> {
    return this.dataSource.query(
      `SELECT
         id,
         company_name,
         tax_identification_number,
         email,
         phone_number,
         contact_person_name,
         contact_person_email,
         contact_person_phone
       FROM customers
       WHERE deleted_at IS NULL
       ORDER BY id`,
    );
  }

  private scoreCustomers(
    sbCustomer: SmartBillCustomerData,
    erpCustomers: ErpCustomerRow[],
  ): MatchCandidate[] {
    const sbNameLower = (sbCustomer.name || '').trim().toLowerCase();
    const sbVatCode = (sbCustomer.vatCode || '').trim();
    const sbEmailLower = (sbCustomer.email || '').trim().toLowerCase();
    const sbPhoneNorm = normalizePhone(sbCustomer.phone);
    const sbEmailDomain = emailDomain(sbCustomer.email);

    const candidates: MatchCandidate[] = [];

    for (const erp of erpCustomers) {
      let score = 0;
      const reasons: string[] = [];

      // 1. CUI exact match
      const erpCui = (erp.tax_identification_number || '').trim();
      if (sbVatCode && erpCui && sbVatCode === erpCui) {
        score += SCORE_CUI_EXACT;
        reasons.push(`CUI exact match (+${SCORE_CUI_EXACT})`);
      }

      // 2. Email exact match (primary or contact person)
      const erpEmailLower = (erp.email || '').trim().toLowerCase();
      const erpContactEmailLower = (erp.contact_person_email || '').trim().toLowerCase();
      if (
        sbEmailLower &&
        (sbEmailLower === erpEmailLower || sbEmailLower === erpContactEmailLower)
      ) {
        score += SCORE_EMAIL_EXACT;
        reasons.push(`Email exact match (+${SCORE_EMAIL_EXACT})`);
      } else if (sbEmailDomain && sbEmailDomain !== '') {
        // 3. Email domain match
        const erpDomain = emailDomain(erp.email);
        const erpContactDomain = emailDomain(erp.contact_person_email);
        if (sbEmailDomain === erpDomain || sbEmailDomain === erpContactDomain) {
          score += SCORE_EMAIL_DOMAIN;
          reasons.push(`Email domain match (+${SCORE_EMAIL_DOMAIN})`);
        }
      }

      // 4. Phone exact match (normalized)
      const erpPhoneNorm = normalizePhone(erp.phone_number);
      const erpContactPhoneNorm = normalizePhone(erp.contact_person_phone);
      if (sbPhoneNorm && (sbPhoneNorm === erpPhoneNorm || sbPhoneNorm === erpContactPhoneNorm)) {
        score += SCORE_PHONE_EXACT;
        reasons.push(`Phone exact match (+${SCORE_PHONE_EXACT})`);
      }

      // 5. Company name exact match (case-insensitive, trimmed)
      const erpNameLower = (erp.company_name || '').trim().toLowerCase();
      if (sbNameLower && erpNameLower && sbNameLower === erpNameLower) {
        score += SCORE_COMPANY_NAME_EXACT;
        reasons.push(`Company name exact match (+${SCORE_COMPANY_NAME_EXACT})`);
      } else if (sbNameLower && erpNameLower) {
        // 6. Company name fuzzy match
        const distance = levenshtein(sbNameLower, erpNameLower);
        const containsMatch =
          sbNameLower.includes(erpNameLower) || erpNameLower.includes(sbNameLower);
        if (distance <= 3 || containsMatch) {
          score += SCORE_COMPANY_NAME_FUZZY;
          reasons.push(`Company name fuzzy match (+${SCORE_COMPANY_NAME_FUZZY})`);
        }
      }

      // 7. Contact person name match
      const erpContactName = (erp.contact_person_name || '').trim().toLowerCase();
      if (sbNameLower && erpContactName && sbNameLower === erpContactName) {
        score += SCORE_CONTACT_NAME;
        reasons.push(`Contact person name match (+${SCORE_CONTACT_NAME})`);
      }

      if (score > 0) {
        candidates.push({
          customerId: erp.id,
          companyName: erp.company_name || '',
          cui: erp.tax_identification_number || null,
          email: erp.email || null,
          phone: erp.phone_number || null,
          matchScore: Math.min(score, 100),
          matchReasons: reasons,
          confidence: scoreToConfidence(Math.min(score, 100)),
        });
      }
    }

    return candidates;
  }

  private parseExternalData(data: unknown): Record<string, string> {
    if (!data) return {};
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return {};
      }
    }
    if (typeof data === 'object') {
      return data as Record<string, string>;
    }
    return {};
  }
}
