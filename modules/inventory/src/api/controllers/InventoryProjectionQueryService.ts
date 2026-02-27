import { DataSource } from 'typeorm';

import { getReadDataSource } from '@shared/database/read-replica-manager';
import { InventoryProductProjectionService } from '@shared/read-model/InventoryProductProjectionService';

import { InventoryControllerHelpers, type InventoryCursor } from './InventoryControllerHelpers';

export interface StockLevelsProjectionQueryOptions {
  dataSource: DataSource;
  page: number;
  limit: number;
  offset: number;
  search: string;
  category: string;
  stripTypes: string[];
  ledVoltages: number[];
  lightColors: string[];
  kelvinFilters: string[];
  ipFilters: string[];
  brandFilters: string[];
  mountingTypeFilters: string[];
  protocolFilters: string[];
  cctvResolutionFilters: string[];
  stockStatus: '' | 'normal' | 'warning' | 'critical';
  isCursorMode: boolean;
  cursorData: InventoryCursor | null;
  cursorToken: string;
  cursorDirection: 'next' | 'prev';
  fetchDirection: 'ASC' | 'DESC';
  effectiveLimit: number;
}

interface WarnLogger {
  warn: (message: string, data: Record<string, unknown>) => void;
}

export class InventoryProjectionQueryService {
  constructor(
    private readonly helpers: InventoryControllerHelpers,
    private readonly logger: WarnLogger,
  ) {}

