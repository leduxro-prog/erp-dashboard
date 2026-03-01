import { createHash } from 'crypto';

import { DataSource } from 'typeorm';

import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('inventory-product-projection');

const PROJECTION_TABLE = 'inventory_product_projection';
const REFRESH_QUEUE_TABLE = 'inventory_projection_refresh_jobs';

interface RefreshJobRow {
  id: number;
  product_ids: number[];
  attempts: number;
}

export interface ProjectionStats {
  totalRows: number;
  activeRows: number;
  staleRows: number;
  maxLagSeconds: number;
  oldestProjectedAt: string | null;
  newestProjectedAt: string | null;
}

export interface ProjectionQueueStats {
  pending: number;
  processing: number;
  retry: number;
  failed: number;
  completed: number;
  oldestPendingAt: string | null;
}

export interface ProcessQueueResult {
  picked: number;
  processed: number;
  retried: number;
  failed: number;
  recoveredStale: number;
  durationMs: number;
}

export interface ProjectionRuntimeMetrics {
  processRunsTotal: number;
  pickedTotal: number;
  processedTotal: number;
  retriedTotal: number;
  failedTotal: number;
  recoveredStaleTotal: number;
  lastDurationMs: number;
  lastRunAt: string | null;
  lastPicked: number;
  lastProcessed: number;
  lastRetried: number;
  lastFailed: number;
  lastRecoveredStale: number;
  queuePending: number;
  queueProcessing: number;
  queueRetry: number;
  queueFailed: number;
  queueCompleted: number;
  projectionMaxLagSeconds: number;
  projectionStaleRows: number;
  statsUpdatedAt: string | null;
}

export class InventoryProductProjectionService {
  private static schemaEnsured = false;
  private static schemaEnsurePromise: Promise<void> | null = null;
  private static runtimeMetrics: ProjectionRuntimeMetrics = {
    processRunsTotal: 0,
    pickedTotal: 0,
    processedTotal: 0,
    retriedTotal: 0,
    failedTotal: 0,
    recoveredStaleTotal: 0,
    lastDurationMs: 0,
    lastRunAt: null,
    lastPicked: 0,
    lastProcessed: 0,
    lastRetried: 0,
    lastFailed: 0,
    lastRecoveredStale: 0,
    queuePending: 0,
    queueProcessing: 0,
    queueRetry: 0,
    queueFailed: 0,
    queueCompleted: 0,
    projectionMaxLagSeconds: 0,
    projectionStaleRows: 0,
    statsUpdatedAt: null,
  };

  constructor(private readonly dataSource: DataSource) {}

  static getRuntimeMetricsSnapshot(): ProjectionRuntimeMetrics {
    return { ...InventoryProductProjectionService.runtimeMetrics };
  }

  static resetRuntimeMetrics(): void {
    InventoryProductProjectionService.runtimeMetrics = {
      processRunsTotal: 0,
      pickedTotal: 0,
      processedTotal: 0,
      retriedTotal: 0,
      failedTotal: 0,
      recoveredStaleTotal: 0,
      lastDurationMs: 0,
      lastRunAt: null,
      lastPicked: 0,
      lastProcessed: 0,
      lastRetried: 0,
      lastFailed: 0,
      lastRecoveredStale: 0,
      queuePending: 0,
      queueProcessing: 0,
      queueRetry: 0,
      queueFailed: 0,
      queueCompleted: 0,
      projectionMaxLagSeconds: 0,
      projectionStaleRows: 0,
      statsUpdatedAt: null,
    };
  }

