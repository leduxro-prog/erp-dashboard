import { DataSource } from 'typeorm';

import {
  DateWindow,
  ISalesReadModelRepository,
  SalesReadModelDocumentUpsert,
} from '../../application/ports/ISalesReadModelRepository';

export class TypeOrmSalesReadModelRepository implements ISalesReadModelRepository {
  constructor(private readonly dataSource: DataSource) {}

  async upsertDocuments(documents: SalesReadModelDocumentUpsert[]): Promise<number> {
    if (documents.length === 0) {
      return 0;
    }

    const rows = await this.dataSource.query(
      `
      INSERT INTO smartbill_sales_documents (
        document_key,
        document_type,
        smartbill_id,
        series,
        number,
        issue_date,
        due_date,
        customer_name,
        customer_vat,
        currency,
        total_without_vat,
        vat_amount,
        total_with_vat,
        payload,
        source_updated_at,
        ingested_at,
        updated_at
      )
      SELECT
        data.document_key,
        data.document_type,
        NULLIF(data.smartbill_id, ''),
        NULLIF(data.series, ''),
        NULLIF(data.number, ''),
        data.issue_date::date,
        NULLIF(data.due_date, '')::date,
        NULLIF(data.customer_name, ''),
        NULLIF(data.customer_vat, ''),
        COALESCE(NULLIF(data.currency, ''), 'RON'),
        data.total_without_vat::numeric(14, 2),
        data.vat_amount::numeric(14, 2),
        data.total_with_vat::numeric(14, 2),
        COALESCE(data.payload, '{}'::jsonb),
        CASE
          WHEN data.source_updated_at IS NULL OR data.source_updated_at = '' THEN NULL
          ELSE data.source_updated_at::timestamptz
        END,
        now(),
        now()
      FROM jsonb_to_recordset($1::jsonb) AS data(
        document_key text,
        document_type text,
        smartbill_id text,
        series text,
        number text,
        issue_date text,
        due_date text,
        customer_name text,
        customer_vat text,
        currency text,
        total_without_vat numeric,
        vat_amount numeric,
        total_with_vat numeric,
        payload jsonb,
        source_updated_at text
      )
      ON CONFLICT (document_key) DO UPDATE
      SET
        document_type = EXCLUDED.document_type,
        smartbill_id = EXCLUDED.smartbill_id,
        series = EXCLUDED.series,
        number = EXCLUDED.number,
        issue_date = EXCLUDED.issue_date,
        due_date = EXCLUDED.due_date,
        customer_name = EXCLUDED.customer_name,
        customer_vat = EXCLUDED.customer_vat,
        currency = EXCLUDED.currency,
        total_without_vat = EXCLUDED.total_without_vat,
        vat_amount = EXCLUDED.vat_amount,
        total_with_vat = EXCLUDED.total_with_vat,
        payload = EXCLUDED.payload,
        source_updated_at = EXCLUDED.source_updated_at,
        ingested_at = now(),
        updated_at = now()
      RETURNING document_key
      `,
      [JSON.stringify(documents)],
    );

    return rows.length;
  }

  async rebuildDailyAggregates(window: DateWindow): Promise<number> {
    let insertedRows = 0;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `
        DELETE FROM sales_kpi_daily
        WHERE period_date BETWEEN $1::date AND $2::date
        `,
        [window.startDate, window.endDate],
      );

      const rows = await manager.query(
        `
        INSERT INTO sales_kpi_daily (
          period_date,
          orders_count,
          customers_count,
          total_revenue,
          total_without_vat,
          vat_amount,
          average_order_value,
          currency,
          top_products,
          computed_at,
          created_at,
          updated_at
        )
        SELECT
          issue_date AS period_date,
          COUNT(*)::integer AS orders_count,
          COUNT(DISTINCT COALESCE(NULLIF(customer_vat, ''), NULLIF(customer_name, ''), document_key))::integer AS customers_count,
          COALESCE(SUM(total_with_vat), 0)::numeric(14, 2) AS total_revenue,
          COALESCE(SUM(total_without_vat), 0)::numeric(14, 2) AS total_without_vat,
          COALESCE(SUM(vat_amount), 0)::numeric(14, 2) AS vat_amount,
          CASE
            WHEN COUNT(*) = 0 THEN 0::numeric(14, 2)
            ELSE (SUM(total_with_vat) / COUNT(*))::numeric(14, 2)
          END AS average_order_value,
          currency,
          '[]'::jsonb,
          now(),
          now(),
          now()
        FROM smartbill_sales_documents
        WHERE issue_date BETWEEN $1::date AND $2::date
        GROUP BY issue_date, currency
        ORDER BY issue_date, currency
        RETURNING period_date
        `,
        [window.startDate, window.endDate],
      );

      insertedRows = rows.length;
    });

    return insertedRows;
  }
}
