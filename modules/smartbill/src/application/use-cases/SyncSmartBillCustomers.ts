/**
 * SyncSmartBillCustomers Use Case
 *
 * Syncs customer data from SmartBill invoices into the customer_external_links table.
 * SmartBill does not have a dedicated "list clients" API - customers are extracted
 * from invoice data (companyName, companyVat fields).
 *
 * Also attempts to match SmartBill clients to existing ERP customers by CUI/email.
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('SyncSmartBillCustomers');

export interface SyncResult {
  totalProcessed: number;
  newLinks: number;
  updatedLinks: number;
  matchedToErp: number;
  conflicts: Array<{
    externalId: string;
    name: string;
    reason: string;
  }>;
}

export class SyncSmartBillCustomers {
  constructor(
    private readonly dataSource: DataSource,
    private readonly apiClient: any, // SmartBillApiClient
    private readonly eventPublisher?: (event: string, data: unknown) => Promise<void>,
  ) {}

  /**
   * Sync customers from SmartBill invoices for a date range.
   * Default: last 365 days.
   */
  async execute(options?: { startDate?: string; endDate?: string }): Promise<SyncResult> {
    const endDate = options?.endDate || new Date().toISOString().split('T')[0];
    const startDateDefault = new Date();
    startDateDefault.setFullYear(startDateDefault.getFullYear() - 1);
    const startDate = options?.startDate || startDateDefault.toISOString().split('T')[0];

    logger.info('Starting SmartBill customer sync', { startDate, endDate });

    const result: SyncResult = {
      totalProcessed: 0,
      newLinks: 0,
      updatedLinks: 0,
      matchedToErp: 0,
      conflicts: [],
    };

    try {
      // Fetch invoices from SmartBill
      const invoices = await this.apiClient.listInvoices({ startDate, endDate });

      // Extract unique customers (deduplicate by CUI/VAT)
      const customerMap = new Map<
        string,
        {
          name: string;
          vatCode: string;
          email?: string;
          phone?: string;
          address?: string;
          regCom?: string;
        }
      >();

      for (const invoice of invoices) {
        const vatCode = invoice.client?.vatCode || invoice.companyVatCode || '';
        const name = invoice.client?.name || invoice.companyName || '';

        if (!vatCode && !name) continue;

        const key = vatCode || `name:${name.toLowerCase()}`;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            name,
            vatCode,
            email: invoice.client?.email || '',
            phone: invoice.client?.phone || '',
            address: invoice.client?.address || '',
            regCom: invoice.client?.regCom || '',
          });
        }
      }

      logger.info(
        `Extracted ${customerMap.size} unique customers from ${invoices.length} invoices`,
      );

      // Upsert each customer into customer_external_links
      for (const [key, customer] of customerMap) {
        result.totalProcessed++;

        const externalId = customer.vatCode || key;
        const externalData = JSON.stringify(customer);

        try {
          // Check if link already exists
          const existing = await this.dataSource.query(
            `SELECT id, customer_id, external_data FROM customer_external_links
             WHERE provider = 'smartbill' AND external_id = $1`,
            [externalId],
          );

          if (existing.length > 0) {
            // Update existing link
            await this.dataSource.query(
              `UPDATE customer_external_links
               SET external_data = $1, last_sync_at = NOW(), updated_at = NOW(), sync_status = 'synced'
               WHERE id = $2`,
              [externalData, existing[0].id],
            );
            result.updatedLinks++;
          } else {
            // Try to match to ERP customer by CUI
            let customerId: number | null = null;

            if (customer.vatCode) {
              const cuiMatch = await this.dataSource.query(
                `SELECT id FROM customers
                 WHERE tax_identification_number = $1 AND deleted_at IS NULL
                 LIMIT 1`,
                [customer.vatCode],
              );
              if (cuiMatch.length > 0) {
                customerId = cuiMatch[0].id;
                result.matchedToErp++;
              }
            }

            // If no CUI match, try email
            if (!customerId && customer.email) {
              const emailMatch = await this.dataSource.query(
                `SELECT id FROM customers
                 WHERE email = $1 AND deleted_at IS NULL
                 LIMIT 1`,
                [customer.email],
              );
              if (emailMatch.length > 0) {
                customerId = emailMatch[0].id;
                result.matchedToErp++;
              }
            }

            // Check for conflict: CUI exists in ERP but different email
            if (customerId && customer.email) {
              const erpCustomer = await this.dataSource.query(
                `SELECT email FROM customers WHERE id = $1`,
                [customerId],
              );
              if (
                erpCustomer.length > 0 &&
                customer.email &&
                erpCustomer[0].email &&
                erpCustomer[0].email.toLowerCase() !== customer.email.toLowerCase()
              ) {
                result.conflicts.push({
                  externalId,
                  name: customer.name,
                  reason: `CUI match but email differs: SmartBill="${customer.email}" vs ERP="${erpCustomer[0].email}"`,
                });
              }
            }

            // Insert new link
            await this.dataSource.query(
              `INSERT INTO customer_external_links
               (customer_id, provider, external_id, external_data, sync_status, last_sync_at, created_at, updated_at)
               VALUES ($1, 'smartbill', $2, $3, 'synced', NOW(), NOW(), NOW())
               ON CONFLICT (provider, external_id) DO UPDATE
               SET external_data = $3, last_sync_at = NOW(), updated_at = NOW()`,
              [customerId, externalId, externalData],
            );
            result.newLinks++;
          }
        } catch (err) {
          logger.error(`Failed to sync SmartBill customer ${customer.name}`, err);
        }
      }

      // Publish sync event
      if (this.eventPublisher) {
        await this.eventPublisher('smartbill.customers_synced', {
          totalProcessed: result.totalProcessed,
          newLinks: result.newLinks,
          updatedLinks: result.updatedLinks,
          matchedToErp: result.matchedToErp,
          conflicts: result.conflicts.length,
        });
      }

      logger.info('SmartBill customer sync completed', result);
    } catch (err) {
      logger.error('SmartBill customer sync failed', err);
      throw err;
    }

    return result;
  }
}