  async ensureSchema(): Promise<void> {
    if (InventoryProductProjectionService.schemaEnsured) {
      return;
    }

    if (InventoryProductProjectionService.schemaEnsurePromise) {
      await InventoryProductProjectionService.schemaEnsurePromise;
      return;
    }

    InventoryProductProjectionService.schemaEnsurePromise = this.dataSource
      .query(
        `
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE TABLE IF NOT EXISTS ${PROJECTION_TABLE} (
        product_id BIGINT PRIMARY KEY,
        sku VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id BIGINT,
        category_name VARCHAR(255),
        category_root VARCHAR(120) NOT NULL,
        supplier_id BIGINT,
        supplier_name VARCHAR(255),
        base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
        margin_percentage NUMERIC(8, 2) NOT NULL DEFAULT 0,
        currency_code VARCHAR(3) NOT NULL DEFAULT 'RON',
        local_stock INTEGER NOT NULL DEFAULT 0,
        supplier_stock INTEGER NOT NULL DEFAULT 0,
        total_stock INTEGER NOT NULL DEFAULT 0,
        supplier_lead_time INTEGER NOT NULL DEFAULT 0,
        reorder_point INTEGER NOT NULL DEFAULT 0,
        stock_status VARCHAR(16) NOT NULL DEFAULT 'normal',
        primary_image_url TEXT,
        led_type VARCHAR(100),
        led_voltage INTEGER,
        led_color VARCHAR(100),
        brand VARCHAR(120),
        mounting_type VARCHAR(120),
        ip_rating VARCHAR(50),
        color_temperature INTEGER,
        search_blob TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT true,
        source_updated_at TIMESTAMPTZ,
        projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_active_name_id
        ON ${PROJECTION_TABLE} (is_active, name, product_id);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_active_category_name_id
        ON ${PROJECTION_TABLE} (is_active, category_root, name, product_id);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_stock
        ON ${PROJECTION_TABLE} (is_active, total_stock, supplier_stock, local_stock);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_prices
        ON ${PROJECTION_TABLE} (is_active, base_price, margin_percentage);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_supplier
        ON ${PROJECTION_TABLE} (supplier_id, supplier_lead_time);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_sku_trgm
        ON ${PROJECTION_TABLE} USING gin (sku gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_name_trgm
        ON ${PROJECTION_TABLE} USING gin (name gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_search_blob_trgm
        ON ${PROJECTION_TABLE} USING gin (search_blob gin_trgm_ops);

      CREATE TABLE IF NOT EXISTS ${REFRESH_QUEUE_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        dedupe_key CHAR(40) NOT NULL UNIQUE,
        source VARCHAR(80) NOT NULL DEFAULT 'unknown',
        product_ids BIGINT[] NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_projection_jobs_status_next_run
        ON ${REFRESH_QUEUE_TABLE} (status, next_run_at, id);
    `,
      )
      .then(() => {
        InventoryProductProjectionService.schemaEnsured = true;
      })
      .finally(() => {
        InventoryProductProjectionService.schemaEnsurePromise = null;
      });

    await InventoryProductProjectionService.schemaEnsurePromise;
  }

  async projectionTableExists(): Promise<boolean> {
    const raw = await this.dataSource.query(`
      SELECT to_regclass('public.${PROJECTION_TABLE}')::text AS table_name
    `);
    const rows = this.extractRows<{ table_name?: string }>(raw);
    return Boolean(rows[0]?.table_name);
  }

  async refreshAll(): Promise<void> {
    await this.ensureSchema();
    await this.refreshProjectionInternal();
  }

  async refreshByProductIds(productIds: number[]): Promise<void> {
    await this.ensureSchema();
    const normalizedIds = this.normalizeProductIds(productIds);
    if (!normalizedIds.length) {
      return;
    }

    await this.refreshProjectionInternal(normalizedIds);
  }

  async scheduleRefreshByProductIds(productIds: number[], source: string): Promise<void> {
    await this.ensureSchema();
    const normalizedIds = this.normalizeProductIds(productIds);
    if (!normalizedIds.length) {
      return;
    }

    const chunkSize = 500;

    for (let index = 0; index < normalizedIds.length; index += chunkSize) {
      const chunk = normalizedIds.slice(index, index + chunkSize);
      const dedupeKey = this.buildDedupeKey(source, chunk);

      await this.dataSource.query(
        `
          INSERT INTO ${REFRESH_QUEUE_TABLE} (
            dedupe_key,
            source,
            product_ids,
            status,
            attempts,
            next_run_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, 'pending', 0, NOW(), NOW(), NOW())
          ON CONFLICT (dedupe_key) DO UPDATE
          SET product_ids = EXCLUDED.product_ids,
              source = EXCLUDED.source,
              status = 'pending',
              next_run_at = NOW(),
              updated_at = NOW(),
              last_error = NULL
        `,
        [dedupeKey, source.slice(0, 80), chunk],
      );
    }
  }

