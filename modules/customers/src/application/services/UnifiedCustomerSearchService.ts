/**
 * UnifiedCustomerSearchService
 *
 * Searches across multiple customer sources (ERP customers, B2B customers,
 * and optionally SmartBill clients) and returns a unified, deduplicated result set.
 *
 * Deduplication priority: CUI > email > name+phone
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

export type CustomerSource = 'erp' | 'b2b' | 'smartbill';

export interface UnifiedCustomer {
  id: string;
  source: CustomerSource;
  sourceId: number | string;
  displayName: string;
  companyName: string | null;
  contactPerson: string | null;
  cui: string | null;
  email: string;
  phone: string | null;
  creditLimit: number | null;
  creditUsed: number | null;
  discount: number | null;
  tier: string | null;
  status: string;
}

export interface CustomerSearchOptions {
  query: string;
  sources?: CustomerSource[];
  limit?: number;
  offset?: number;
}

export interface CustomerSearchResult {
  customers: UnifiedCustomer[];
  total: number;
  sources: CustomerSource[];
}

export class UnifiedCustomerSearchService {
  private readonly logger = createModuleLogger('UnifiedCustomerSearch');

  constructor(private readonly dataSource: DataSource) {}

  async search(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    const { query, sources = ['erp', 'b2b'], limit = 50, offset = 0 } = options;

    const searchTerm = `%${query.trim()}%`;
    const allCustomers: UnifiedCustomer[] = [];

    // Search ERP customers
    if (sources.includes('erp')) {
      try {
        const erpCustomers = await this.searchErpCustomers(searchTerm, limit);
        allCustomers.push(...erpCustomers);
      } catch (err) {
        this.logger.error('Error searching ERP customers', err);
      }
    }

    // Search B2B customers
    if (sources.includes('b2b')) {
      try {
        const b2bCustomers = await this.searchB2BCustomers(searchTerm, limit);
        allCustomers.push(...b2bCustomers);
      } catch (err) {
        this.logger.error('Error searching B2B customers', err);
      }
    }

    // Search SmartBill clients (from synced data - WS3)
    if (sources.includes('smartbill')) {
      try {
        const sbCustomers = await this.searchSmartBillCustomers(searchTerm, limit);
        allCustomers.push(...sbCustomers);
      } catch (err) {
        this.logger.error('Error searching SmartBill customers', err);
      }
    }

    // Deduplicate: CUI > email > name+phone
    const deduplicated = this.deduplicateCustomers(allCustomers);

    // Sort by relevance (exact matches first, then partial)
    const queryLower = query.trim().toLowerCase();
    deduplicated.sort((a, b) => {
      const aExact =
        a.displayName.toLowerCase() === queryLower ||
        a.cui?.toLowerCase() === queryLower ||
        a.email.toLowerCase() === queryLower;
      const bExact =
        b.displayName.toLowerCase() === queryLower ||
        b.cui?.toLowerCase() === queryLower ||
        b.email.toLowerCase() === queryLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    const total = deduplicated.length;
    const paged = deduplicated.slice(offset, offset + limit);

    return {
      customers: paged,
      total,
      sources,
    };
  }

  /**
   * Get a single customer by ID and source.
   */
  async getById(
    source: CustomerSource,
    sourceId: string | number,
  ): Promise<UnifiedCustomer | null> {
    if (source === 'erp') {
      const rows = await this.dataSource.query(
        `SELECT id, company_name, contact_person_name, tax_identification_number,
                email, phone_number, credit_limit, used_credit,
                status
         FROM customers WHERE id = $1 AND deleted_at IS NULL`,
        [sourceId],
      );
      if (rows.length === 0) return null;
      return this.mapErpRow(rows[0]);
    }

    if (source === 'b2b') {
      const rows = await this.dataSource.query(
        `SELECT id, company_name, contact_person, cui, email, phone,
                credit_limit, credit_used, discount_percentage, tier, status
         FROM b2b_customers WHERE id = $1`,
        [sourceId],
      );
      if (rows.length === 0) return null;
      return this.mapB2BRow(rows[0]);
    }

    return null;
  }

  private async searchErpCustomers(searchTerm: string, limit: number): Promise<UnifiedCustomer[]> {
    const rows = await this.dataSource.query(
      `SELECT id, company_name, contact_person_name, tax_identification_number,
              email, phone_number, credit_limit, used_credit,
              status
       FROM customers
       WHERE deleted_at IS NULL
         AND (
           company_name ILIKE $1
           OR contact_person_name ILIKE $1
           OR email ILIKE $1
           OR tax_identification_number ILIKE $1
           OR phone_number ILIKE $1
         )
       ORDER BY company_name ASC
       LIMIT $2`,
      [searchTerm, limit],
    );

    return rows.map((row: any) => this.mapErpRow(row));
  }

  private async searchB2BCustomers(searchTerm: string, limit: number): Promise<UnifiedCustomer[]> {
    const rows = await this.dataSource.query(
      `SELECT id, company_name, contact_person, cui, email, phone,
              credit_limit, credit_used, discount_percentage, tier, status
       FROM b2b_customers
       WHERE status = 'ACTIVE'
         AND (
           company_name ILIKE $1
           OR contact_person ILIKE $1
           OR email ILIKE $1
           OR cui ILIKE $1
           OR phone ILIKE $1
         )
       ORDER BY company_name ASC
       LIMIT $2`,
      [searchTerm, limit],
    );

    return rows.map((row: any) => this.mapB2BRow(row));
  }

  private async searchSmartBillCustomers(
    _searchTerm: string,
    _limit: number,
  ): Promise<UnifiedCustomer[]> {
    // WS3 will implement this - for now check if customer_external_links exists
    try {
      const tableExists = await this.dataSource.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_name = 'customer_external_links'
         ) AS exists`,
      );
      if (!tableExists[0]?.exists) return [];

      const rows = await this.dataSource.query(
        `SELECT cel.id, cel.external_id, cel.external_data, cel.customer_id,
                COALESCE(c.company_name, cel.external_data->>'name') as company_name,
                c.email, c.tax_identification_number as cui
         FROM customer_external_links cel
         LEFT JOIN customers c ON c.id = cel.customer_id
         WHERE cel.provider = 'smartbill'
           AND (
             cel.external_data->>'name' ILIKE $1
             OR cel.external_data->>'vatCode' ILIKE $1
             OR c.company_name ILIKE $1
           )
         ORDER BY cel.last_sync_at DESC
         LIMIT $2`,
        [_searchTerm, _limit],
      );

      return rows.map((row: any) => ({
        id: `smartbill_${row.external_id || row.id}`,
        source: 'smartbill' as CustomerSource,
        sourceId: row.external_id || row.id,
        displayName: row.company_name || 'SmartBill Client',
        companyName: row.company_name,
        contactPerson: row.external_data?.contactPerson || null,
        cui: row.cui || row.external_data?.vatCode || null,
        email: row.email || row.external_data?.email || '',
        phone: row.external_data?.phone || null,
        creditLimit: null,
        creditUsed: null,
        discount: null,
        tier: null,
        status: 'active',
      }));
    } catch {
      return [];
    }
  }

  private mapErpRow(row: any): UnifiedCustomer {
    return {
      id: `erp_${row.id}`,
      source: 'erp',
      sourceId: row.id,
      displayName: row.company_name,
      companyName: row.company_name,
      contactPerson: row.contact_person_name || null,
      cui: row.tax_identification_number || null,
      email: row.email,
      phone: row.phone_number || null,
      creditLimit: row.credit_limit ? parseFloat(row.credit_limit) : null,
      creditUsed: row.used_credit ? parseFloat(row.used_credit) : null,
      discount: null,
      tier: null,
      status: row.status || 'ACTIVE',
    };
  }

  private mapB2BRow(row: any): UnifiedCustomer {
    return {
      id: `b2b_${row.id}`,
      source: 'b2b',
      sourceId: row.id,
      displayName: row.company_name,
      companyName: row.company_name,
      contactPerson: row.contact_person || null,
      cui: row.cui || null,
      email: row.email,
      phone: row.phone || null,
      creditLimit: row.credit_limit ? parseFloat(row.credit_limit) : null,
      creditUsed: row.credit_used ? parseFloat(row.credit_used) : null,
      discount: row.discount_percentage ? parseFloat(row.discount_percentage) : null,
      tier: row.tier || null,
      status: row.status || 'ACTIVE',
    };
  }

  /**
   * Deduplicate across sources. Priority: CUI > email > name+phone.
   * When duplicates found, prefer ERP > B2B > SmartBill.
   */
  private deduplicateCustomers(customers: UnifiedCustomer[]): UnifiedCustomer[] {
    const seen = new Map<string, UnifiedCustomer>();
    const sourcePriority: Record<CustomerSource, number> = { erp: 0, b2b: 1, smartbill: 2 };

    for (const customer of customers) {
      // Build dedup keys
      const cuiKey = customer.cui ? `cui:${customer.cui.toLowerCase().replace(/\s/g, '')}` : null;
      const emailKey = customer.email ? `email:${customer.email.toLowerCase()}` : null;
      const normalizedName = customer.displayName?.trim().toLowerCase();
      const normalizedPhone = customer.phone?.replace(/\D/g, '');
      const namePhoneKey =
        normalizedName && normalizedPhone ? `namephone:${normalizedName}:${normalizedPhone}` : null;

      let existingKey: string | null = null;

      // Check CUI first
      if (cuiKey && seen.has(cuiKey)) {
        existingKey = cuiKey;
      } else if (emailKey && seen.has(emailKey)) {
        existingKey = emailKey;
      } else if (namePhoneKey && seen.has(namePhoneKey)) {
        existingKey = namePhoneKey;
      }

      if (existingKey) {
        const existing = seen.get(existingKey)!;
        // Keep higher priority source (lower number = higher priority)
        if (sourcePriority[customer.source] < sourcePriority[existing.source]) {
          // Remove old keys
          for (const [k, v] of seen.entries()) {
            if (v.id === existing.id) seen.delete(k);
          }
          // Add new customer with all keys
          if (cuiKey) seen.set(cuiKey, customer);
          if (emailKey) seen.set(emailKey, customer);
          if (namePhoneKey) seen.set(namePhoneKey, customer);
          seen.set(customer.id, customer);
        }
        // Else keep existing (higher priority)
      } else {
        // No duplicate found
        if (cuiKey) seen.set(cuiKey, customer);
        if (emailKey) seen.set(emailKey, customer);
        if (namePhoneKey) seen.set(namePhoneKey, customer);
        seen.set(customer.id, customer);
      }
    }

    // Return unique customers
    const uniqueIds = new Set<string>();
    const result: UnifiedCustomer[] = [];
    for (const customer of seen.values()) {
      if (!uniqueIds.has(customer.id)) {
        uniqueIds.add(customer.id);
        result.push(customer);
      }
    }
    return result;
  }
}
