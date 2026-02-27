import { DataSource } from 'typeorm';

import { getReadDataSource } from '@shared/database/read-replica-manager';

import { InventoryControllerHelpers, type InventoryCursor } from './InventoryControllerHelpers';
import type { ParsedStockLevelsQuery } from './InventoryStockLevelsQueryParser';

export interface LegacyStockLevelsQueryOptions extends ParsedStockLevelsQuery {
  dataSource: DataSource;
}

export class InventoryLegacyStockQueryService {
  constructor(private readonly helpers: InventoryControllerHelpers) {}

  async getStockLevels(options: LegacyStockLevelsQueryOptions): Promise<any> {
    const readDataSource = getReadDataSource(options.dataSource);
    const categorySql = this.helpers.getCatalogCategorySqlExpression();
    const catalogTextSql =
      "LOWER(COALESCE(c.name, '') || ' ' || COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.sku, ''))";

    let whereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
    let countWhereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
    const params: any[] = options.isCursorMode
      ? [options.effectiveLimit]
      : [options.effectiveLimit, options.offset];
    const countParams: any[] = [];

    const appendCondition = (conditionBuilder: (startIndex: number) => string, values: any[]) => {
      const queryStartIndex = params.length + 1;
      const countStartIndex = countParams.length + 1;

      whereClause += ` AND ${conditionBuilder(queryStartIndex)}`;
      countWhereClause += ` AND ${conditionBuilder(countStartIndex)}`;

      params.push(...values);
      countParams.push(...values);
    };

    if (options.search) {
      appendCondition(
        (startIndex) => `(p.sku ILIKE $${startIndex} OR p.name ILIKE $${startIndex})`,
        [`%${options.search}%`],
      );
    }

    if (options.category) {
      appendCondition(
        (startIndex) => `(${categorySql} ILIKE $${startIndex} OR c.name ILIKE $${startIndex})`,
        [`%${options.category}%`],
      );
    }

    if (options.stripTypes.length > 0) {
      const stripTypePatterns = options.stripTypes
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

      if (stripTypePatterns.length > 0) {
        appendCondition(
          (startIndex) =>
            `(${stripTypePatterns
              .map(
                (_, index) =>
                  `(LOWER(COALESCE(p.led_type, '')) ~* $${startIndex + index} OR ${catalogTextSql} ~* $${startIndex + index})`,
              )
              .join(' OR ')})`,
          stripTypePatterns,
        );
      }
    }

    if (options.ledVoltages.length > 0) {
      const voltageValues = options.ledVoltages.flatMap((voltage) => [
        voltage,
        `(^|[^0-9])${voltage}\\s*v([^0-9]|$)`,
      ]);

      appendCondition(
        (startIndex) =>
          `(${options.ledVoltages
            .map((_, index) => {
              const voltageParamIndex = startIndex + index * 2;
              const regexParamIndex = voltageParamIndex + 1;

              return `(p.led_voltage = $${voltageParamIndex} OR ${catalogTextSql} ~* $${regexParamIndex})`;
            })
            .join(' OR ')})`,
        voltageValues,
      );
    }

    if (options.lightColors.length > 0) {
      const colorDescriptors = options.lightColors.map((value) => ({
        value,
        isTemperature: /^\d{4}$/.test(value),
      }));

      const colorValues = colorDescriptors.flatMap((descriptor) => {
        if (descriptor.isTemperature) {
          return [
            `%${descriptor.value}%`,
            descriptor.value,
            `(^|[^0-9])${descriptor.value}\\s*k([^0-9]|$)`,
          ];
        }

        return [`%${descriptor.value}%`];
      });

      appendCondition((startIndex) => {
        let cursor = startIndex;
        const clauses = colorDescriptors.map((descriptor) => {
          if (descriptor.isTemperature) {
            const likeIndex = cursor;
            const tempIndex = cursor + 1;
            const regexIndex = cursor + 2;
            cursor += 3;

            return `(
                LOWER(COALESCE(p.led_color, '')) ILIKE $${likeIndex}
                OR ${catalogTextSql} ILIKE $${likeIndex}
                OR COALESCE(ps.color_temperature::text, '') = $${tempIndex}
                OR ${catalogTextSql} ~* $${regexIndex}
              )`;
          }

          const likeIndex = cursor;
          cursor += 1;

          return `(
              LOWER(COALESCE(p.led_color, '')) ILIKE $${likeIndex}
              OR ${catalogTextSql} ILIKE $${likeIndex}
            )`;
        });

        return `(${clauses.join(' OR ')})`;
      }, colorValues);
    }

    if (options.kelvinFilters.length > 0) {
      const kelvinValues = options.kelvinFilters.flatMap((value) => [
        `%${value}%`,
        value,
        `(^|[^0-9])${value}\\s*k([^0-9]|$)`,
      ]);

      appendCondition(
        (startIndex) =>
          `(${options.kelvinFilters
            .map((_, index) => {
              const likeIndex = startIndex + index * 3;
              const tempIndex = likeIndex + 1;
              const regexIndex = likeIndex + 2;
              return `(
                COALESCE(ps.color_temperature::text, '') = $${tempIndex}
                OR ${catalogTextSql} ILIKE $${likeIndex}
                OR ${catalogTextSql} ~* $${regexIndex}
                OR LOWER(COALESCE(p.led_color, '')) ILIKE $${likeIndex}
              )`;
            })
            .join(' OR ')})`,
        kelvinValues,
      );
    }

    if (options.ipFilters.length > 0) {
      const ipValues = options.ipFilters.flatMap((value) => [value, `%${value.toLowerCase()}%`]);

      appendCondition(
        (startIndex) =>
          `(${options.ipFilters
            .map((_, index) => {
              const exactIndex = startIndex + index * 2;
              const likeIndex = exactIndex + 1;
              return `(
                UPPER(COALESCE(ps.ip_rating, '')) = $${exactIndex}
                OR ${catalogTextSql} ILIKE $${likeIndex}
              )`;
            })
            .join(' OR ')})`,
        ipValues,
      );
    }

    if (options.brandFilters.length > 0) {
      appendCondition(
        (startIndex) =>
          `(${options.brandFilters
            .map(
              (_, index) =>
                `(LOWER(COALESCE(ps.brand, '')) = $${startIndex + index} OR LOWER(COALESCE(s.name, '')) = $${startIndex + index})`,
            )
            .join(' OR ')})`,
        options.brandFilters,
      );
    }

    if (options.mountingTypeFilters.length > 0) {
      appendCondition(
        (startIndex) =>
          `(${options.mountingTypeFilters
            .map((_, index) => `LOWER(COALESCE(ps.mounting_type, '')) = $${startIndex + index}`)
            .join(' OR ')})`,
        options.mountingTypeFilters,
      );
    }

    if (options.protocolFilters.length > 0) {
      const protocolPatterns = options.protocolFilters.map(
        (value) =>
          `(^|[^a-z0-9])${value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`,
      );

      appendCondition(
        (startIndex) =>
          `(${protocolPatterns
            .map((_, index) => `${catalogTextSql} ~* $${startIndex + index}`)
            .join(' OR ')})`,
        protocolPatterns,
      );
    }

    if (options.cctvResolutionFilters.length > 0) {
      const resolutionPatterns = options.cctvResolutionFilters
        .map((value) => value.replace(/\s+/g, '').replace('megapixel', 'mp'))
        .map((value) => {
          const numeric = value.replace(/[^0-9]/g, '');
          if (!numeric) {
            return '';
          }
          return `(^|[^0-9])${numeric}\\s*mp([^a-z0-9]|$)`;
        })
        .filter((value) => value.length > 0);

      if (resolutionPatterns.length > 0) {
        appendCondition(
          (startIndex) =>
            `(${resolutionPatterns
              .map((_, index) => `${catalogTextSql} ~* $${startIndex + index}`)
              .join(' OR ')})`,
          resolutionPatterns,
        );
      }
    }

    if (options.stockStatus) {
      const stockTotalSql = `
        (
          COALESCE(
            (
              SELECT SUM(sl2.quantity_available)
              FROM stock_levels sl2
              JOIN warehouses sw2 ON sw2.id = sl2.warehouse_id
              WHERE sw2.is_active = true
                AND (sw2.code ILIKE 'SB-%' OR sw2.name ILIKE 'magazin')
                AND sl2.product_id = p.id
            ),
            0
          )
          +
          COALESCE(
            (
              SELECT SUM(sc2.quantity_available)
              FROM supplier_stock_cache sc2
              WHERE sc2.is_available = true
                AND sc2.product_id = p.id
            ),
            0
          )
        )
      `;

      const reorderPointSql = `
        COALESCE(
          (
            SELECT MAX(sl3.reorder_point)
            FROM stock_levels sl3
            JOIN warehouses sw3 ON sw3.id = sl3.warehouse_id
            WHERE sw3.is_active = true
              AND (sw3.code ILIKE 'SB-%' OR sw3.name ILIKE 'magazin')
              AND sl3.product_id = p.id
          ),
          0
        )
      `;

      const statusCondition =
        options.stockStatus === 'critical'
          ? `${stockTotalSql} <= 0`
          : options.stockStatus === 'warning'
            ? `(${stockTotalSql} > 0 AND ${stockTotalSql} <= ${reorderPointSql})`
            : `${stockTotalSql} > ${reorderPointSql}`;

      appendCondition(() => statusCondition, []);
    }

    if (options.isCursorMode && options.cursorData) {
      whereClause = this.appendCursorCondition(
        whereClause,
        params,
        options.cursorData,
        options.fetchDirection,
      );
    }

    const paginationClause = options.isCursorMode ? 'LIMIT $1' : 'LIMIT $1 OFFSET $2';

    const [rows, countResult] = await Promise.all([
      readDataSource.query(
        `
        WITH local_stock AS (
          SELECT
            sl.product_id,
            MIN(sl.warehouse_id) AS warehouse_id,
            SUM(sl.quantity_on_hand) AS quantity_on_hand,
            SUM(sl.quantity_reserved) AS quantity_reserved,
            SUM(sl.quantity_available) AS quantity_available,
            MAX(sl.reorder_point) AS reorder_point,
            MAX(sl.reorder_quantity) AS reorder_quantity,
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
            MIN(sc.lead_time_days) AS supplier_lead_time
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
        SELECT p.id AS product_id,
               ls.warehouse_id,
               COALESCE(ls.quantity_on_hand, 0) AS quantity_on_hand,
               COALESCE(ls.quantity_reserved, 0) AS quantity_reserved,
               COALESCE(ls.quantity_available, 0) AS quantity_available,
               COALESCE(ls.reorder_point, 0) AS reorder_point,
               COALESCE(ls.reorder_quantity, 0) AS reorder_quantity,
               ls.updated_at,
               COALESCE(ssc.supplier_stock, 0) AS supplier_stock,
               COALESCE(ssc.supplier_lead_time, 0) AS supplier_lead_time,
               p.sku, p.name as product_name, p.base_price, p.category_id,
               ${categorySql} AS category_root,
               c.name AS category_name,
               w.name as warehouse_name,
               pi.image_url
        FROM products p
        LEFT JOIN local_stock ls ON ls.product_id = p.id
        LEFT JOIN warehouses w ON w.id = ls.warehouse_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN supplier_stock ssc ON ssc.product_id = p.id
        LEFT JOIN primary_image pi ON pi.product_id = p.id
        ${whereClause}
        ORDER BY COALESCE(p.name, '') ${options.fetchDirection}, p.id ${options.fetchDirection}
        ${paginationClause}
      `,
        params,
      ),
      readDataSource.query(
        `
        SELECT COUNT(DISTINCT p.id) as total
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        ${countWhereClause}
      `,
        countParams,
      ),
    ]);

    const total = parseInt(countResult[0]?.total || '0');

    const hasOverflowRow = options.isCursorMode && rows.length > options.limit;
    const pageRows = options.isCursorMode ? rows.slice(0, options.limit) : rows;

    if (options.isCursorMode && options.fetchDirection === 'DESC') {
      pageRows.reverse();
    }

    const mappedItems = pageRows.map((row: any) => {
      const localAvailable = parseInt(row.quantity_available) || 0;
      const supplierStock = parseInt(row.supplier_stock) || 0;
      const totalStock = localAvailable + supplierStock;
      const reorderPoint = parseInt(row.reorder_point) || 0;
      const categoryName =
        String(row.category_root || '').trim() ||
        this.helpers.normalizeCatalogCategory(row.category_name, row.product_name, row.sku);
      const subcategoryName = this.helpers.normalizeCatalogSubcategory(row.category_name, categoryName);

      return {
        id: row.product_id,
        productId: row.product_id,
        sku: row.sku || `ID-${row.product_id}`,
        name: row.product_name || 'Unknown',
        categoryId: row.category_id ? Number(row.category_id) : null,
        categoryName,
        subcategoryName: subcategoryName || null,
        price: parseFloat(row.base_price) || 0,
        imageUrl: row.image_url || null,
        warehouseId: row.warehouse_id || 1,
        warehouseName: row.warehouse_name || 'Principal',
        current: parseInt(row.quantity_on_hand) || 0,
        reserved: parseInt(row.quantity_reserved) || 0,
        available: localAvailable,
        localStock: localAvailable,
        supplierStock,
        supplierLeadTime: parseInt(row.supplier_lead_time) || 0,
        totalStock,
        reorderPoint,
        status: totalStock <= 0 ? 'Critic' : totalStock <= reorderPoint ? 'Atentionare' : 'Normal',
        updatedAt: row.updated_at,
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

    return {
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
  }

  private appendCursorCondition(
    whereClause: string,
    params: any[],
    cursorData: InventoryCursor,
    fetchDirection: 'ASC' | 'DESC',
  ): string {
    const cursorName = this.helpers.normalizeCursorName(cursorData.name);
    const comparator = fetchDirection === 'ASC' ? '>' : '<';
    const nameParamIndex = params.length + 1;
    const idParamIndex = params.length + 2;

    params.push(cursorName, cursorData.id);

    return `${whereClause}
      AND (
        COALESCE(p.name, '') ${comparator} $${nameParamIndex}
        OR (
          COALESCE(p.name, '') = $${nameParamIndex}
          AND p.id ${comparator} $${idParamIndex}
        )
      )`;
  }
}