  async processRefreshQueue(batchSize = 10, maxAttempts = 6): Promise<ProcessQueueResult> {
    const startedAt = Date.now();
    await this.ensureSchema();

    const staleProcessingSeconds = Number(
      process.env.INVENTORY_PROJECTION_STALE_PROCESSING_SEC || 300,
    );
    const staleRecoveryRaw = await this.dataSource.query(
      `
        WITH recovered AS (
          UPDATE ${REFRESH_QUEUE_TABLE}
          SET status = 'retry',
              next_run_at = NOW(),
              updated_at = NOW(),
              last_error = COALESCE(last_error, 'Recovered stale processing job')
          WHERE status = 'processing'
            AND updated_at < NOW() - ($1 * INTERVAL '1 second')
          RETURNING id
        )
        SELECT COUNT(*)::int AS recovered_stale FROM recovered
      `,
      [Math.max(30, staleProcessingSeconds)],
    );
    const staleRecoveryRows = this.extractRows<{ recovered_stale?: number }>(staleRecoveryRaw);
    const recoveredStale = Number(staleRecoveryRows[0]?.recovered_stale || 0);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    let pickedJobs: RefreshJobRow[] = [];

    try {
      await queryRunner.startTransaction();

      const rawPickedJobs = await queryRunner.query(
        `
          WITH picked AS (
            SELECT id, product_ids, attempts
            FROM ${REFRESH_QUEUE_TABLE}
            WHERE status IN ('pending', 'retry')
              AND next_run_at <= NOW()
            ORDER BY next_run_at ASC, id ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE ${REFRESH_QUEUE_TABLE} jobs
          SET status = 'processing',
              attempts = jobs.attempts + 1,
              updated_at = NOW()
          FROM picked
          WHERE jobs.id = picked.id
          RETURNING jobs.id, jobs.product_ids, jobs.attempts
        `,
        [Math.max(1, batchSize)],
      );
      pickedJobs = this.extractRows<RefreshJobRow>(rawPickedJobs);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('Failed to fetch projection refresh jobs', { error });
      const result: ProcessQueueResult = {
        picked: 0,
        processed: 0,
        retried: 0,
        failed: 0,
        recoveredStale,
        durationMs: Date.now() - startedAt,
      };
      this.recordProcessResult(result);
      return result;
    } finally {
      await queryRunner.release();
    }

    let processed = 0;
    let retried = 0;
    let failed = 0;

    for (const job of pickedJobs) {
      try {
        await this.refreshByProductIds(job.product_ids || []);

        await this.dataSource.query(
          `
            UPDATE ${REFRESH_QUEUE_TABLE}
            SET status = 'completed',
                updated_at = NOW(),
                last_error = NULL
            WHERE id = $1
          `,
          [job.id],
        );

        processed += 1;
      } catch (error) {
        const attempts = Number(job.attempts || 0);
        const retriesExceeded = attempts >= maxAttempts;
        const backoffSeconds = Math.min(900, Math.max(10, Math.pow(2, attempts) * 5));

        await this.dataSource.query(
          `
            UPDATE ${REFRESH_QUEUE_TABLE}
            SET status = $2,
                next_run_at = CASE
                  WHEN $2 = 'failed' THEN next_run_at
                  ELSE NOW() + ($3 * INTERVAL '1 second')
                END,
                last_error = $4,
                updated_at = NOW()
            WHERE id = $1
          `,
          [
            job.id,
            retriesExceeded ? 'failed' : 'retry',
            backoffSeconds,
            error instanceof Error ? error.message.slice(0, 3000) : String(error).slice(0, 3000),
          ],
        );

        logger.warn('Projection refresh job failed', {
          jobId: job.id,
          attempts,
          retriesExceeded,
          backoffSeconds,
          error,
        });

        if (retriesExceeded) {
          failed += 1;
        } else {
          retried += 1;
        }
      }
    }

    const result: ProcessQueueResult = {
      picked: pickedJobs.length,
      processed,
      retried,
      failed,
      recoveredStale,
      durationMs: Date.now() - startedAt,
    };

    this.recordProcessResult(result);
    return result;
  }