  async getStockLevelsFromProjection(options: StockLevelsProjectionQueryOptions): Promise<any | null> {
    const startedAt = Date.now();
    const readDataSource = getReadDataSource(options.dataSource);
    const projectionService = new InventoryProductProjectionService(options.dataSource);
    const projectionExists = await projectionService.projectionTableExists();

    if (!projectionExists) {
      return null;
    }

    const baseParams: any[] = [];
    const baseConditions: string[] = ['ip.is_active = true'];
    const searchBlobSql = "COALESCE(ip.search_blob, '')";

    const addBaseParam = (value: any): string => {
      baseParams.push(value);
      return `$${baseParams.length}`;
    };

    if (options.search) {
      const value = `%${options.search}%`;
      const param = addBaseParam(value);
      baseConditions.push(
        `(ip.sku ILIKE ${param} OR ip.name ILIKE ${param} OR ${searchBlobSql} ILIKE ${param})`,
      );
    }

    if (options.category) {
      const param = addBaseParam(`%${options.category}%`);
      baseConditions.push(`(ip.category_root ILIKE ${param} OR ip.category_name ILIKE ${param})`);
    }

    if (options.stripTypes.length > 0) {
      const patterns = options.stripTypes
        .map((value) => {
          if (value === 'smd') {
            return '(^|[^a-z0-9])smd(?:\\s*\\d{3,4})?([^a-z0-9]|$)';
          }
          if (value === 'cob') {
            return '(^|[^a-z0-9])cob([^a-z0-9]|$)';
          }
          return `(^|[^a-z0-9])${value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`;
        })
        .filter((pattern) => pattern.length > 0);

      if (patterns.length > 0) {
        const clauses = patterns.map((pattern) => {
          const param = addBaseParam(pattern);
          return `(LOWER(COALESCE(ip.led_type, '')) ~* ${param} OR ${searchBlobSql} ~* ${param})`;
        });

        baseConditions.push(`(${clauses.join(' OR ')})`);
      }
    }

    if (options.ledVoltages.length > 0) {
      const clauses = options.ledVoltages.map((voltage) => {
        const voltageParam = addBaseParam(voltage);
        const regexParam = addBaseParam(`(^|[^0-9])${voltage}\\s*v([^0-9]|$)`);
        return `(ip.led_voltage = ${voltageParam} OR ${searchBlobSql} ~* ${regexParam})`;
      });
      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.lightColors.length > 0) {
      const clauses = options.lightColors.map((value) => {
        if (/^\d{4}$/.test(value)) {
          const likeParam = addBaseParam(`%${value}%`);
          const exactParam = addBaseParam(value);
          const regexParam = addBaseParam(`(^|[^0-9])${value}\\s*k([^0-9]|$)`);
          return `(
            LOWER(COALESCE(ip.led_color, '')) ILIKE ${likeParam}
            OR ${searchBlobSql} ILIKE ${likeParam}
            OR COALESCE(ip.color_temperature::text, '') = ${exactParam}
            OR ${searchBlobSql} ~* ${regexParam}
          )`;
        }

        const likeParam = addBaseParam(`%${value}%`);
        return `(
          LOWER(COALESCE(ip.led_color, '')) ILIKE ${likeParam}
          OR ${searchBlobSql} ILIKE ${likeParam}
        )`;
      });
      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.kelvinFilters.length > 0) {
      const clauses = options.kelvinFilters.map((value) => {
        const likeParam = addBaseParam(`%${value}%`);
        const exactParam = addBaseParam(value);
        const regexParam = addBaseParam(`(^|[^0-9])${value}\\s*k([^0-9]|$)`);

        return `(
          COALESCE(ip.color_temperature::text, '') = ${exactParam}
          OR ${searchBlobSql} ILIKE ${likeParam}
          OR ${searchBlobSql} ~* ${regexParam}
          OR LOWER(COALESCE(ip.led_color, '')) ILIKE ${likeParam}
        )`;
      });
      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.ipFilters.length > 0) {
      const clauses = options.ipFilters.map((value) => {
        const exactParam = addBaseParam(value);
        const likeParam = addBaseParam(`%${value.toLowerCase()}%`);
        return `(
          UPPER(COALESCE(ip.ip_rating, '')) = ${exactParam}
          OR ${searchBlobSql} ILIKE ${likeParam}
        )`;
      });

      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.brandFilters.length > 0) {
      const clauses = options.brandFilters.map((value) => {
        const param = addBaseParam(value);
        return `(
          LOWER(COALESCE(ip.brand, '')) = ${param}
          OR LOWER(COALESCE(ip.supplier_name, '')) = ${param}
        )`;
      });
      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.mountingTypeFilters.length > 0) {
      const clauses = options.mountingTypeFilters.map((value) => {
        const param = addBaseParam(value);
        return `LOWER(COALESCE(ip.mounting_type, '')) = ${param}`;
      });
      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.protocolFilters.length > 0) {
      const clauses = options.protocolFilters.map((value) => {
        const pattern = `(^|[^a-z0-9])${value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`;
        const param = addBaseParam(pattern);
        return `${searchBlobSql} ~* ${param}`;
      });
      baseConditions.push(`(${clauses.join(' OR ')})`);
    }

    if (options.cctvResolutionFilters.length > 0) {
      const patterns = options.cctvResolutionFilters
        .map((value) => value.replace(/\s+/g, '').replace('megapixel', 'mp'))
        .map((value) => {
          const numeric = value.replace(/[^0-9]/g, '');
          if (!numeric) {
            return '';
          }
          return `(^|[^0-9])${numeric}\\s*mp([^a-z0-9]|$)`;
        })
        .filter((value) => value.length > 0);

      if (patterns.length > 0) {
        const clauses = patterns.map((pattern) => {
          const param = addBaseParam(pattern);
          return `${searchBlobSql} ~* ${param}`;
        });
        baseConditions.push(`(${clauses.join(' OR ')})`);
      }
    }

    if (options.stockStatus) {
      const param = addBaseParam(options.stockStatus);
      baseConditions.push(`LOWER(COALESCE(ip.stock_status, 'normal')) = ${param}`);
    }

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM inventory_product_projection ip
      WHERE ${baseConditions.join(' AND ')}
    `;

    const countResult = await readDataSource.query(countQuery, baseParams);
    const total = Number(countResult[0]?.total || 0);

    const listParams = [...baseParams];
    const listConditions = [...baseConditions];
    const addListParam = (value: any): string => {
      listParams.push(value);
      return `$${listParams.length}`;
    };

    if (options.isCursorMode && options.cursorData) {
      const comparator = options.fetchDirection === 'ASC' ? '>' : '<';
      const cursorName = this.helpers.normalizeCursorName(options.cursorData.name);
      const nameParam = addListParam(cursorName);
      const idParam = addListParam(options.cursorData.id);

      listConditions.push(`(
        COALESCE(ip.name, '') ${comparator} ${nameParam}
        OR (
          COALESCE(ip.name, '') = ${nameParam}
          AND ip.product_id ${comparator} ${idParam}
        )
      )`);
    }

    let paginationClause = '';
    if (options.isCursorMode) {
      const limitParam = addListParam(options.effectiveLimit);
      paginationClause = `LIMIT ${limitParam}`;
    } else {
      const limitParam = addListParam(options.effectiveLimit);
      const offsetParam = addListParam(options.offset);
      paginationClause = `LIMIT ${limitParam} OFFSET ${offsetParam}`;
    }

    const rows = await readDataSource.query(
      `
        SELECT
          ip.product_id,
          ip.sku,
          ip.name AS product_name,
          ip.category_id,
          ip.category_name,
          ip.category_root,
          ip.base_price,
          ip.primary_image_url,
          ip.local_stock,
          ip.supplier_stock,
          ip.total_stock,
          ip.supplier_lead_time,
          ip.reorder_point,
          ip.stock_status,
          ip.source_updated_at,
          ps.brand,
          ps.mounting_type,
          ps.ip_rating,
          ps.color_temperature,
          ps.wattage,
          ps.lumens,
          ps.cri,
          ps.beam_angle,
          ps.voltage_input,
          ps.installation_guide_url,
          ps.datasheet_url,
          ps.custom_specs
        FROM inventory_product_projection ip
        LEFT JOIN product_specifications ps ON ps.product_id = ip.product_id
        WHERE ${listConditions.join(' AND ')}
        ORDER BY COALESCE(ip.name, '') ${options.fetchDirection}, ip.product_id ${options.fetchDirection}
        ${paginationClause}
      `,
      listParams,
    );

    const hasOverflowRow = options.isCursorMode && rows.length > options.limit;
    const pageRows = options.isCursorMode ? rows.slice(0, options.limit) : rows;

    if (options.isCursorMode && options.fetchDirection === 'DESC') {
      pageRows.reverse();
    }

    const mappedItems = pageRows.map((row: any) => {
      const categoryName =
        String(row.category_root || '').trim() ||
        this.helpers.normalizeCatalogCategory(row.category_name, row.product_name, row.sku);
      const subcategoryName = this.helpers.normalizeCatalogSubcategory(row.category_name, categoryName);

      return {
        id: Number(row.product_id),
        productId: Number(row.product_id),
        sku: row.sku || `ID-${row.product_id}`,
        name: row.product_name || 'Unknown',
        categoryId: row.category_id ? Number(row.category_id) : null,
        categoryName,
        subcategoryName: subcategoryName || null,
        price: parseFloat(row.base_price) || 0,
        imageUrl: row.primary_image_url || null,
        warehouseId: 1,
        warehouseName: 'Principal',
        current: Number(row.local_stock || 0),
        reserved: 0,
        available: Number(row.local_stock || 0),
        localStock: Number(row.local_stock || 0),
        supplierStock: Number(row.supplier_stock || 0),
        supplierLeadTime: Number(row.supplier_lead_time || 0),
        totalStock: Number(row.total_stock || 0),
        reorderPoint: Number(row.reorder_point || 0),
        status:
          String(row.stock_status || '').toLowerCase() === 'critical'
            ? 'Critic'
            : String(row.stock_status || '').toLowerCase() === 'warning'
              ? 'Atentionare'
              : 'Normal',
        updatedAt: row.source_updated_at,
        wattage: row.wattage ?? null,
        lumens: row.lumens ?? null,
        color_temperature: row.color_temperature ?? null,
        ip_rating: row.ip_rating ?? null,
        cri: row.cri ?? null,
        beam_angle: row.beam_angle ?? null,
        voltage_input: row.voltage_input ?? null,
        mounting_type: row.mounting_type ?? null,
        specifications: {
          brand: row.brand ?? null,
          mounting_type: row.mounting_type ?? null,
          ip_rating: row.ip_rating ?? null,
          color_temperature: row.color_temperature ?? null,
          wattage: row.wattage ?? null,
          lumens: row.lumens ?? null,
          cri: row.cri ?? null,
          beam_angle: row.beam_angle ?? null,
          voltage_input: row.voltage_input ?? null,
          instructiune_pdf: row.installation_guide_url ?? null,
          fisa_tehnica: row.datasheet_url ?? null,
          custom_specs: row.custom_specs ?? null,
        },
      };
    });

    const totalPages = Math.ceil(total / options.limit);
    const firstItem = mappedItems[0];
    const lastItem = mappedItems[mappedItems.length - 1];

    let hasNextPage = options.page < totalPages;
    let hasPrevPage = options.page > 1;
    let nextCursor: string | null =
      hasNextPage && lastItem
        ? this.helpers.encodeInventoryCursor({
            id: Number(lastItem.id),
            name: String(lastItem.name || ''),
          })
        : null;
    let prevCursor: string | null =
      hasPrevPage && firstItem
        ? this.helpers.encodeInventoryCursor({
            id: Number(firstItem.id),
            name: String(firstItem.name || ''),
          })
        : null;

    if (options.isCursorMode) {
      if (options.cursorDirection === 'prev') {
        hasPrevPage = hasOverflowRow;
        hasNextPage = Boolean(options.cursorToken);
        prevCursor =
          hasPrevPage && firstItem
            ? this.helpers.encodeInventoryCursor({
                id: Number(firstItem.id),
                name: String(firstItem.name || ''),
              })
            : null;
        nextCursor =
          hasNextPage && lastItem
            ? this.helpers.encodeInventoryCursor({
                id: Number(lastItem.id),
                name: String(lastItem.name || ''),
              })
            : null;
      } else {
        hasNextPage = hasOverflowRow;
        hasPrevPage = Boolean(options.cursorToken);
        nextCursor =
          hasNextPage && lastItem
            ? this.helpers.encodeInventoryCursor({
                id: Number(lastItem.id),
                name: String(lastItem.name || ''),
              })
            : null;
        prevCursor =
          hasPrevPage && firstItem
            ? this.helpers.encodeInventoryCursor({
                id: Number(firstItem.id),
                name: String(firstItem.name || ''),
              })
            : null;
      }
    }

    const payload = {
      items: mappedItems,
      pagination: {
        mode: options.isCursorMode ? 'cursor' : 'page',
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextCursor,
        prevCursor,
        sortBy: 'name',
        sortDir: 'asc',
      },
    };

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 800) {
      this.logger.warn('Projection listing query slow', {
        elapsedMs,
        total,
        limit: options.limit,
      });
    }

    return payload;
  }

  async getProductFacetsFromProjection(dataSource: DataSource, category: string): Promise<any | null> {
    const startedAt = Date.now();
    const readDataSource = getReadDataSource(dataSource);
    const projectionService = new InventoryProductProjectionService(dataSource);
    const projectionExists = await projectionService.projectionTableExists();

    if (!projectionExists) {
      return null;
    }

    let whereClause = 'WHERE ip.is_active = true';
    const params: any[] = [];
    const searchBlobSql = "COALESCE(ip.search_blob, '')";

    if (category) {
      whereClause += ` AND (ip.category_root ILIKE $1 OR ip.category_name ILIKE $1)`;
      params.push(`%${category}%`);
    }

    const baseFrom = `FROM inventory_product_projection ip ${whereClause}`;

    const [
      stripTypeRows,
      ledVoltageRows,
      lightColorRows,
      kelvinRows,
      ipRows,
      brandRows,
      mountingTypeRows,
      protocolRows,
      cctvResolutionRows,
    ] = await Promise.all([
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT 'smd' AS value, 'SMD' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (LOWER(COALESCE(ip.led_type, '')) ~* '(^|[^a-z0-9])smd(?:\\s*\\d{3,4})?([^a-z0-9]|$)' OR ${searchBlobSql} ~* '(^|[^a-z0-9])smd(?:\\s*\\d{3,4})?([^a-z0-9]|$)')
            UNION ALL
            SELECT 'cob' AS value, 'COB' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (LOWER(COALESCE(ip.led_type, '')) ~* '(^|[^a-z0-9])cob([^a-z0-9]|$)' OR ${searchBlobSql} ~* '(^|[^a-z0-9])cob([^a-z0-9]|$)')
          ) x
          WHERE x.count > 0
          ORDER BY x.count DESC
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT '5' AS value, '5V' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (ip.led_voltage = 5 OR ${searchBlobSql} ~* '(^|[^0-9])5\\s*v([^0-9]|$)')
            UNION ALL
            SELECT '12' AS value, '12V' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (ip.led_voltage = 12 OR ${searchBlobSql} ~* '(^|[^0-9])12\\s*v([^0-9]|$)')
            UNION ALL
            SELECT '24' AS value, '24V' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (ip.led_voltage = 24 OR ${searchBlobSql} ~* '(^|[^0-9])24\\s*v([^0-9]|$)')
            UNION ALL
            SELECT '48' AS value, '48V' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (ip.led_voltage = 48 OR ${searchBlobSql} ~* '(^|[^0-9])48\\s*v([^0-9]|$)')
          ) x
          WHERE x.count > 0
          ORDER BY CASE x.value WHEN '5' THEN 1 WHEN '12' THEN 2 WHEN '24' THEN 3 WHEN '48' THEN 4 ELSE 99 END
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT 'rgb' AS value, 'RGB' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (LOWER(COALESCE(ip.led_color, '')) ILIKE '%rgb%' OR ${searchBlobSql} ILIKE '%rgb%')
            UNION ALL
            SELECT 'rgbw' AS value, 'RGBW' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (LOWER(COALESCE(ip.led_color, '')) ILIKE '%rgbw%' OR ${searchBlobSql} ILIKE '%rgbw%')
            UNION ALL
            SELECT '3000' AS value, '3000K' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (COALESCE(ip.color_temperature::text, '') = '3000' OR LOWER(COALESCE(ip.led_color, '')) ILIKE '%3000%' OR ${searchBlobSql} ~* '(^|[^0-9])3000\\s*k([^0-9]|$)')
            UNION ALL
            SELECT '4000' AS value, '4000K' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (COALESCE(ip.color_temperature::text, '') = '4000' OR LOWER(COALESCE(ip.led_color, '')) ILIKE '%4000%' OR ${searchBlobSql} ~* '(^|[^0-9])4000\\s*k([^0-9]|$)')
            UNION ALL
            SELECT '6500' AS value, '6500K' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (COALESCE(ip.color_temperature::text, '') = '6500' OR LOWER(COALESCE(ip.led_color, '')) ILIKE '%6500%' OR ${searchBlobSql} ~* '(^|[^0-9])6500\\s*k([^0-9]|$)')
          ) x
          WHERE x.count > 0
          ORDER BY x.count DESC
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT '3000' AS value, '3000K' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (COALESCE(ip.color_temperature::text, '') = '3000' OR ${searchBlobSql} ~* '(^|[^0-9])3000\\s*k([^0-9]|$)')
            UNION ALL
            SELECT '4000' AS value, '4000K' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (COALESCE(ip.color_temperature::text, '') = '4000' OR ${searchBlobSql} ~* '(^|[^0-9])4000\\s*k([^0-9]|$)')
            UNION ALL
            SELECT '6500' AS value, '6500K' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (COALESCE(ip.color_temperature::text, '') = '6500' OR ${searchBlobSql} ~* '(^|[^0-9])6500\\s*k([^0-9]|$)')
          ) x
          WHERE x.count > 0
          ORDER BY x.count DESC
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT 'IP20' AS value, 'IP20' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (UPPER(COALESCE(ip.ip_rating, '')) = 'IP20' OR ${searchBlobSql} ILIKE '%ip20%')
            UNION ALL
            SELECT 'IP44' AS value, 'IP44' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (UPPER(COALESCE(ip.ip_rating, '')) = 'IP44' OR ${searchBlobSql} ILIKE '%ip44%')
            UNION ALL
            SELECT 'IP54' AS value, 'IP54' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (UPPER(COALESCE(ip.ip_rating, '')) = 'IP54' OR ${searchBlobSql} ILIKE '%ip54%')
            UNION ALL
            SELECT 'IP65' AS value, 'IP65' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (UPPER(COALESCE(ip.ip_rating, '')) = 'IP65' OR ${searchBlobSql} ILIKE '%ip65%')
            UNION ALL
            SELECT 'IP66' AS value, 'IP66' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (UPPER(COALESCE(ip.ip_rating, '')) = 'IP66' OR ${searchBlobSql} ILIKE '%ip66%')
            UNION ALL
            SELECT 'IP67' AS value, 'IP67' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND (UPPER(COALESCE(ip.ip_rating, '')) = 'IP67' OR ${searchBlobSql} ILIKE '%ip67%')
          ) x
          WHERE x.count > 0
          ORDER BY x.count DESC
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT value, label, count
          FROM (
            SELECT LOWER(COALESCE(ip.brand, ip.supplier_name, '')) AS value,
                   INITCAP(LOWER(COALESCE(ip.brand, ip.supplier_name, ''))) AS label,
                   COUNT(*)::int AS count
            ${baseFrom}
            GROUP BY LOWER(COALESCE(ip.brand, ip.supplier_name, ''))
          ) x
          WHERE x.value <> ''
            AND x.count > 0
          ORDER BY x.count DESC, x.value ASC
          LIMIT 40
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT LOWER(COALESCE(ip.mounting_type, '')) AS value,
                 INITCAP(LOWER(COALESCE(ip.mounting_type, ''))) AS label,
                 COUNT(*)::int AS count
          ${baseFrom}
          AND COALESCE(ip.mounting_type, '') <> ''
          GROUP BY LOWER(COALESCE(ip.mounting_type, ''))
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 20
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT 'zigbee' AS value, 'Zigbee' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^a-z0-9])zigbee([^a-z0-9]|$)'
            UNION ALL
            SELECT 'dali' AS value, 'DALI' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^a-z0-9])dali([^a-z0-9]|$)'
            UNION ALL
            SELECT 'tuya' AS value, 'Tuya' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^a-z0-9])tuya([^a-z0-9]|$)'
            UNION ALL
            SELECT 'rf' AS value, 'RF' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^a-z0-9])rf([^a-z0-9]|$)'
          ) x
          WHERE x.count > 0
          ORDER BY x.count DESC
        `,
        params,
      ),
      readDataSource.query(
        `
          SELECT *
          FROM (
            SELECT '2mp' AS value, '2MP' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^0-9])2\\s*mp([^a-z0-9]|$)'
            UNION ALL
            SELECT '4mp' AS value, '4MP' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^0-9])4\\s*mp([^a-z0-9]|$)'
            UNION ALL
            SELECT '5mp' AS value, '5MP' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^0-9])5\\s*mp([^a-z0-9]|$)'
            UNION ALL
            SELECT '8mp' AS value, '8MP' AS label, COUNT(*)::int AS count
            ${baseFrom}
            AND ${searchBlobSql} ~* '(^|[^0-9])8\\s*mp([^a-z0-9]|$)'
          ) x
          WHERE x.count > 0
          ORDER BY x.count DESC
        `,
        params,
      ),
    ]);

    const normalizeRows = (rows: any[], minCount = 1) =>
      rows
        .map((row) => ({
          value: String(row.value || '').trim(),
          label: String(row.label || row.value || '').trim(),
          count: Number(row.count || 0),
        }))
        .filter((row) => row.value.length > 0 && row.label.length > 0 && row.count >= minCount);

    const facetMap: Record<string, { label: string; options: Array<any> }> = {
      stripType: { label: 'Tip LED', options: normalizeRows(stripTypeRows) },
      ledVoltage: { label: 'Voltaj', options: normalizeRows(ledVoltageRows) },
      lightColor: { label: 'Temperatura / Culoare', options: normalizeRows(lightColorRows) },
      kelvin: { label: 'Temperatura culoare', options: normalizeRows(kelvinRows) },
      ip: { label: 'Protectie IP', options: normalizeRows(ipRows) },
      brand: { label: 'Brand', options: normalizeRows(brandRows, 1) },
      mountingType: { label: 'Montaj', options: normalizeRows(mountingTypeRows, 2) },
      protocol: { label: 'Protocol', options: normalizeRows(protocolRows) },
      resolution: { label: 'Rezolutie', options: normalizeRows(cctvResolutionRows) },
    };

    const preferredFacetsByCategory: Record<string, string[]> = {
      'Benzi LED': ['stripType', 'ledVoltage', 'lightColor', 'ip', 'brand'],
      'Surse si Drivere': ['ledVoltage', 'ip', 'brand'],
      'Profile LED': ['mountingType', 'brand', 'ip'],
      'Iluminat Interior': ['kelvin', 'ip', 'mountingType', 'brand'],
      'Iluminat Exterior': ['ip', 'kelvin', 'brand'],
      'Iluminat Industrial': ['ip', 'kelvin', 'brand'],
      'Becuri si Tuburi LED': ['kelvin', 'ledVoltage', 'brand'],
      'Automatizari si Smart': ['protocol', 'ledVoltage', 'brand'],
      'Materiale Electrice': ['brand', 'ip'],
      'Securitate CCTV': ['resolution', 'ip', 'brand'],
      Fotovoltaice: ['ledVoltage', 'brand'],
      'Accesorii Iluminat': ['brand'],
      Diverse: ['brand', 'ip'],
    };

    const preferredKeys = preferredFacetsByCategory[category] || [
      'kelvin',
      'ip',
      'brand',
      'mountingType',
    ];

    const facets = preferredKeys
      .map((key) => ({ key, label: facetMap[key]?.label, options: facetMap[key]?.options || [] }))
      .filter((facet) => facet.label && facet.options.length > 0);

    const payload = {
      category: category || null,
      facets,
    };

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 800) {
      this.logger.warn('Projection facets query slow', {
        elapsedMs,
        category,
      });
    }

    return payload;
  }
}
