import { DataSource } from 'typeorm';

import { getReadDataSource } from '@shared/database/read-replica-manager';

import { InventoryControllerHelpers } from './InventoryControllerHelpers';

export class InventoryLegacyFacetsQueryService {
  constructor(private readonly helpers: InventoryControllerHelpers) {}

  async getProductFacets(dataSource: DataSource, category: string): Promise<any> {
    const readDataSource = getReadDataSource(dataSource);
    const categorySql = this.helpers.getCatalogCategorySqlExpression();
    const catalogTextSql =
      "LOWER(COALESCE(c.name, '') || ' ' || COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.sku, ''))";

    let whereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
    const params: any[] = [];

    if (category) {
      whereClause += ` AND (${categorySql} ILIKE $1 OR c.name ILIKE $1)`;
      params.push(`%${category}%`);
    }

    const baseFrom = `
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN product_specifications ps ON ps.product_id = p.id
      ${whereClause}
    `;

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
          AND (
            LOWER(COALESCE(p.led_type, '')) ~* '(^|[^a-z0-9])smd(?:\\s*\\d{3,4})?([^a-z0-9]|$)'
            OR ${catalogTextSql} ~* '(^|[^a-z0-9])smd(?:\\s*\\d{3,4})?([^a-z0-9]|$)'
          )
          UNION ALL
          SELECT 'cob' AS value, 'COB' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            LOWER(COALESCE(p.led_type, '')) ~* '(^|[^a-z0-9])cob([^a-z0-9]|$)'
            OR ${catalogTextSql} ~* '(^|[^a-z0-9])cob([^a-z0-9]|$)'
          )
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
          AND (p.led_voltage = 5 OR ${catalogTextSql} ~* '(^|[^0-9])5\\s*v([^0-9]|$)')
          UNION ALL
          SELECT '12' AS value, '12V' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (p.led_voltage = 12 OR ${catalogTextSql} ~* '(^|[^0-9])12\\s*v([^0-9]|$)')
          UNION ALL
          SELECT '24' AS value, '24V' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (p.led_voltage = 24 OR ${catalogTextSql} ~* '(^|[^0-9])24\\s*v([^0-9]|$)')
          UNION ALL
          SELECT '48' AS value, '48V' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (p.led_voltage = 48 OR ${catalogTextSql} ~* '(^|[^0-9])48\\s*v([^0-9]|$)')
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
          AND (
            LOWER(COALESCE(p.led_color, '')) ILIKE '%rgb%'
            OR ${catalogTextSql} ILIKE '%rgb%'
          )
          UNION ALL
          SELECT 'rgbw' AS value, 'RGBW' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            LOWER(COALESCE(p.led_color, '')) ILIKE '%rgbw%'
            OR ${catalogTextSql} ILIKE '%rgbw%'
          )
          UNION ALL
          SELECT '3000' AS value, '3000K' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            COALESCE(ps.color_temperature::text, '') = '3000'
            OR LOWER(COALESCE(p.led_color, '')) ILIKE '%3000%'
            OR ${catalogTextSql} ~* '(^|[^0-9])3000\\s*k([^0-9]|$)'
          )
          UNION ALL
          SELECT '4000' AS value, '4000K' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            COALESCE(ps.color_temperature::text, '') = '4000'
            OR LOWER(COALESCE(p.led_color, '')) ILIKE '%4000%'
            OR ${catalogTextSql} ~* '(^|[^0-9])4000\\s*k([^0-9]|$)'
          )
          UNION ALL
          SELECT '6500' AS value, '6500K' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            COALESCE(ps.color_temperature::text, '') = '6500'
            OR LOWER(COALESCE(p.led_color, '')) ILIKE '%6500%'
            OR ${catalogTextSql} ~* '(^|[^0-9])6500\\s*k([^0-9]|$)'
          )
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
          AND (
            COALESCE(ps.color_temperature::text, '') = '3000'
            OR ${catalogTextSql} ~* '(^|[^0-9])3000\\s*k([^0-9]|$)'
          )
          UNION ALL
          SELECT '4000' AS value, '4000K' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            COALESCE(ps.color_temperature::text, '') = '4000'
            OR ${catalogTextSql} ~* '(^|[^0-9])4000\\s*k([^0-9]|$)'
          )
          UNION ALL
          SELECT '6500' AS value, '6500K' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND (
            COALESCE(ps.color_temperature::text, '') = '6500'
            OR ${catalogTextSql} ~* '(^|[^0-9])6500\\s*k([^0-9]|$)'
          )
        ) x
        WHERE x.count > 0
        ORDER BY x.count DESC
      `,
        params,
      ),
      readDataSource.query(
        `
        SELECT UPPER(ps.ip_rating) AS value,
               UPPER(ps.ip_rating) AS label,
               COUNT(*)::int AS count
        ${baseFrom}
        AND COALESCE(ps.ip_rating, '') <> ''
        GROUP BY UPPER(ps.ip_rating)
        HAVING COUNT(*) > 0
        ORDER BY count DESC, label ASC
        LIMIT 20
      `,
        params,
      ),
      readDataSource.query(
        `
        SELECT COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) AS value,
               COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) AS label,
               COUNT(*)::int AS count
        ${baseFrom}
        AND COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) IS NOT NULL
        GROUP BY COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, ''))
        HAVING COUNT(*) > 0
        ORDER BY count DESC, label ASC
        LIMIT 20
      `,
        params,
      ),
      readDataSource.query(
        `
        SELECT ps.mounting_type AS value,
               ps.mounting_type AS label,
               COUNT(*)::int AS count
        ${baseFrom}
        AND COALESCE(ps.mounting_type, '') <> ''
        GROUP BY ps.mounting_type
        HAVING COUNT(*) > 0
        ORDER BY count DESC, label ASC
        LIMIT 20
      `,
        params,
      ),
      readDataSource.query(
        `
        SELECT *
        FROM (
          SELECT 'wifi' AS value, 'WiFi' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^a-z0-9])wifi([^a-z0-9]|$)'
          UNION ALL
          SELECT 'zigbee' AS value, 'Zigbee' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^a-z0-9])zigbee([^a-z0-9]|$)'
          UNION ALL
          SELECT 'dali' AS value, 'DALI' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^a-z0-9])dali([^a-z0-9]|$)'
          UNION ALL
          SELECT 'tuya' AS value, 'Tuya' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^a-z0-9])tuya([^a-z0-9]|$)'
          UNION ALL
          SELECT 'rf' AS value, 'RF' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^a-z0-9])rf([^a-z0-9]|$)'
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
          AND ${catalogTextSql} ~* '(^|[^0-9])2\\s*mp([^a-z0-9]|$)'
          UNION ALL
          SELECT '4mp' AS value, '4MP' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^0-9])4\\s*mp([^a-z0-9]|$)'
          UNION ALL
          SELECT '5mp' AS value, '5MP' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^0-9])5\\s*mp([^a-z0-9]|$)'
          UNION ALL
          SELECT '8mp' AS value, '8MP' AS label, COUNT(*)::int AS count
          ${baseFrom}
          AND ${catalogTextSql} ~* '(^|[^0-9])8\\s*mp([^a-z0-9]|$)'
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

    return {
      category: category || null,
      facets,
    };
  }
}