  async getProjectionStats(staleThresholdSeconds = 300): Promise<ProjectionStats> {
    await this.ensureSchema();

    const raw = await this.dataSource.query(
      `
        SELECT
          COUNT(*)::int AS total_rows,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_rows,
          COUNT(*) FILTER (
            WHERE projected_at < NOW() - ($1 * INTERVAL '1 second')
          )::int AS stale_rows,
          COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - projected_at))), 0)::int AS max_lag_seconds,
          MIN(projected_at)::text AS oldest_projected_at,
          MAX(projected_at)::text AS newest_projected_at
        FROM ${PROJECTION_TABLE}
      `,
      [Math.max(1, staleThresholdSeconds)],
    );
    const rows = this.extractRows<{
      total_rows?: number;
      active_rows?: number;
      stale_rows?: number;
      max_lag_seconds?: number;
      oldest_projected_at?: string;
      newest_projected_at?: string;
    }>(raw);

    const row = rows[0] || {};

    const result = {
      totalRows: Number(row.total_rows || 0),
      activeRows: Number(row.active_rows || 0),
      staleRows: Number(row.stale_rows || 0),
      maxLagSeconds: Number(row.max_lag_seconds || 0),
      oldestProjectedAt: row.oldest_projected_at || null,
      newestProjectedAt: row.newest_projected_at || null,
    };

    this.updateProjectionMetrics(result);
    return result;
  }

  async getQueueStats(): Promise<ProjectionQueueStats> {
    await this.ensureSchema();

    const raw = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
        COUNT(*) FILTER (WHERE status = 'retry')::int AS retry,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        MIN(CASE WHEN status IN ('pending', 'retry') THEN created_at END)::text AS oldest_pending_at
      FROM ${REFRESH_QUEUE_TABLE}
    `);
    const rows = this.extractRows<{
      pending?: number;
      processing?: number;
      retry?: number;
      failed?: number;
      completed?: number;
      oldest_pending_at?: string;
    }>(raw);

    const row = rows[0] || {};

    const result = {
      pending: Number(row.pending || 0),
      processing: Number(row.processing || 0),
      retry: Number(row.retry || 0),
      failed: Number(row.failed || 0),
      completed: Number(row.completed || 0),
      oldestPendingAt: row.oldest_pending_at || null,
    };

    this.updateQueueMetrics(result);
    return result;
  }

  async requeueFailedJobs(limit = 500): Promise<number> {
    await this.ensureSchema();

    const raw = await this.dataSource.query(
      `
        WITH picked AS (
          SELECT id
          FROM ${REFRESH_QUEUE_TABLE}
          WHERE status = 'failed'
          ORDER BY updated_at DESC
          LIMIT $1
        )
        UPDATE ${REFRESH_QUEUE_TABLE} jobs
        SET status = 'pending',
            next_run_at = NOW(),
            last_error = NULL,
            updated_at = NOW()
        FROM picked
        WHERE jobs.id = picked.id
        RETURNING jobs.id
      `,
      [Math.max(1, limit)],
    );
    const rows = this.extractRows<{ id: number }>(raw);

    return rows.length;
  }

  private normalizeProductIds(productIds: number[]): number[] {
    return Array.from(
      new Set(
        productIds
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ).sort((left, right) => left - right);
  }

  private buildDedupeKey(source: string, productIds: number[]): string {
    const payload = `${source}:${productIds.join(',')}`;
    return createHash('sha1').update(payload).digest('hex');
  }

  private getCategoryRootSqlExpression(): string {
    const categoryText =
      "LOWER(COALESCE(c.name, '') || ' ' || COALESCE(p.name, '') || ' ' || COALESCE(p.sku, ''))";

    return `
      CASE
        WHEN ${categoryText} LIKE '%cctv%'
          OR ${categoryText} LIKE '%camera%'
          OR ${categoryText} LIKE '%kamery%'
          OR ${categoryText} LIKE '%nvr%'
          OR ${categoryText} LIKE '%xvr%'
          OR ${categoryText} LIKE '%dvr%'
          OR ${categoryText} LIKE '%rejestr%'
          THEN 'Securitate CCTV'
        WHEN ${categoryText} LIKE '%pv%'
          OR ${categoryText} LIKE '%fotovolta%'
          OR ${categoryText} LIKE '%solar%'
          OR ${categoryText} LIKE '%falown%'
          OR ${categoryText} LIKE '%inverter%'
          OR ${categoryText} LIKE '%inverto%'
          OR ${categoryText} LIKE '%microinverter%'
          THEN 'Fotovoltaice'
        WHEN ${categoryText} LIKE '%profil%'
          OR ${categoryText} LIKE '%profile%'
          OR ${categoryText} LIKE '%alulicht%'
          OR ${categoryText} LIKE '%helios profile%'
          THEN 'Profile LED'
        WHEN ${categoryText} LIKE '%benzi%'
          OR ${categoryText} LIKE '%banda%'
          OR ${categoryText} LIKE '%strip%'
          OR ${categoryText} LIKE '%backlight%'
          OR ${categoryText} LIKE '%led neon%'
          OR ${categoryText} LIKE '%cob%'
          OR ${categoryText} LIKE '%rgb%'
          THEN 'Benzi LED'
        WHEN ${categoryText} LIKE '%sursa%'
          OR ${categoryText} LIKE '%alimentator%'
          OR ${categoryText} LIKE '%driver%'
          OR ${categoryText} LIKE '%power supply%'
          OR ${categoryText} LIKE '%gpv%'
          OR ${categoryText} LIKE '%gpc%'
          OR ${categoryText} LIKE '%din%'
          OR ${categoryText} LIKE '%cliq%'
          OR ${categoryText} LIKE '%adin%'
          OR ${categoryText} LIKE '%adws%'
          OR ${categoryText} LIKE '%adls%'
          OR ${categoryText} LIKE '%mchq%'
          OR ${categoryText} LIKE '%ftpc%'
          OR ${categoryText} LIKE '%pos %'
          OR ${categoryText} LIKE '%adapter%'
          OR ${categoryText} LIKE '%desktop%'
          OR ${categoryText} LIKE '%delta%'
          OR ${categoryText} LIKE '%hqs%'
          OR ${categoryText} LIKE '%lyte%'
          OR ${categoryText} LIKE '%mnc%'
          OR ${categoryText} LIKE '%force-gt%'
          OR ${categoryText} LIKE '%gv6%'
          OR ${categoryText} LIKE '%dl2%'
          OR ${categoryText} LIKE '%ds2%'
          OR ${categoryText} LIKE '%af series%'
          OR ${categoryText} LIKE '%ay series%'
          OR ${categoryText} LIKE '%aca lighting%'
          THEN 'Surse si Drivere'
        WHEN ${categoryText} LIKE '%bec%'
          OR ${categoryText} LIKE '%bulb%'
          OR ${categoryText} LIKE '%tub%'
          OR ${categoryText} LIKE '%t8%'
          OR ${categoryText} LIKE '%t5%'
          OR ${categoryText} LIKE '%e27%'
          OR ${categoryText} LIKE '%e14%'
          OR ${categoryText} LIKE '%gu10%'
          THEN 'Becuri si Tuburi LED'
        WHEN ${categoryText} LIKE '%automat%'
          OR ${categoryText} LIKE '%smart%'
          OR ${categoryText} LIKE '%zigbee%'
          OR ${categoryText} LIKE '%sensor%'
          OR ${categoryText} LIKE '%senzor%'
          OR ${categoryText} LIKE '%controler%'
          OR ${categoryText} LIKE '%controller%'
          OR ${categoryText} LIKE '%mi-light%'
          OR ${categoryText} LIKE '%gateway%'
          OR ${categoryText} LIKE '%bramki%'
          THEN 'Automatizari si Smart'
        WHEN ${categoryText} LIKE '%cablu%'
          OR ${categoryText} LIKE '%kable%'
          OR ${categoryText} LIKE '%priza%'
          OR ${categoryText} LIKE '%intrerup%'
          OR ${categoryText} LIKE '%sigurant%'
          OR ${categoryText} LIKE '%tablou%'
          OR ${categoryText} LIKE '%elektr%'
          OR ${categoryText} LIKE '%electr%'
          THEN 'Materiale Electrice'
        WHEN ${categoryText} LIKE '%proiector%'
          OR ${categoryText} LIKE '%flood%'
          OR ${categoryText} LIKE '%exterior%'
          OR ${categoryText} LIKE '%outdoor%'
          OR ${categoryText} LIKE '%garden%'
          OR ${categoryText} LIKE '%stradal%'
          OR ${categoryText} LIKE '%ip65%'
          OR ${categoryText} LIKE '%ip66%'
          OR ${categoryText} LIKE '%ip67%'
          THEN 'Iluminat Exterior'
        WHEN ${categoryText} LIKE '%industrial%'
          OR ${categoryText} LIKE '%highbay%'
          OR ${categoryText} LIKE '%depozit%'
          OR ${categoryText} LIKE '%hala%'
          OR ${categoryText} LIKE '%emergenc%'
          THEN 'Iluminat Industrial'
        WHEN ${categoryText} LIKE '%spot%'
          OR ${categoryText} LIKE '%downlight%'
          OR ${categoryText} LIKE '%panel%'
          OR ${categoryText} LIKE '%panou%'
          OR ${categoryText} LIKE '%lustra%'
          OR ${categoryText} LIKE '%pendul%'
          OR ${categoryText} LIKE '%aplica%'
          OR ${categoryText} LIKE '%plafon%'
          OR ${categoryText} LIKE '%track%'
          OR ${categoryText} LIKE '%azzardo%'
          THEN 'Iluminat Interior'
        ELSE 'Diverse'
      END
    `;
  }

  private async refreshProjectionInternal(productIds?: number[]): Promise<void> {
    const startedAt = Date.now();
    const hasFilter = Array.isArray(productIds) && productIds.length > 0;
    const params = hasFilter ? [productIds] : [];
    const productFilter = hasFilter ? 'AND p.id = ANY($1::BIGINT[])' : '';
    const categoryRootSql = this.getCategoryRootSqlExpression();

    await this.dataSource.query(
      `
        WITH local_stock AS (
          SELECT
            sl.product_id,
            SUM(sl.quantity_available) AS quantity_available,
            MAX(sl.reorder_point) AS reorder_point,
            MAX(sl.updated_at) AS updated_at
          FROM stock_levels sl
          JOIN warehouses sw ON sw.id = sl.warehouse_id
          WHERE sw.is_active = true
            AND (sw.code ILIKE 'SB-%' OR sw.name ILIKE 'magazin')
          GROUP BY sl.product_id
        ),
        supplier_stock AS (
          SELECT
            sc.product_id,
            SUM(sc.quantity_available) AS supplier_stock,
            MIN(sc.lead_time_days) AS supplier_lead_time,
            MAX(sc.last_updated) AS last_updated
          FROM supplier_stock_cache sc
          WHERE sc.is_available = true
          GROUP BY sc.product_id
        ),
        primary_image AS (
          SELECT DISTINCT ON (img.product_id)
            img.product_id,
            img.image_url
          FROM product_images img
          WHERE img.is_primary = true
          ORDER BY img.product_id, img.sort_order ASC, img.id ASC
        )
        INSERT INTO ${PROJECTION_TABLE} (
          product_id,
          sku,
          name,
          description,
          category_id,
          category_name,
          category_root,
          supplier_id,
          supplier_name,
          base_price,
          cost,
          margin_percentage,
          currency_code,
          local_stock,
          supplier_stock,
          total_stock,
          supplier_lead_time,
          reorder_point,
          stock_status,
          primary_image_url,
          led_type,
          led_voltage,
          led_color,
          brand,
          mounting_type,
          ip_rating,
          color_temperature,
          search_blob,
          is_active,
          source_updated_at,
          projected_at
        )
        SELECT
          p.id,
          COALESCE(p.sku, ''),
          COALESCE(p.name, ''),
          p.description,
          p.category_id,
          c.name,
          ${categoryRootSql},
          p.supplier_id,
          s.name,
          COALESCE(p.base_price, 0),
          COALESCE(p.cost, 0),
          COALESCE(p.margin_percentage, 0),
          COALESCE(p.currency_code, 'RON'),
          COALESCE(ls.quantity_available, 0),
          COALESCE(ss.supplier_stock, 0),
          COALESCE(ls.quantity_available, 0) + COALESCE(ss.supplier_stock, 0),
          COALESCE(ss.supplier_lead_time, 0),
          COALESCE(ls.reorder_point, 0),
          CASE
            WHEN COALESCE(ls.quantity_available, 0) + COALESCE(ss.supplier_stock, 0) <= 0 THEN 'critical'
            WHEN COALESCE(ls.reorder_point, 0) > 0
              AND COALESCE(ls.quantity_available, 0) + COALESCE(ss.supplier_stock, 0) <= COALESCE(ls.reorder_point, 0)
              THEN 'warning'
            ELSE 'normal'
          END,
          pi.image_url,
          p.led_type,
          p.led_voltage,
          p.led_color,
          ps.brand,
          ps.mounting_type,
          ps.ip_rating,
          ps.color_temperature,
          LOWER(TRIM(CONCAT_WS(
            ' ',
            COALESCE(p.sku, ''),
            COALESCE(p.name, ''),
            COALESCE(p.description, ''),
            COALESCE(c.name, ''),
            COALESCE(s.name, ''),
            COALESCE(p.led_type, ''),
            COALESCE(p.led_color, ''),
            COALESCE(ps.brand, ''),
            COALESCE(ps.mounting_type, ''),
            COALESCE(ps.ip_rating, ''),
            COALESCE(ps.color_temperature::text, '')
          ))),
          p.is_active,
          GREATEST(
            COALESCE(p.updated_at, NOW()),
            COALESCE(ps.updated_at, TO_TIMESTAMP(0)),
            COALESCE(ls.updated_at, TO_TIMESTAMP(0)),
            COALESCE(ss.last_updated, TO_TIMESTAMP(0))
          ),
          NOW()
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN local_stock ls ON ls.product_id = p.id
        LEFT JOIN supplier_stock ss ON ss.product_id = p.id
        LEFT JOIN primary_image pi ON pi.product_id = p.id
        WHERE p.deleted_at IS NULL
          ${productFilter}
        ON CONFLICT (product_id) DO UPDATE
        SET sku = EXCLUDED.sku,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category_id = EXCLUDED.category_id,
            category_name = EXCLUDED.category_name,
            category_root = EXCLUDED.category_root,
            supplier_id = EXCLUDED.supplier_id,
            supplier_name = EXCLUDED.supplier_name,
            base_price = EXCLUDED.base_price,
            cost = EXCLUDED.cost,
            margin_percentage = EXCLUDED.margin_percentage,
            currency_code = EXCLUDED.currency_code,
            local_stock = EXCLUDED.local_stock,
            supplier_stock = EXCLUDED.supplier_stock,
            total_stock = EXCLUDED.total_stock,
            supplier_lead_time = EXCLUDED.supplier_lead_time,
            reorder_point = EXCLUDED.reorder_point,
            stock_status = EXCLUDED.stock_status,
            primary_image_url = EXCLUDED.primary_image_url,
            led_type = EXCLUDED.led_type,
            led_voltage = EXCLUDED.led_voltage,
            led_color = EXCLUDED.led_color,
            brand = EXCLUDED.brand,
            mounting_type = EXCLUDED.mounting_type,
            ip_rating = EXCLUDED.ip_rating,
            color_temperature = EXCLUDED.color_temperature,
            search_blob = EXCLUDED.search_blob,
            is_active = EXCLUDED.is_active,
            source_updated_at = EXCLUDED.source_updated_at,
            projected_at = NOW()
      `,
      params,
    );

    if (hasFilter && productIds) {
      await this.dataSource.query(
        `
          DELETE FROM ${PROJECTION_TABLE} ip
          WHERE ip.product_id = ANY($1::BIGINT[])
            AND NOT EXISTS (
              SELECT 1
              FROM products p
              WHERE p.id = ip.product_id
                AND p.deleted_at IS NULL
            )
        `,
        [productIds],
      );
    } else {
      await this.dataSource.query(
        `
          DELETE FROM ${PROJECTION_TABLE} ip
          WHERE NOT EXISTS (
            SELECT 1
            FROM products p
            WHERE p.id = ip.product_id
              AND p.deleted_at IS NULL
          )
        `,
      );
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 800) {
      logger.warn('Projection refresh slow query', {
        elapsedMs,
        mode: hasFilter ? 'incremental' : 'full',
        productCount: hasFilter ? productIds?.length || 0 : null,
      });
    } else {
      logger.debug('Projection refresh completed', {
        elapsedMs,
        mode: hasFilter ? 'incremental' : 'full',
        productCount: hasFilter ? productIds?.length || 0 : null,
      });
    }
  }

  private extractRows<T = any>(raw: any): T[] {
    if (Array.isArray(raw)) {
      if (raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
        return raw[0] as T[];
      }

      if (raw.length > 0 && Array.isArray(raw[0]) && raw.every((value) => Array.isArray(value))) {
        return raw.flat() as T[];
      }

      if (raw.length > 0 && !Array.isArray(raw[0]) && typeof raw[0] === 'object') {
        return raw as T[];
      }
    }

    return [];
  }

  private recordProcessResult(result: ProcessQueueResult): void {
    const metrics = InventoryProductProjectionService.runtimeMetrics;
    metrics.processRunsTotal += 1;
    metrics.pickedTotal += result.picked;
    metrics.processedTotal += result.processed;
    metrics.retriedTotal += result.retried;
    metrics.failedTotal += result.failed;
    metrics.recoveredStaleTotal += result.recoveredStale;
    metrics.lastDurationMs = result.durationMs;
    metrics.lastRunAt = new Date().toISOString();
    metrics.lastPicked = result.picked;
    metrics.lastProcessed = result.processed;
    metrics.lastRetried = result.retried;
    metrics.lastFailed = result.failed;
    metrics.lastRecoveredStale = result.recoveredStale;
  }

  private updateQueueMetrics(queue: ProjectionQueueStats): void {
    const metrics = InventoryProductProjectionService.runtimeMetrics;
    metrics.queuePending = queue.pending;
    metrics.queueProcessing = queue.processing;
    metrics.queueRetry = queue.retry;
    metrics.queueFailed = queue.failed;
    metrics.queueCompleted = queue.completed;
    metrics.statsUpdatedAt = new Date().toISOString();
  }

  private updateProjectionMetrics(projection: ProjectionStats): void {
    const metrics = InventoryProductProjectionService.runtimeMetrics;
    metrics.projectionMaxLagSeconds = projection.maxLagSeconds;
    metrics.projectionStaleRows = projection.staleRows;
    metrics.statsUpdatedAt = new Date().toISOString();
  }
}
