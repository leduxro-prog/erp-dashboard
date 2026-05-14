import { randomUUID } from 'crypto';
import { promises as dns, LookupAddress } from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

import { Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

import { invalidateInventoryReadCacheNamespace } from '@shared/cache/inventory-read-cache';
import { getReadDataSource } from '@shared/database/read-replica-manager';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { InventoryProductProjectionService } from '@shared/read-model/InventoryProductProjectionService';
import { getEventBus } from '@shared/utils/event-bus';

import { RegisterB2B, RegisterB2BInput } from '../../application/use-cases/RegisterB2B';
import {
  ReviewRegistration,
  ReviewRegistrationInput,
} from '../../application/use-cases/ReviewRegistration';
import {
  AnafValidationService,
  AnafValidationResult,
} from '../../infrastructure/services/AnafValidationService';

/**
 * B2B Portal Controller
 * Handles all B2B customer, registration, cart, and bulk order operations
 */
export class B2BController {
  private readonly anafValidationService: AnafValidationService;

  private createPrefixedId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  private createBulkOrderNumber(): string {
    return `BLK-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  constructor(
    private readonly registerB2BUseCase: RegisterB2B,
    private readonly reviewRegistrationUseCase: ReviewRegistration,
    private readonly convertCartToOrderUseCase: any,
    private readonly registrationRepository: any,
    private readonly customerRepository: any,
    private readonly savedCartRepository: any,
    private readonly bulkOrderRepository: any,
    private readonly creditTransactionRepository: any,
    private readonly dataSource: DataSource,
  ) {
    this.anafValidationService = new AnafValidationService();
  }

  private isPrivatePreviewIp(address: string): boolean {
    const normalized = address.toLowerCase();

    if (normalized.startsWith('::ffff:')) {
      return this.isPrivatePreviewIp(normalized.slice(7));
    }

    if (net.isIP(normalized) === 4) {
      const parts = normalized.split('.').map((part) => Number(part));
      const [first = 0, second = 0] = parts;

      return (
        first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254) ||
        first === 0
      );
    }

    if (net.isIP(normalized) === 6) {
      return (
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80:')
      );
    }

    return true;
  }

  private async resolvePreviewHostAddresses(hostname: string): Promise<LookupAddress[]> {
    const normalized = hostname.trim().toLowerCase();

    if (
      !normalized ||
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      normalized.endsWith('.local') ||
      normalized.endsWith('.internal')
    ) {
      return [];
    }

    if (net.isIP(normalized)) {
      return [{ address: normalized, family: net.isIP(normalized) as 4 | 6 }];
    }

    return dns.lookup(normalized, { all: true, verbatim: true });
  }

  async previewDocument(req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> {
    const rawUrl = String(req.query?.url || '').trim();
    let targetUrl: URL;

    try {
      targetUrl = new URL(rawUrl);
    } catch (_error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DOCUMENT_URL',
          message: 'Document preview URL is invalid.',
        },
      });
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol) || targetUrl.username || targetUrl.password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DOCUMENT_URL',
          message: 'Document preview URL must be a public http or https URL.',
        },
      });
      return;
    }

    let previewAddresses: LookupAddress[] = [];
    try {
      previewAddresses = await this.resolvePreviewHostAddresses(targetUrl.hostname);
    } catch (_error) {
      res.status(502).json({
        success: false,
        error: {
          code: 'DOCUMENT_PREVIEW_FETCH_FAILED',
          message: 'Document preview host could not be resolved.',
        },
      });
      return;
    }

    if (
      previewAddresses.length === 0 ||
      previewAddresses.some((address) => this.isPrivatePreviewIp(address.address))
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DOCUMENT_URL',
          message: 'Document preview URL must not target private or internal hosts.',
        },
      });
      return;
    }

    const client = targetUrl.protocol === 'https:' ? https : http;
    const maxBytes = 5 * 1024 * 1024;
    const lookup = (
      hostname: string,
      _options: unknown,
      callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
    ) => {
      if (hostname.toLowerCase() !== targetUrl.hostname.toLowerCase()) {
        callback(new Error('Unexpected preview host.') as NodeJS.ErrnoException, '', 4);
        return;
      }

      const address = previewAddresses[0];
      callback(null, address.address, address.family);
    };

    await new Promise<void>((resolve) => {
      const upstreamReq = client.get(targetUrl, { timeout: 5000, lookup }, (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 502;

        if (statusCode >= 300 && statusCode < 400) {
          upstreamRes.resume();
          res.status(502).json({
            success: false,
            error: {
              code: 'DOCUMENT_PREVIEW_FETCH_FAILED',
              message: 'Document preview redirects are not supported.',
            },
          });
          resolve();
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          upstreamRes.resume();
          res.status(502).json({
            success: false,
            error: {
              code: 'DOCUMENT_PREVIEW_FETCH_FAILED',
              message: 'Document preview fetch failed.',
            },
          });
          resolve();
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        let capped = false;

        upstreamRes.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > maxBytes) {
            capped = true;
            upstreamReq.destroy();
            return;
          }

          chunks.push(chunk);
        });

        upstreamRes.on('end', () => {
          if (capped) {
            res.status(502).json({
              success: false,
              error: {
                code: 'DOCUMENT_PREVIEW_FETCH_FAILED',
                message: 'Document preview response is too large.',
              },
            });
            resolve();
            return;
          }

          res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'private, max-age=300');
          res.status(200).send(Buffer.concat(chunks));
          resolve();
        });
      });

      upstreamReq.on('timeout', () => {
        upstreamReq.destroy(new Error('Document preview request timed out.'));
      });

      upstreamReq.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: {
              code: 'DOCUMENT_PREVIEW_FETCH_FAILED',
              message: 'Document preview fetch failed.',
            },
          });
        }
        resolve();
      });
    });
  }

  private async listProductsFromProjection(options: {
    page: number;
    limit: number;
    sort?: string;
    search?: string;
    category?: string;
    stock?: string;
    kelvin?: string[];
    ip?: string[];
    brand?: string[];
    mountingType?: string[];
    stripType?: string[];
    ledVoltage?: string[];
    lightColor?: string[];
    minPrice?: number;
    maxPrice?: number;
  }): Promise<{ products: any[]; total: number } | null> {
    const projectionService = new InventoryProductProjectionService(this.dataSource);
    const projectionExists = await projectionService.projectionTableExists();

    if (!projectionExists) {
      return null;
    }

    const readDataSource = getReadDataSource(this.dataSource);
    const offset = (options.page - 1) * options.limit;

    const where: string[] = ['ip.is_active = true'];
    const params: any[] = [];
    const addParam = (value: any): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const normalizedValues = (values?: string[]): string[] =>
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0);

    const normalizedSearch = String(options.search || '').trim().toLowerCase();

    if (options.search) {
      const param = addParam(`%${options.search}%`);
      where.push(
        `(ip.sku ILIKE ${param} OR ip.name ILIKE ${param} OR COALESCE(ip.search_blob, '') ILIKE ${param})`,
      );
    }

    if (options.category) {
      const param = addParam(`%${options.category}%`);
      where.push(`(ip.category_root ILIKE ${param} OR ip.category_name ILIKE ${param})`);
    }

    if (options.stock === 'supplier') {
      where.push('ip.supplier_stock > 0');
    }

    if (options.stock === 'local') {
      where.push('ip.local_stock > 0');
    }

    if (options.stock === 'stock') {
      where.push('(ip.local_stock > 0 OR ip.supplier_stock > 0)');
    }

    if (typeof options.minPrice === 'number' && Number.isFinite(options.minPrice)) {
      where.push(`ip.base_price >= ${addParam(options.minPrice)}`);
    }

    if (typeof options.maxPrice === 'number' && Number.isFinite(options.maxPrice)) {
      where.push(`ip.base_price <= ${addParam(options.maxPrice)}`);
    }

    const selectedKelvin = normalizedValues(options.kelvin);
    if (selectedKelvin.length > 0) {
      const kelvinParam = addParam(selectedKelvin);
      where.push(
        `(COALESCE(ip.color_temperature::text, '') = ANY(${kelvinParam}) OR EXISTS (
          SELECT 1
          FROM unnest(${kelvinParam}::text[]) AS k(value)
          WHERE COALESCE(ip.search_blob, '') ~* ('(^|[^0-9])' || regexp_replace(k.value, '[^0-9]', '', 'g') || '\\s*k([^0-9]|$)')
        ))`,
      );
    }

    const selectedIp = normalizedValues(options.ip).map((value) => value.toUpperCase());
    if (selectedIp.length > 0) {
      const ipParam = addParam(selectedIp);
      where.push(
        `(UPPER(COALESCE(ip.ip_rating, '')) = ANY(${ipParam}) OR EXISTS (
          SELECT 1
          FROM unnest(${ipParam}::text[]) AS i(value)
          WHERE COALESCE(ip.search_blob, '') ILIKE ('%' || LOWER(i.value) || '%')
        ))`,
      );
    }

    const selectedBrands = normalizedValues(options.brand).map((value) => value.toLowerCase());
    if (selectedBrands.length > 0) {
      const brandParam = addParam(selectedBrands);
      where.push(`LOWER(COALESCE(ip.brand, ip.supplier_name, '')) = ANY(${brandParam})`);
    }

    const selectedMountingTypes = normalizedValues(options.mountingType).map((value) =>
      value.toLowerCase(),
    );
    if (selectedMountingTypes.length > 0) {
      const mountingParam = addParam(selectedMountingTypes);
      where.push(`LOWER(COALESCE(ip.mounting_type, '')) = ANY(${mountingParam})`);
    }

    const selectedStripTypes = normalizedValues(options.stripType).map((value) =>
      value.toLowerCase(),
    );
    if (selectedStripTypes.length > 0) {
      const stripConditions = selectedStripTypes.map((value) => {
        const text = value.replace(/[^a-z0-9]/g, '');
        const stripParam = addParam(`(^|[^a-z0-9])${text}(?:\\s*\\d{3,4})?([^a-z0-9]|$)`);
        return `(LOWER(COALESCE(ip.led_type, '')) ~* ${stripParam} OR COALESCE(ip.search_blob, '') ~* ${stripParam})`;
      });
      where.push(`(${stripConditions.join(' OR ')})`);
    }

    const selectedVoltages = normalizedValues(options.ledVoltage)
      .map((value) => value.replace(/[^0-9]/g, ''))
      .filter((value) => value.length > 0);
    if (selectedVoltages.length > 0) {
      const voltageConditions = selectedVoltages.map((value) => {
        const numericParam = addParam(Number(value));
        const regexParam = addParam(`(^|[^0-9])${value}\\s*v([^0-9]|$)`);
        return `(ip.led_voltage = ${numericParam} OR COALESCE(ip.search_blob, '') ~* ${regexParam})`;
      });
      where.push(`(${voltageConditions.join(' OR ')})`);
    }

    const selectedLightColors = normalizedValues(options.lightColor).map((value) =>
      value.toLowerCase(),
    );
    if (selectedLightColors.length > 0) {
      const colorConditions = selectedLightColors.map((value) => {
        if (value === 'rgb' || value === 'rgbw') {
          const rgbParam = addParam(`%${value}%`);
          return `(LOWER(COALESCE(ip.led_color, '')) ILIKE ${rgbParam} OR COALESCE(ip.search_blob, '') ILIKE ${rgbParam})`;
        }

        const numeric = value.replace(/[^0-9]/g, '');
        if (numeric.length > 0) {
          const tempParam = addParam(numeric);
          const regexParam = addParam(`(^|[^0-9])${numeric}\\s*k([^0-9]|$)`);
          const colorParam = addParam(`%${numeric}%`);
          return `(COALESCE(ip.color_temperature::text, '') = ${tempParam} OR LOWER(COALESCE(ip.led_color, '')) ILIKE ${colorParam} OR COALESCE(ip.search_blob, '') ~* ${regexParam})`;
        }

        const genericParam = addParam(`%${value}%`);
        return `(LOWER(COALESCE(ip.led_color, '')) ILIKE ${genericParam} OR COALESCE(ip.search_blob, '') ILIKE ${genericParam})`;
      });
      where.push(`(${colorConditions.join(' OR ')})`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await readDataSource.query(
      `SELECT COUNT(*)::int AS total FROM inventory_product_projection ip ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total || 0);

    const sort = String(options.sort || 'newest');
    let orderBySql = `COALESCE(ip.source_updated_at, NOW()) DESC, ip.name ASC, ip.product_id ASC`;

    if (sort === 'price_asc') {
      orderBySql = `ip.base_price ASC NULLS LAST, ip.name ASC, ip.product_id ASC`;
    } else if (sort === 'price_desc') {
      orderBySql = `ip.base_price DESC NULLS LAST, ip.name ASC, ip.product_id ASC`;
    } else if (sort === 'name_asc') {
      orderBySql = `ip.name ASC, ip.product_id ASC`;
    } else if (sort === 'popularity') {
      orderBySql = `ip.total_stock DESC NULLS LAST, ip.name ASC, ip.product_id ASC`;
    } else if (normalizedSearch) {
      const searchExactParam = addParam(normalizedSearch);
      const searchPrefixParam = addParam(`${normalizedSearch}%`);
      const searchContainsParam = addParam(`%${normalizedSearch}%`);
      orderBySql = `
        CASE
          WHEN LOWER(ip.sku) = ${searchExactParam} THEN 0
          WHEN LOWER(ip.sku) LIKE ${searchPrefixParam} THEN 1
          WHEN LOWER(ip.name) LIKE ${searchPrefixParam} THEN 2
          WHEN LOWER(ip.name) LIKE ${searchContainsParam} THEN 3
          ELSE 4
        END ASC,
        COALESCE(ip.source_updated_at, NOW()) DESC,
        ip.name ASC,
        ip.product_id ASC
      `;
    }

    const queryParams = [...params, options.limit, offset];
    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;

    const rows = await readDataSource.query(
      `
        SELECT
          ip.product_id AS id,
          ip.sku,
          ip.name,
          ip.description,
          ip.base_price AS price,
          ip.currency_code AS currency,
          ip.primary_image_url,
          ip.category_name AS category_raw,
          ip.category_root,
          ip.brand,
          ip.mounting_type,
          ip.ip_rating,
          ip.color_temperature,
          ip.local_stock,
          ip.supplier_stock,
          ip.total_stock,
          ip.supplier_lead_time,
          ip.supplier_name,
          ip.source_updated_at
        FROM inventory_product_projection ip
        ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      queryParams,
    );

    return {
      products: rows,
      total,
    };
  }

  private async getProductDetailsFromProjection(productId: string): Promise<any | null> {
    const projectionService = new InventoryProductProjectionService(this.dataSource);
    const projectionExists = await projectionService.projectionTableExists();

    if (!projectionExists) {
      return null;
    }

    const readDataSource = getReadDataSource(this.dataSource);
    const rows = await readDataSource.query(
      `
        SELECT
          ip.product_id AS id,
          ip.sku,
          ip.name,
          ip.description,
          ip.base_price AS price,
          ip.currency_code AS currency,
          ip.primary_image_url,
          ip.category_name AS category_raw,
          ip.category_root,
          ip.brand,
          ip.mounting_type,
          ip.ip_rating,
          ip.color_temperature,
          ps.wattage,
          ps.lumens,
          ps.cri,
          ps.beam_angle,
          ps.voltage_input,
          ps.custom_specs,
          ip.local_stock,
          ip.supplier_stock,
          ip.total_stock,
          ip.supplier_lead_time,
          ip.supplier_name
        FROM inventory_product_projection ip
        LEFT JOIN product_specifications ps ON ps.product_id = ip.product_id
        WHERE ip.product_id = $1
          AND ip.is_active = true
        LIMIT 1
      `,
      [productId],
    );

    return rows.length > 0 ? rows[0] : null;
  }

  private getSafeCatalogImageUrl(value: unknown): string {
    const url = String(value || '').trim();
    const lowerUrl = url.toLowerCase();
    const isAbsoluteHttpUrl = lowerUrl.startsWith('https://') || lowerUrl.startsWith('http://');

    if (!url) {
      return '';
    }

    if (
      lowerUrl.includes('pl-default-thickbox_default.jpg') ||
      lowerUrl.includes('woocommerce-placeholder')
    ) {
      return '';
    }

    if (
      !isAbsoluteHttpUrl &&
      (lowerUrl.includes('/optimized/uploads/optimized/') ||
        lowerUrl.includes('/uploads/optimized/') ||
        lowerUrl.includes('/uploads/products/'))
    ) {
      return '';
    }

    if (!isAbsoluteHttpUrl) {
      return '';
    }

    return url;
  }

  private isMissingProductAssetsSchemaError(error: any): boolean {
    const code = String(error?.code || '');
    if (code === '42P01' || code === '42703') {
      return true;
    }

    const message = String(error?.message || '').toLowerCase();
    return message.includes('product_assets') && message.includes('does not exist');
  }

  private async getProductAssetImageRows(
    readDataSource: DataSource,
    productId: string | number,
  ): Promise<any[]> {
    try {
      return (
        (await readDataSource.query(
          `
            SELECT
              pa.storage_url,
              pa.source_url,
              pa.alt_text,
              pa.sort_order,
              pa.is_primary
            FROM product_assets pa
            WHERE pa.product_id = $1
              AND pa.is_active = true
              AND pa.asset_type = 'image'
            ORDER BY
              COALESCE(pa.is_primary, false) DESC,
              pa.sort_order ASC NULLS LAST,
              pa.id ASC
          `,
          [productId],
        )) || []
      );
    } catch (error) {
      if (this.isMissingProductAssetsSchemaError(error)) {
        return [];
      }

      throw error;
    }
  }

  private async getProductGalleryImages(
    productId: string | number,
    fallbackPrimaryUrl?: string,
  ): Promise<Array<{ url: string; alt_text?: string; sort_order?: number; is_primary?: boolean }>> {
    const readDataSource = getReadDataSource(this.dataSource);
    const rows = await readDataSource.query(
      `
        SELECT
          pi.image_url,
          pi.alt_text,
          pi.sort_order,
          pi.is_primary
        FROM product_images pi
        WHERE pi.product_id = $1
          AND pi.image_url IS NOT NULL
          AND pi.image_url <> ''
        ORDER BY
          COALESCE(pi.is_primary, false) DESC,
          pi.sort_order ASC NULLS LAST,
          pi.id ASC
      `,
      [productId],
    );

    const images: Array<{ url: string; alt_text?: string; sort_order?: number; is_primary?: boolean }> = [];
    const seen = new Set<string>();

    const addImage = (row: any, rawUrl: unknown): void => {
      const url = this.getSafeCatalogImageUrl(rawUrl);
      if (!url || seen.has(url)) {
        return;
      }

      const parsedSortOrder =
        row?.sort_order !== null && row?.sort_order !== undefined
          ? Number.parseInt(String(row.sort_order), 10)
          : undefined;

      images.push({
        url,
        alt_text: row?.alt_text || undefined,
        sort_order: Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
        is_primary: Boolean(row?.is_primary),
      });
      seen.add(url);
    };

    for (const row of rows) {
      addImage(row, row?.image_url);
    }

    const assetRows = await this.getProductAssetImageRows(readDataSource, productId);

    for (const row of assetRows) {
      addImage(row, this.getSafeCatalogImageUrl(row?.storage_url) || row?.source_url);
    }

    const primaryUrl = this.getSafeCatalogImageUrl(fallbackPrimaryUrl);
    if (primaryUrl && !seen.has(primaryUrl)) {
      images.unshift({
        url: primaryUrl,
        is_primary: true,
        sort_order: 0,
      });
    }

    return images;
  }

  private getB2BCustomerId(req: AuthenticatedRequest): string | number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    return b2bCustomer?.customer_id ?? b2bCustomer?.id;
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.user?.role === 'admin';
  }

  private getRequestBody(req: AuthenticatedRequest): Record<string, any> {
    return ((req as any).validatedBody ?? req.body ?? {}) as Record<string, any>;
  }

  private getRequestQuery(req: AuthenticatedRequest): Record<string, any> {
    return (req.validatedQuery ?? req.query ?? {}) as Record<string, any>;
  }

  private getCatalogCategorySqlExpression(): string {
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

  private normalizeCatalogSubcategory(
    rawCategory: string | null | undefined,
    rootCategory: string,
  ): string {
    const raw = String(rawCategory || '').trim();
    if (!raw) {
      return '';
    }

    const lower = raw.toLowerCase();
    const rootLower = String(rootCategory || '')
      .trim()
      .toLowerCase();

    if (!lower || (rootLower && lower === rootLower)) {
      return '';
    }

    if (
      lower === 'general' ||
      lower === 'diverse' ||
      lower === 'misc' ||
      lower === 'other' ||
      lower === 'inne' ||
      lower === 'pozostale' ||
      lower === 'pozostale produkty' ||
      lower === 'product categories' ||
      lower === 'oswietlenie' ||
      lower === 'inne zrodla swiatla' ||
      lower === 'akcesoria i osprzet' ||
      lower === 'sterowanie roletami / zaslonami'
    ) {
      return 'Diverse';
    }

    const hasNonAscii = /[^\x00-\x7F]/.test(raw);
    if (hasNonAscii) {
      return 'Diverse';
    }

    const mappedSubcategories: Record<string, string> = {
      'kable ac': 'Cabluri AC',
      'kable dc': 'Cabluri DC',
      akcesoria: 'Accesorii',
      falowniki: 'Invertoare',
      'inwertery domowe': 'Invertoare rezidentiale',
      czujniki: 'Senzori',
      bramki: 'Gateway',
      'panele dotykowe i stacje meteo': 'Panouri tactile si statii meteo',
      adws: 'ADWS',
      adin: 'ADIN',
      gpv: 'GPV',
      gpvp: 'GPVP',
      cob: 'COB',
      hqs: 'HQS',
      backlight: 'Backlight',
      'mi-light': 'MI-Light',
      alulicht: 'ALULICHT',
      'mw lighting': 'MW LIGHTING',
      'helios profile led': 'Helios profile LED',
      'pos-c / -c2': 'POS-C / -C2',
      'pos adapter/desktop': 'POS Adapter/Desktop',
      'sunny adapter': 'Sunny Adapter',
      'led neon': 'LED Neon',
      azzardo: 'Azzardo',
      'panouri led': 'Panouri LED',
      'downlight-uri': 'Downlight-uri',
      'spoturi led': 'Spoturi LED',
      'becuri led': 'Becuri LED',
      'tuburi led': 'Tuburi LED',
      'proiectoare led': 'Proiectoare LED',
      'hale & depozite': 'Hale & Depozite',
    };

    const mappedSubcategory = mappedSubcategories[lower];
    if (mappedSubcategory) {
      return mappedSubcategory;
    }

    if (lower.startsWith('kamery ')) {
      return raw.replace(/^kamery/i, 'Camere');
    }

    if (lower.startsWith('rejestratory ')) {
      return raw.replace(/^rejestratory/i, 'Inregistratoare');
    }

    if (lower.startsWith('inwertery ')) {
      return raw.replace(/^inwertery/i, 'Invertoare');
    }

    return 'Diverse';
  }

  private normalizeProductCode(value: unknown): string {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private mergeCatalogProductsBySearchCode(products: any[], search: unknown): any[] {
    const searchCode = this.normalizeProductCode(search);
    if (!searchCode || searchCode.length < 8 || !Array.isArray(products) || products.length < 2) {
      return products;
    }

    const groups = new Map<string, any[]>();

    for (const product of products) {
      const haystack = this.normalizeProductCode(`${product?.name || ''} ${product?.sku || ''}`);
      const key = haystack.includes(searchCode) ? `code:${searchCode}` : `id:${product?.id}`;
      const bucket = groups.get(key) || [];
      bucket.push(product);
      groups.set(key, bucket);
    }

    if (!groups.has(`code:${searchCode}`)) {
      return products;
    }

    const merged: any[] = [];
    for (const [key, bucket] of groups.entries()) {
      if (!key.startsWith('code:') || bucket.length === 1) {
        merged.push(...bucket);
        continue;
      }

      const representative = [...bucket].sort((a, b) => {
        const aSupplier = Number(a?.stock_supplier || 0);
        const bSupplier = Number(b?.stock_supplier || 0);
        if (aSupplier !== bSupplier) return bSupplier - aSupplier;
        const aTotal = Number(a?.stock_total || 0);
        const bTotal = Number(b?.stock_total || 0);
        if (aTotal !== bTotal) return bTotal - aTotal;
        return Number(a?.id || 0) - Number(b?.id || 0);
      })[0];

      const stockLocal = bucket.reduce((sum, item) => sum + (Number(item?.stock_local) || 0), 0);
      const stockSupplier = bucket.reduce((sum, item) => sum + (Number(item?.stock_supplier) || 0), 0);
      const supplierNames = Array.from(
        new Set(bucket.map((item) => String(item?.supplier_name || '').trim()).filter(Boolean)),
      );

      merged.push({
        ...representative,
        stock_local: stockLocal,
        stock_supplier: stockSupplier,
        stock_total: stockLocal + stockSupplier,
        supplier_name: supplierNames.length > 0 ? supplierNames.join(' + ') : representative?.supplier_name,
        merged_product_ids: bucket.map((item) => item.id),
      });
    }

    return merged;
  }

  async verifyCui(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cui } = req.body;

      if (!cui) {
        res.status(400).json({
          success: false,
          message: 'CUI is required',
          code: 'CUI_REQUIRED',
        });
        return;
      }

      const result: AnafValidationResult = await this.anafValidationService.validateCui(cui);

      if (!result.valid) {
        const statusCode =
          result.code === 'INVALID_FORMAT'
            ? 400
            : result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'ANAF_UNAVAILABLE'
                ? 503
                : 500;

        res.status(statusCode).json({
          success: false,
          message: result.error,
          code: result.code,
        });
        return;
      }

      const company = result.company!;

      res.status(200).json({
        success: true,
        data: {
          cui: company.cui,
          denumire: company.denumire,
          adresa: company.adresa,
          nrRegCom: company.nrRegCom,
          telefon: company.telefon || '',
          codPostal: company.codPostal || '',
          stare_inregistrare: company.stareInregistrare,
          data_inregistrare: company.dataInregistrare || '',
          cod_CAEN: company.codCAEN || '',
          scpTVA: company.scpTVA,
          dataInceputTVA: company.dataInceputTVA || null,
          dataSfarsitTVA: company.dataSfarsitTVA || null,
          statusTVA: company.statusTVA,
          statusInactivi: company.statusInactivi,
          dataInactivare: company.dataInactivare || null,
          dataReactivare: company.dataReactivare || null,
          statusSplitTVA: company.statusSplitTVA,
          organFiscalCompetent: company.organFiscalCompetent || '',
          forma_juridica: company.formaJuridica || '',
          statusRO_e_Factura: company.statusROeFactura,
          validated_at: company.validatedAt,
          source: company.source,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyCuiGet(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cui } = req.params;

      if (!cui) {
        res.status(400).json({
          success: false,
          message: 'CUI is required',
          code: 'CUI_REQUIRED',
        });
        return;
      }

      const result: AnafValidationResult = await this.anafValidationService.validateCui(cui);

      if (!result.valid) {
        const statusCode =
          result.code === 'INVALID_FORMAT'
            ? 400
            : result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'ANAF_UNAVAILABLE'
                ? 503
                : 500;

        res.status(statusCode).json({
          success: false,
          message: result.error,
          code: result.code,
        });
        return;
      }

      const company = result.company!;

      res.status(200).json({
        success: true,
        data: {
          cui: company.cui,
          denumire: company.denumire,
          adresa: company.adresa,
          nrRegCom: company.nrRegCom,
          telefon: company.telefon || '',
          codPostal: company.codPostal || '',
          stare_inregistrare: company.stareInregistrare,
          data_inregistrare: company.dataInregistrare || '',
          cod_CAEN: company.codCAEN || '',
          scpTVA: company.scpTVA,
          dataInceputTVA: company.dataInceputTVA || null,
          dataSfarsitTVA: company.dataSfarsitTVA || null,
          statusTVA: company.statusTVA,
          statusInactivi: company.statusInactivi,
          dataInactivare: company.dataInactivare || null,
          dataReactivare: company.dataReactivare || null,
          statusSplitTVA: company.statusSplitTVA,
          organFiscalCompetent: company.organFiscalCompetent || '',
          forma_juridica: company.formaJuridica || '',
          statusRO_e_Factura: company.statusROeFactura,
          validated_at: company.validatedAt,
          source: company.source,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register a new B2B customer
   *
   * @param req - Express request with validated registration data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with registration confirmation
   */
  async registerB2BCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input: RegisterB2BInput = {
        companyName: req.body.company_name,
        cui: req.body.company_registration_number,
        regCom: req.body.reg_com_number || req.body.company_registration_number,
        legalAddress: req.body.billing_address,
        deliveryAddress: req.body.shipping_address,
        contactPerson: req.body.contact_name,
        email: req.body.contact_email,
        phone: req.body.contact_phone,
        bankName: req.body.bank_name || '',
        iban: req.body.iban || '',
        requestedTier: req.body.requested_tier || 'STANDARD',
        paymentTermsDays: req.body.payment_terms,
        notes: req.body.notes || '',
      };

      const result = await this.registerB2BUseCase.execute(input);

      res.status(201).json({
        success: true,
        data: {
          registration_id: result.id,
          company_name: result.companyName,
          contact_email: result.email,
          status: result.status,
          created_at: result.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List B2B registrations (admin only)
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of registrations
   */
  async listRegistrations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        date_from,
        date_to,
      } = this.getRequestQuery(req);

      const result = await this.registrationRepository.findAll(
        { status, search, createdFromDate: date_from, createdToDate: date_to },
        { page, limit },
      );

      res.status(200).json(
        result.items.map((r: any) => ({
          id: r.id,
          companyName: r.companyName,
          cui: r.cui,
          regCom: r.regCom,
          contactPerson: r.contactPerson,
          email: r.email,
          phone: r.phone,
          legalAddress: r.legalAddress,
          status: r.status,
          createdAt: r.createdAt,
        })),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get B2B registration details
   *
   * @param req - Express request with registration ID
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with registration details
   */
  async getRegistrationDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const registration = await this.registrationRepository.findById(id);

      if (!registration) {
        res.status(404).json({
          success: false,
          error: {
            code: 'REGISTRATION_NOT_FOUND',
            message: `B2B registration with ID ${id} not found`,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          registration_id: registration.id ?? id,
          company_name: registration.companyName,
          company_registration_number: registration.cui,
          reg_com_number: registration.regCom,
          billing_address: registration.legalAddress,
          shipping_address: registration.deliveryAddress,
          contact_name: registration.contactPerson,
          contact_email: registration.email,
          contact_phone: registration.phone,
          bank_name: registration.bankName,
          iban: registration.iban,
          requested_tier: registration.requestedTier,
          payment_terms: registration.paymentTermsDays,
          notes: registration.notes,
          status: registration.status,
          created_at: registration.createdAt,
          updated_at: registration.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Review B2B registration - approve or reject
   *
   * @param req - Express request with registration ID and review data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with review result
   */
  async reviewRegistration(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status, approved_credit_limit, rejection_reason, notes, tier, payment_terms } =
        req.body;
      const reviewedBy = req.user?.id || 'admin'; // Fallback for dev

      const input: ReviewRegistrationInput = {
        registrationId: id,
        action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        tier,
        creditLimit: approved_credit_limit,
        paymentTermsDays: payment_terms,
        reason: rejection_reason,
        reviewerId: reviewedBy,
      };

      const result = await this.reviewRegistrationUseCase.execute(input);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List B2B customers
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of customers
   */
  async listCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        tier,
        is_active,
        search,
        min_total_spent,
        max_total_spent,
      } = this.getRequestQuery(req);

      const filters = {
        tier,
        isActive: is_active !== undefined ? is_active === 'true' : undefined,
        search,
        minTotalSpent: min_total_spent ? parseFloat(min_total_spent) : undefined,
        maxTotalSpent: max_total_spent ? parseFloat(max_total_spent) : undefined,
      };

      const result = await this.customerRepository.search(filters, {
        page: Number(page),
        limit: Number(limit),
      });

      res.status(200).json({
        success: true,
        data: {
          customers: result.items.map((customer: any) => ({
            id: customer.id,
            registration_id: customer.registrationId,
            company_name: customer.companyName,
            cui: customer.cui,
            tier: customer.tier,
            credit_limit: customer.creditLimit,
            used_credit: customer.usedCredit,
            available_credit: customer.creditLimit - (customer.usedCredit || 0),
            payment_terms_days: customer.paymentTermsDays,
            is_active: customer.isActive,
            total_orders: customer.totalOrders,
            total_spent: customer.totalSpent,
            created_at: customer.createdAt,
            updated_at: customer.updatedAt,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            total_pages: result.totalPages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get B2B customer details
   *
   * @param req - Express request with customer ID
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with customer details
   */
  async getCustomerDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const b2bCustomerId = this.getB2BCustomerId(req);

      if (b2bCustomerId && String(id) !== String(b2bCustomerId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied for requested customer',
          },
        });
        return;
      }

      if (
        !b2bCustomerId &&
        !this.isAdmin(req) &&
        req.user?.id &&
        String(id) !== String(req.user.id)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied for requested customer',
          },
        });
        return;
      }

      const scopedCustomerId = b2bCustomerId || id;

      const customer = await this.customerRepository.findById(scopedCustomerId);

      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `B2B customer with ID ${scopedCustomerId} not found`,
          },
        });
        return;
      }

      // Get recent credit transactions (table may not exist yet)
      let creditTransactions: any[] = [];
      try {
        creditTransactions = await this.dataSource.query(
          `SELECT id, amount, type, description, created_at
           FROM credit_limits
           WHERE customer_id = $1
           ORDER BY created_at DESC
           LIMIT 10`,
          [scopedCustomerId],
        );
      } catch {
        // credit_limits table may not exist or have different schema
        creditTransactions = [];
      }

      // Get recent orders
      const recentOrders = await this.dataSource.query(
        `SELECT id, order_number, total, status, created_at
         FROM b2b_orders
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [scopedCustomerId],
      );

      res.status(200).json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            registration_id: customer.registrationId,
            company_name: customer.companyName,
            cui: customer.cui,
            tier: customer.tier,
            credit_limit: customer.creditLimit,
            used_credit: customer.usedCredit,
            available_credit: customer.creditLimit - (customer.usedCredit || 0),
            payment_terms_days: customer.paymentTermsDays,
            is_active: customer.isActive,
            total_orders: customer.totalOrders,
            total_spent: customer.totalSpent,
            sales_rep_id: customer.salesRepId,
            created_at: customer.createdAt,
            updated_at: customer.updatedAt,
          },
          credit_transactions: creditTransactions.map((tx: any) => ({
            id: tx.id,
            amount: parseFloat(tx.amount),
            type: tx.type,
            description: tx.description,
            created_at: tx.created_at,
          })),
          recent_orders: recentOrders.map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            total_amount: parseFloat(order.total),
            status: order.status,
            created_at: order.created_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adjust customer credit limit (admin only)
   *
   * @param req - Express request with customer ID and new credit limit
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with updated credit limit
   */
  async adjustCreditLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { new_credit_limit, reason } = this.getRequestBody(req);
      const adjustedBy = req.user?.id;

      // Validate input
      if (!new_credit_limit || new_credit_limit < 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CREDIT_LIMIT',
            message: 'Credit limit must be a positive number',
          },
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REASON_REQUIRED',
            message: 'Reason for credit limit adjustment is required',
          },
        });
        return;
      }

      // Get current customer to retrieve old credit limit
      const customer = await this.customerRepository.findById(id);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `B2B customer with ID ${id} not found`,
          },
        });
        return;
      }

      const oldCreditLimit = customer.creditLimit;

      // Update credit limit
      await this.customerRepository.updateCredit(id, new_credit_limit);

      // Log transaction in credit_transactions table
      await this.dataSource.query(
        `INSERT INTO b2b_credit_transactions (customer_id, amount, type, description, adjusted_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, new_credit_limit - oldCreditLimit, 'ADJUSTMENT', reason, adjustedBy || 'system'],
      );

      // TODO: Publish event: credit_limit.adjusted
      // TODO: Send notification to customer

      res.status(200).json({
        success: true,
        data: {
          customer_id: id,
          new_credit_limit,
          old_credit_limit: oldCreditLimit,
          reason,
          adjusted_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a saved cart
   *
   * @param req - Express request with cart data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with saved cart details
   */
  async createSavedCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cart_name, items, notes, customer_id } = this.getRequestBody(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId =
        b2bCustomerId || (this.isAdmin(req) ? customer_id || req.user?.id : req.user?.id);

      if (!customerId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CUSTOMER_ID_REQUIRED',
            message: 'Customer context is required',
          },
        });
        return;
      }

      // Validate customer exists
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer with ID ${customerId} not found`,
          },
        });
        return;
      }

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EMPTY_CART',
            message: 'Cart must contain at least one item',
          },
        });
        return;
      }

      // Validate cart name
      if (!cart_name || cart_name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CART_NAME',
            message: 'Cart name is required',
          },
        });
        return;
      }

      // Validate and enrich items with product details
      const enrichedItems = [];
      let totalAmount = 0;

      for (const item of items) {
        if (!item.product_id || !item.quantity) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ITEM',
              message: 'Each item must have product_id and quantity',
            },
          });
          return;
        }

        // Get product details
        const productQuery = `
          SELECT id, sku, name, base_price
          FROM products
          WHERE id = $1 AND is_active = true
        `;
        const productResult = await this.dataSource.query(productQuery, [item.product_id]);

        if (productResult.length === 0) {
          res.status(404).json({
            success: false,
            error: {
              code: 'PRODUCT_NOT_FOUND',
              message: `Product with ID ${item.product_id} not found or inactive`,
            },
          });
          return;
        }

        const product = productResult[0];
        const unitPrice = item.price || parseFloat(product.base_price);
        const quantity = parseInt(item.quantity);
        const subtotal = unitPrice * quantity;

        enrichedItems.push({
          id: this.createPrefixedId('item'),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: quantity,
          unitPrice: unitPrice,
          subtotal: subtotal,
          notes: item.notes || undefined,
        });

        totalAmount += subtotal;
      }

      // Create saved cart entity
      const cartId = this.createPrefixedId('cart');
      const savedCart = {
        id: cartId,
        customerId: customerId,
        name: cart_name,
        description: notes,
        items: enrichedItems,
        totalAmount: totalAmount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this.dataSource.query(
        `INSERT INTO saved_carts (id, customer_id, name, description, items, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          savedCart.id,
          savedCart.customerId,
          savedCart.name,
          savedCart.description,
          JSON.stringify(savedCart.items),
          savedCart.totalAmount,
          savedCart.createdAt,
          savedCart.updatedAt,
        ],
      );

      res.status(201).json({
        success: true,
        data: {
          cart_id: savedCart.id,
          cart_name: savedCart.name,
          customer_id: savedCart.customerId,
          items: enrichedItems.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            subtotal: item.subtotal,
            notes: item.notes,
          })),
          item_count: enrichedItems.length,
          total_amount: totalAmount,
          notes: notes,
          created_at: savedCart.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List saved carts
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of saved carts
   */
  async listSavedCarts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { page = 1, limit = 20, search, customer_id } = this.getRequestQuery(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId = b2bCustomerId || (this.isAdmin(req) ? customer_id : req.user?.id);

      // Validate customer exists
      if (customerId) {
        const customer = await this.customerRepository.findById(customerId);
        if (!customer) {
          res.status(404).json({
            success: false,
            error: {
              code: 'CUSTOMER_NOT_FOUND',
              message: `Customer with ID ${customerId} not found`,
            },
          });
          return;
        }
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereClause = customerId ? 'WHERE sc.customer_id = $1' : 'WHERE 1=1';
      const params: any[] = customerId ? [customerId] : [];
      const countParams: any[] = customerId ? [customerId] : [];

      if (search) {
        const searchIndex = params.length + 1;
        whereClause += ` AND sc.name ILIKE $${searchIndex}`;
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      // Add pagination params
      params.push(limitNum);
      params.push(offset);

      // Count total carts
      const countQuery = `
        SELECT COUNT(*) as total
        FROM saved_carts sc
        ${whereClause}
      `;
      const countResult = await this.dataSource.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0', 10);

      // Fetch saved carts
      const query = `
        SELECT
          sc.id,
          sc.customer_id,
          sc.name,
          sc.description,
          sc.items,
          sc.total_amount,
          sc.created_at,
          sc.updated_at,
          c.company_name
        FROM saved_carts sc
        LEFT JOIN b2b_customers c ON sc.customer_id = c.id
        ${whereClause}
        ORDER BY sc.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const carts = await this.dataSource.query(query, params);

      res.status(200).json({
        success: true,
        data: {
          carts: carts.map((cart: any) => {
            const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
            return {
              cart_id: cart.id,
              customer_id: cart.customer_id,
              company_name: cart.company_name,
              cart_name: cart.name,
              description: cart.description,
              items: items.map((item: any) => ({
                product_id: item.productId,
                product_name: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                subtotal: item.subtotal,
                notes: item.notes,
              })),
              item_count: items.length,
              total_items: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
              total_amount: parseFloat(cart.total_amount),
              created_at: cart.created_at,
              updated_at: cart.updated_at,
            };
          }),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create bulk order
   *
   * @param req - Express request with bulk order data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with created bulk order details
   */
  async createBulkOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { items, shipping_address, notes, customer_id } = this.getRequestBody(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId =
        b2bCustomerId || (this.isAdmin(req) ? customer_id || req.user?.id : req.user?.id);

      if (!customerId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CUSTOMER_ID_REQUIRED',
            message: 'Customer context is required',
          },
        });
        return;
      }

      // Validate customer exists
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer with ID ${customerId} not found`,
          },
        });
        return;
      }

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EMPTY_ORDER',
            message: 'Order must contain at least one item',
          },
        });
        return;
      }

      // Validate and process items
      const orderItems = [];
      let totalAmount = 0;
      const stockErrors = [];

      for (const item of items) {
        if (!item.product_id || !item.quantity) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ITEM',
              message: 'Each item must have product_id and quantity',
            },
          });
          return;
        }

        // Get product details and stock
        const productQuery = `
          SELECT
            p.id,
            p.sku,
            p.name,
            p.base_price,
            COALESCE(
              SUM(
                CASE
                  WHEN sw.is_active = true AND (sw.code ILIKE 'SB-%' OR sw.name ILIKE 'magazin')
                    THEN sl.quantity_available
                  ELSE 0
                END
              ),
              0
            ) as stock_available
          FROM products p
          LEFT JOIN stock_levels sl ON p.id = sl.product_id
          LEFT JOIN warehouses sw ON sw.id = sl.warehouse_id
          WHERE p.id = $1 AND p.is_active = true
          GROUP BY p.id, p.sku, p.name, p.base_price
        `;
        const productResult = await this.dataSource.query(productQuery, [item.product_id]);

        if (productResult.length === 0) {
          res.status(404).json({
            success: false,
            error: {
              code: 'PRODUCT_NOT_FOUND',
              message: `Product with ID ${item.product_id} not found or inactive`,
            },
          });
          return;
        }

        const product = productResult[0];
        const quantity = parseInt(item.quantity);
        const stockAvailable = parseInt(product.stock_available);

        // Check stock availability
        if (stockAvailable < quantity) {
          stockErrors.push({
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            requested: quantity,
            available: stockAvailable,
          });
        }

        const unitPrice = parseFloat(product.base_price);
        const lineTotal = unitPrice * quantity;

        orderItems.push({
          id: this.createPrefixedId('item'),
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          quantity: quantity,
          unitPrice: unitPrice,
          lineTotal: lineTotal,
        });

        totalAmount += lineTotal;
      }

      // If there are stock errors, return them
      if (stockErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Some items have insufficient stock',
            details: stockErrors,
          },
        });
        return;
      }

      // Check credit limit
      const availableCredit = customer.creditLimit - (customer.usedCredit || 0);
      if (totalAmount > availableCredit) {
        res.status(402).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_CREDIT',
            message: 'Order total exceeds available credit',
            details: {
              order_total: totalAmount,
              credit_limit: customer.creditLimit,
              used_credit: customer.usedCredit || 0,
              available_credit: availableCredit,
              shortfall: totalAmount - availableCredit,
            },
          },
        });
        return;
      }

      // Generate order number
      const orderNumber = this.createBulkOrderNumber();
      const orderId = this.createPrefixedId('order');

      // Create bulk order in database
      const orderData = {
        id: orderId,
        customerId: customerId,
        orderNumber: orderNumber,
        status: 'PENDING',
        items: orderItems,
        totalAmount: totalAmount,
        itemCount: orderItems.length,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.dataSource.query(
        `INSERT INTO bulk_orders (id, customer_id, order_number, status, items, total_amount, item_count, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderData.id,
          orderData.customerId,
          orderData.orderNumber,
          orderData.status,
          JSON.stringify(orderData.items),
          orderData.totalAmount,
          orderData.itemCount,
          orderData.notes,
          orderData.createdAt,
          orderData.updatedAt,
        ],
      );

      // Deduct stock for each ordered item
      for (const item of orderItems) {
        await this.dataSource.query(
          `UPDATE stock_levels
           SET quantity_available = quantity_available - $1,
               updated_at = NOW()
           WHERE id = (
             SELECT sl.id
             FROM stock_levels sl
             JOIN warehouses w ON w.id = sl.warehouse_id
             WHERE sl.product_id = $2
               AND w.is_active = true
               AND (w.code ILIKE 'SB-%' OR w.name ILIKE 'magazin')
               AND sl.quantity_available >= $1
             ORDER BY sl.quantity_available DESC
             LIMIT 1
           )`,
          [item.quantity, item.productId],
        );
      }

      await invalidateInventoryReadCacheNamespace();

      // Update customer used credit
      const newUsedCredit = (customer.usedCredit || 0) + totalAmount;
      await this.dataSource.query(
        `UPDATE b2b_customers SET used_credit = $1, updated_at = NOW() WHERE id = $2`,
        [newUsedCredit, customerId],
      );

      // Log credit transaction
      await this.dataSource.query(
        `INSERT INTO b2b_credit_transactions (id, customer_id, amount, type, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          this.createPrefixedId('tx'),
          customerId,
          totalAmount,
          'ORDER',
          `Bulk order ${orderNumber}`,
        ],
      );

      try {
        await getEventBus().publish('b2b.bulk_order', {
          orderId: orderData.id,
          orderNumber: orderData.orderNumber,
          customerId: customerId,
          totalAmount: totalAmount,
          itemCount: orderItems.length,
          createdAt: orderData.createdAt,
        });
      } catch (eventError) {
        console.error('Failed to publish b2b.bulk_order event:', eventError);
      }

      res.status(201).json({
        success: true,
        data: {
          order_id: orderData.id,
          order_number: orderData.orderNumber,
          customer_id: orderData.customerId,
          status: orderData.status,
          items: orderItems.map((item) => ({
            product_id: item.productId,
            sku: item.sku,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.lineTotal,
          })),
          item_count: orderData.itemCount,
          total_amount: orderData.totalAmount,
          shipping_address: shipping_address,
          notes: orderData.notes,
          credit_info: {
            previous_used_credit: customer.usedCredit || 0,
            new_used_credit: newUsedCredit,
            credit_limit: customer.creditLimit,
            available_credit: customer.creditLimit - newUsedCredit,
          },
          created_at: orderData.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List bulk orders
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of bulk orders
   */
  async listBulkOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        date_from,
        date_to,
        customer_id,
      } = this.getRequestQuery(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId = b2bCustomerId || (this.isAdmin(req) ? customer_id : req.user?.id);

      // Validate customer exists if customer_id is provided
      if (customerId) {
        const customer = await this.customerRepository.findById(customerId);
        if (!customer) {
          res.status(404).json({
            success: false,
            error: {
              code: 'CUSTOMER_NOT_FOUND',
              message: `Customer with ID ${customerId} not found`,
            },
          });
          return;
        }
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereClause = customerId ? 'WHERE bo.customer_id = $1' : 'WHERE 1=1';
      const params: any[] = customerId ? [customerId] : [];
      const countParams: any[] = customerId ? [customerId] : [];

      if (status) {
        const statusIndex = params.length + 1;
        whereClause += ` AND bo.status = $${statusIndex}`;
        params.push(status.toUpperCase());
        countParams.push(status.toUpperCase());
      }

      if (date_from) {
        const dateFromIndex = params.length + 1;
        whereClause += ` AND bo.created_at >= $${dateFromIndex}`;
        params.push(date_from);
        countParams.push(date_from);
      }

      if (date_to) {
        const dateToIndex = params.length + 1;
        whereClause += ` AND bo.created_at <= $${dateToIndex}`;
        params.push(date_to);
        countParams.push(date_to);
      }

      // Add pagination params
      params.push(limitNum);
      params.push(offset);

      // Count total orders
      const countQuery = `
        SELECT COUNT(*) as total
        FROM bulk_orders bo
        ${whereClause}
      `;
      const countResult = await this.dataSource.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0', 10);

      // Fetch bulk orders
      const query = `
        SELECT
          bo.id,
          bo.customer_id,
          bo.order_number,
          bo.status,
          bo.items,
          bo.total_amount,
          bo.item_count,
          bo.notes,
          bo.confirmed_at,
          bo.shipped_at,
          bo.delivered_at,
          bo.created_at,
          bo.updated_at,
          c.company_name,
          c.tier
        FROM bulk_orders bo
        LEFT JOIN b2b_customers c ON bo.customer_id = c.id
        ${whereClause}
        ORDER BY bo.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const orders = await this.dataSource.query(query, params);

      res.status(200).json({
        success: true,
        data: {
          orders: orders.map((order: any) => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            return {
              order_id: order.id,
              order_number: order.order_number,
              customer_id: order.customer_id,
              company_name: order.company_name,
              tier: order.tier,
              status: order.status,
              items: items.map((item: any) => ({
                product_id: item.productId,
                sku: item.sku,
                product_name: item.productName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                line_total: item.lineTotal,
              })),
              item_count: order.item_count,
              total_items: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
              total_amount: parseFloat(order.total_amount),
              notes: order.notes,
              confirmed_at: order.confirmed_at,
              shipped_at: order.shipped_at,
              delivered_at: order.delivered_at,
              created_at: order.created_at,
              updated_at: order.updated_at,
            };
          }),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * List products for B2B catalog
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async listProducts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestQuery = this.getRequestQuery(req);
      const { page = 1, limit = 100, sort = 'newest', search, category, stock } = requestQuery;
      const compactMode =
        requestQuery.compact === true ||
        requestQuery.compact === 'true' ||
        requestQuery.compact === '1';

      const serializeCatalogDescription = (value: unknown): string => {
        const normalized = String(value || '').trim();
        if (!compactMode || normalized.length <= 220) {
          return normalized;
        }

        return `${normalized.slice(0, 217).trimEnd()}...`;
      };

      const toArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map((item) => String(item || '').trim()).filter((item) => item.length > 0);
        }

        const normalized = String(value || '').trim();
        if (!normalized) {
          return [];
        }

        return normalized
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      };

      const selectedKelvin = toArray(requestQuery.kelvin);
      const selectedIp = toArray(requestQuery.ip);
      const selectedBrands = toArray(requestQuery.brand);
      const selectedMountingTypes = toArray(
        requestQuery.mountingType ?? requestQuery.mounting_type,
      );
      const selectedStripTypes = toArray(requestQuery.stripType ?? requestQuery.strip_type);
      const selectedLedVoltages = toArray(requestQuery.ledVoltage ?? requestQuery.led_voltage);
      const selectedLightColors = toArray(requestQuery.lightColor ?? requestQuery.light_color);

      const minPrice =
        requestQuery.min_price !== undefined ? Number(requestQuery.min_price) : undefined;
      const maxPrice =
        requestQuery.max_price !== undefined ? Number(requestQuery.max_price) : undefined;

      const categorySql = this.getCatalogCategorySqlExpression();

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(120, Math.max(1, Number(limit) || 100));
      const offset = (pageNum - 1) * limitNum;

      const projectionResult = await this.listProductsFromProjection({
        page: pageNum,
        limit: limitNum,
        sort,
        search,
        category,
        stock,
        kelvin: selectedKelvin,
        ip: selectedIp,
        brand: selectedBrands,
        mountingType: selectedMountingTypes,
        stripType: selectedStripTypes,
        ledVoltage: selectedLedVoltages,
        lightColor: selectedLightColors,
        minPrice,
        maxPrice,
      });

      if (projectionResult) {
        const catalogProducts = projectionResult.products.map((p: any) => {
          const stockLocal = parseInt(p.local_stock) || 0;
          const stockSupplier = parseInt(p.supplier_stock) || 0;

          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: serializeCatalogDescription(p.description),
            price: parseFloat(p.price) || 0,
            currency: p.currency || 'RON',
            image_url: this.getSafeCatalogImageUrl(p.primary_image_url),
            category: p.category_root || p.category_raw || 'Diverse',
            subcategory: this.normalizeCatalogSubcategory(p.category_raw, p.category_root),
            brand: p.brand || null,
            mounting_type: p.mounting_type || null,
            ip_rating: p.ip_rating || null,
            color_temperature: p.color_temperature ? Number(p.color_temperature) : null,
            supplier_name: p.supplier_name || null,
            stock_local: stockLocal,
            stock_supplier: stockSupplier,
            stock_total: stockLocal + stockSupplier,
            supplier_lead_time: parseInt(p.supplier_lead_time) || 3,
          };
        });

        const mergedProducts = this.mergeCatalogProductsBySearchCode(catalogProducts, search);

        res.status(200).json({
          success: true,
          data: {
            products: mergedProducts,
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: projectionResult.total,
              total_pages: Math.ceil(projectionResult.total / limitNum),
            },
          },
        });
        return;
      }

      const readDataSource = getReadDataSource(this.dataSource);

      // Build WHERE clause
      let whereClause = 'WHERE p.is_active = true AND p.deleted_at IS NULL';
      const params: any[] = [limitNum, offset];
      const countParams: any[] = [];

      if (search) {
        whereClause += ' AND (p.sku ILIKE $3 OR p.name ILIKE $3)';
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      if (category) {
        const categoryIndex = search ? 4 : 3;
        whereClause += ` AND (${categorySql} ILIKE $${categoryIndex} OR c.name ILIKE $${categoryIndex})`;
        params.push(`%${category}%`);
        countParams.push(`%${category}%`);
      }

      if (stock === 'supplier') {
        whereClause += `
          AND EXISTS (
            SELECT 1
            FROM supplier_stock_cache sc2
            WHERE sc2.product_id = p.id
              AND sc2.is_available = true
              AND sc2.quantity_available > 0
          )
        `;
      }

      if (stock === 'local') {
        whereClause += `
          AND EXISTS (
            SELECT 1
            FROM stock_levels sl2
            JOIN warehouses sw2 ON sw2.id = sl2.warehouse_id
            WHERE sl2.product_id = p.id
              AND sw2.is_active = true
              AND (sw2.code ILIKE 'SB-%' OR sw2.name ILIKE 'magazin')
              AND sl2.quantity_available > 0
          )
        `;
      }

      if (stock === 'stock') {
        whereClause += `
          AND (
            EXISTS (
              SELECT 1
              FROM supplier_stock_cache sc2
              WHERE sc2.product_id = p.id
                AND sc2.is_available = true
                AND sc2.quantity_available > 0
            )
            OR EXISTS (
              SELECT 1
              FROM stock_levels sl2
              JOIN warehouses sw2 ON sw2.id = sl2.warehouse_id
              WHERE sl2.product_id = p.id
                AND sw2.is_active = true
                AND (sw2.code ILIKE 'SB-%' OR sw2.name ILIKE 'magazin')
                AND sl2.quantity_available > 0
            )
          )
        `;
      }

      if (typeof minPrice === 'number' && Number.isFinite(minPrice)) {
        const minPriceIndex = params.length + 1;
        whereClause += ` AND p.base_price >= $${minPriceIndex}`;
        params.push(minPrice);
        countParams.push(minPrice);
      }

      if (typeof maxPrice === 'number' && Number.isFinite(maxPrice)) {
        const maxPriceIndex = params.length + 1;
        whereClause += ` AND p.base_price <= $${maxPriceIndex}`;
        params.push(maxPrice);
        countParams.push(maxPrice);
      }

      if (selectedKelvin.length > 0) {
        const kelvinStart = params.length + 1;
        const kelvinConditions = selectedKelvin.map((value, index) => {
          const param = `$${kelvinStart + index}`;
          return `(COALESCE(ps.color_temperature::text, '') = ${param} OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* ('(^|[^0-9])' || regexp_replace(${param}, '[^0-9]', '', 'g') || '\\s*k([^0-9]|$)'))`;
        });
        whereClause += ` AND (${kelvinConditions.join(' OR ')})`;
        params.push(...selectedKelvin);
        countParams.push(...selectedKelvin);
      }

      if (selectedIp.length > 0) {
        const normalizedIpValues = selectedIp.map((value) => value.toUpperCase());
        const ipStart = params.length + 1;
        const ipConditions = normalizedIpValues.map((_, index) => {
          const param = `$${ipStart + index}`;
          return `(UPPER(COALESCE(ps.ip_rating, '')) = ${param} OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ILIKE ('%' || LOWER(${param}) || '%'))`;
        });
        whereClause += ` AND (${ipConditions.join(' OR ')})`;
        params.push(...normalizedIpValues);
        countParams.push(...normalizedIpValues);
      }

      if (selectedBrands.length > 0) {
        const normalizedBrands = selectedBrands.map((value) => value.toLowerCase());
        const brandStart = params.length + 1;
        const brandConditions = normalizedBrands.map((_, index) => {
          const param = `$${brandStart + index}`;
          return `LOWER(COALESCE(ps.brand, s.name, '')) = ${param}`;
        });
        whereClause += ` AND (${brandConditions.join(' OR ')})`;
        params.push(...normalizedBrands);
        countParams.push(...normalizedBrands);
      }

      if (selectedMountingTypes.length > 0) {
        const normalizedMounting = selectedMountingTypes.map((value) => value.toLowerCase());
        const mountingStart = params.length + 1;
        const mountingConditions = normalizedMounting.map((_, index) => {
          const param = `$${mountingStart + index}`;
          return `LOWER(COALESCE(ps.mounting_type, '')) = ${param}`;
        });
        whereClause += ` AND (${mountingConditions.join(' OR ')})`;
        params.push(...normalizedMounting);
        countParams.push(...normalizedMounting);
      }

      if (selectedStripTypes.length > 0) {
        const normalizedStripTypes = selectedStripTypes.map((value) => value.toLowerCase());
        const stripStart = params.length + 1;
        const stripConditions = normalizedStripTypes.map((_, index) => {
          const param = `$${stripStart + index}`;
          return `LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* ('(^|[^a-z0-9])' || regexp_replace(${param}, '[^a-z0-9]', '', 'g') || '(?:\\s*\\d{3,4})?([^a-z0-9]|$)')`;
        });
        whereClause += ` AND (${stripConditions.join(' OR ')})`;
        params.push(...normalizedStripTypes);
        countParams.push(...normalizedStripTypes);
      }

      if (selectedLedVoltages.length > 0) {
        const normalizedVoltages = selectedLedVoltages
          .map((value) => value.replace(/[^0-9]/g, ''))
          .filter((value) => value.length > 0);

        if (normalizedVoltages.length > 0) {
          const voltageStart = params.length + 1;
          const voltageConditions = normalizedVoltages.map((_, index) => {
            const param = `$${voltageStart + index}`;
            return `LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* ('(^|[^0-9])' || ${param} || '\\s*v([^0-9]|$)')`;
          });
          whereClause += ` AND (${voltageConditions.join(' OR ')})`;
          params.push(...normalizedVoltages);
          countParams.push(...normalizedVoltages);
        }
      }

      if (selectedLightColors.length > 0) {
        const normalizedLightColors = selectedLightColors.map((value) => value.toLowerCase());
        const colorStart = params.length + 1;
        const colorConditions = normalizedLightColors.map((_, index) => {
          const param = `$${colorStart + index}`;
          return `(
            LOWER(COALESCE(ps.led_color, '')) ILIKE ('%' || ${param} || '%')
            OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ILIKE ('%' || ${param} || '%')
            OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* ('(^|[^0-9])' || regexp_replace(${param}, '[^0-9]', '', 'g') || '\\s*k([^0-9]|$)')
          )`;
        });
        whereClause += ` AND (${colorConditions.join(' OR ')})`;
        params.push(...normalizedLightColors);
        countParams.push(...normalizedLightColors);
      }

      // Count total products
      const countWhereClause = whereClause.replace(/\$(\d+)/g, (_match, index) => {
        return `$${Number(index) - 2}`;
      });
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN LATERAL (
          SELECT
            ps.brand,
            ps.mounting_type,
            ps.ip_rating,
            ps.color_temperature,
            ps.led_color
          FROM product_specifications ps
          WHERE ps.product_id = p.id
          ORDER BY ps.updated_at DESC NULLS LAST, ps.id DESC
          LIMIT 1
        ) ps ON true
        ${countWhereClause}
      `;
      const countResult = await readDataSource.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0', 10);

      let orderClause = 'p.updated_at DESC, p.name ASC';
      if (sort === 'price_asc') {
        orderClause = 'p.base_price ASC NULLS LAST, p.name ASC';
      } else if (sort === 'price_desc') {
        orderClause = 'p.base_price DESC NULLS LAST, p.name ASC';
      } else if (sort === 'name_asc') {
        orderClause = 'p.name ASC';
      } else if (sort === 'popularity') {
        orderClause = '(COALESCE(stock_total.quantity, 0) + COALESCE(ssc.supplier_stock, 0)) DESC, p.name ASC';
      } else if (search) {
        orderClause = `
          CASE
            WHEN LOWER(p.sku) = LOWER(REPLACE($3, '%', '')) THEN 0
            WHEN LOWER(p.sku) LIKE LOWER(REPLACE($3, '%', '')) || '%' THEN 1
            WHEN LOWER(p.name) LIKE LOWER(REPLACE($3, '%', '')) || '%' THEN 2
            WHEN LOWER(p.name) LIKE LOWER($3) THEN 3
            ELSE 4
          END ASC,
          p.updated_at DESC,
          p.name ASC
        `;
      }

      // Fetch products with stock information
      const productsQuery = `
        SELECT
          p.id,
          p.sku,
          p.name,
          p.description,
          p.base_price as price,
          p.currency_code as currency,
          c.name as category_raw,
          s.name as supplier_name,
          ${categorySql} as category_root,
          ps.brand,
          ps.mounting_type,
          ps.ip_rating,
          ps.color_temperature,
          COALESCE(stock_total.quantity, 0) as stock_local,
          COALESCE(ssc.supplier_stock, 0) as stock_supplier,
          COALESCE(ssc.supplier_lead_time, 3) as supplier_lead_time
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN LATERAL (
          SELECT
            ps.brand,
            ps.mounting_type,
            ps.ip_rating,
            ps.color_temperature
          FROM product_specifications ps
          WHERE ps.product_id = p.id
          ORDER BY ps.updated_at DESC NULLS LAST, ps.id DESC
          LIMIT 1
        ) ps ON true
        LEFT JOIN (
          SELECT sl.product_id, SUM(sl.quantity_available) as quantity
          FROM stock_levels sl
          JOIN warehouses sw ON sw.id = sl.warehouse_id
          WHERE sw.is_active = true
            AND (sw.code ILIKE 'SB-%' OR sw.name ILIKE 'magazin')
          GROUP BY sl.product_id
        ) stock_total ON p.id = stock_total.product_id
        LEFT JOIN (
          SELECT
            sc.product_id,
            SUM(sc.quantity_available) as supplier_stock,
            MIN(sc.lead_time_days) as supplier_lead_time
          FROM supplier_stock_cache sc
          WHERE sc.is_available = true
          GROUP BY sc.product_id
        ) ssc ON p.id = ssc.product_id
        ${whereClause}
        ORDER BY ${orderClause}
        LIMIT $1 OFFSET $2
      `;

      const products = await readDataSource.query(productsQuery, params);
      const mappedProducts = products.map((p: any) => {
        const stockLocal = parseInt(p.stock_local) || 0;
        const stockSupplier = parseInt(p.stock_supplier) || 0;

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          description: serializeCatalogDescription(p.description),
          price: parseFloat(p.price) || 0,
          currency: p.currency || 'RON',
          image_url: '',
          category: p.category_root || p.category_raw || 'Diverse',
          subcategory: this.normalizeCatalogSubcategory(p.category_raw, p.category_root),
          brand: p.brand || null,
          mounting_type: p.mounting_type || null,
          ip_rating: p.ip_rating || null,
          color_temperature: p.color_temperature ? Number(p.color_temperature) : null,
          supplier_name: p.supplier_name || null,
          stock_local: stockLocal,
          stock_supplier: stockSupplier,
          stock_total: stockLocal + stockSupplier,
          supplier_lead_time: parseInt(p.supplier_lead_time) || 3,
        };
      });
      const mergedProducts = this.mergeCatalogProductsBySearchCode(mappedProducts, search);

      res.status(200).json({
        success: true,
        data: {
          products: mergedProducts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product details for B2B catalog
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async getProductDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const projectionProduct = await this.getProductDetailsFromProjection(id);
      if (projectionProduct) {
        const stockLocal = parseInt(projectionProduct.local_stock) || 0;
        const stockSupplier = parseInt(projectionProduct.supplier_stock) || 0;
        const images = await this.getProductGalleryImages(
          projectionProduct.id,
          projectionProduct.primary_image_url,
        );
        const primaryImageUrl =
          this.getSafeCatalogImageUrl(projectionProduct.primary_image_url) || images[0]?.url || '';

        res.status(200).json({
          success: true,
          data: {
            id: projectionProduct.id,
            sku: projectionProduct.sku,
            name: projectionProduct.name,
            description: projectionProduct.description || '',
            price: parseFloat(projectionProduct.price) || 0,
            currency: projectionProduct.currency || 'RON',
            image_url: primaryImageUrl,
            images,
            category:
              projectionProduct.category_root || projectionProduct.category_raw || 'Diverse',
            subcategory: this.normalizeCatalogSubcategory(
              projectionProduct.category_raw,
              projectionProduct.category_root,
            ),
            supplier_name: projectionProduct.supplier_name || null,
            specifications: {
              brand: projectionProduct.brand || projectionProduct.supplier_name || null,
              mounting_type: projectionProduct.mounting_type || null,
              ip_rating: projectionProduct.ip_rating || null,
              color_temperature: projectionProduct.color_temperature || null,
              wattage: projectionProduct.wattage || null,
              lumens: projectionProduct.lumens || null,
              cri: projectionProduct.cri || null,
              beam_angle: projectionProduct.beam_angle || null,
              voltage_input: projectionProduct.voltage_input || null,
              custom_specs:
                projectionProduct.custom_specs &&
                typeof projectionProduct.custom_specs === 'object' &&
                Object.keys(projectionProduct.custom_specs).length > 0
                  ? projectionProduct.custom_specs
                  : null,
            },
            stock_local: stockLocal,
            stock_supplier: stockSupplier,
            stock_total: stockLocal + stockSupplier,
            supplier_lead_time: parseInt(projectionProduct.supplier_lead_time) || 3,
          },
        });
        return;
      }

      const readDataSource = getReadDataSource(this.dataSource);
      const categorySql = this.getCatalogCategorySqlExpression();

      const query = `
        SELECT
          p.id,
          p.sku,
          p.name,
          p.description,
          p.base_price as price,
          p.currency_code as currency,
          p.image_url,
          c.name as category_raw,
          s.name as supplier_name,
          COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) as brand_effective,
          ps.mounting_type,
          ps.ip_rating,
          ps.color_temperature,
          ps.wattage,
          ps.lumens,
          ps.cri,
          ps.beam_angle,
          ps.voltage_input,
          ps.custom_specs,
          ${categorySql} as category_root,
          COALESCE(stock_total.quantity, 0) as stock_local,
          COALESCE(ssc.supplier_stock, 0) as stock_supplier,
          COALESCE(ssc.supplier_lead_time, 3) as supplier_lead_time
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN (
          SELECT sl.product_id, SUM(sl.quantity_available) as quantity
          FROM stock_levels sl
          JOIN warehouses sw ON sw.id = sl.warehouse_id
          WHERE sw.is_active = true
            AND (sw.code ILIKE 'SB-%' OR sw.name ILIKE 'magazin')
          GROUP BY sl.product_id
        ) stock_total ON p.id = stock_total.product_id
        LEFT JOIN (
          SELECT
            sc.product_id,
            SUM(sc.quantity_available) as supplier_stock,
            MIN(sc.lead_time_days) as supplier_lead_time
          FROM supplier_stock_cache sc
          WHERE sc.is_available = true
          GROUP BY sc.product_id
        ) ssc ON p.id = ssc.product_id
        WHERE p.id = $1 AND p.is_active = true AND p.deleted_at IS NULL
      `;

      const products = await readDataSource.query(query, [id]);

      if (products.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Product not found',
        });
        return;
      }

      const p = products[0];
      const stockLocal = parseInt(p.stock_local) || 0;
      const stockSupplier = parseInt(p.stock_supplier) || 0;
      const images = await this.getProductGalleryImages(p.id, p.image_url);
      const primaryImageUrl = this.getSafeCatalogImageUrl(p.image_url) || images[0]?.url || '';

      res.status(200).json({
        success: true,
        data: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          description: p.description || '',
          price: parseFloat(p.price) || 0,
          currency: p.currency || 'RON',
          image_url: primaryImageUrl,
          images,
          category: p.category_root || p.category_raw || 'Diverse',
          subcategory: this.normalizeCatalogSubcategory(p.category_raw, p.category_root),
          supplier_name: p.supplier_name || null,
          specifications: {
            brand: p.brand_effective || null,
            mounting_type: p.mounting_type || null,
            ip_rating: p.ip_rating || null,
            color_temperature: p.color_temperature || null,
            wattage: p.wattage || null,
            lumens: p.lumens || null,
            cri: p.cri || null,
            beam_angle: p.beam_angle || null,
            voltage_input: p.voltage_input || null,
            custom_specs:
              p.custom_specs &&
              typeof p.custom_specs === 'object' &&
              Object.keys(p.custom_specs).length > 0
                ? p.custom_specs
                : null,
          },
          stock_local: stockLocal,
          stock_supplier: stockSupplier,
          stock_total: stockLocal + stockSupplier,
          supplier_lead_time: parseInt(p.supplier_lead_time) || 3,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available product filters (brands, ip ratings, color temperatures, etc.)
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async getProductFilters(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const query = this.getRequestQuery(req);
      const rawCategory = Array.isArray(query.category) ? query.category[0] : query.category;
      const category = String(rawCategory || '').trim();

      const rawCategoryId = Array.isArray(query.category_id)
        ? query.category_id[0]
        : query.category_id;
      const parsedCategoryId =
        rawCategoryId !== undefined && rawCategoryId !== null ? Number(rawCategoryId) : null;
      const hasCategoryIdFilter = Number.isFinite(parsedCategoryId);

      const normalizeRows = (rows: any[], valueKey: string, labelKey = valueKey, minCount = 1) =>
        rows
          .map((row) => ({
            value: String(row[valueKey] || '').trim(),
            label: String(row[labelKey] || row[valueKey] || '').trim(),
            count: Number(row.count || 0),
          }))
          .filter((row) => row.value.length > 0 && row.label.length > 0 && row.count >= minCount);

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

      const buildResponse = (
        stripTypeRows: any[],
        ledVoltageRows: any[],
        lightColorRows: any[],
        kelvinRows: any[],
        ipRatings: any[],
        brands: any[],
        mountingTypes: any[],
        protocolRows: any[],
        resolutionRows: any[],
        priceRange: any[],
      ) => {
        const normalizedStripType = normalizeRows(stripTypeRows, 'value', 'label');
        const normalizedLedVoltage = normalizeRows(ledVoltageRows, 'value', 'label');
        const normalizedLightColor = normalizeRows(lightColorRows, 'value', 'label');
        const normalizedKelvin = normalizeRows(kelvinRows, 'value', 'label');
        const normalizedIp = normalizeRows(ipRatings, 'value', 'label');
        const normalizedBrands = normalizeRows(brands, 'value', 'label');
        const normalizedMounting = normalizeRows(mountingTypes, 'value', 'label', 2);
        const normalizedProtocol = normalizeRows(protocolRows, 'value', 'label');
        const normalizedResolution = normalizeRows(resolutionRows, 'value', 'label');

        const facetMap: Record<string, { label: string; options: Array<any> }> = {
          stripType: { label: 'Tip LED', options: normalizedStripType },
          ledVoltage: { label: 'Voltaj', options: normalizedLedVoltage },
          lightColor: { label: 'Temperatura / Culoare', options: normalizedLightColor },
          kelvin: { label: 'Temperatura culoare', options: normalizedKelvin },
          ip: { label: 'Protectie IP', options: normalizedIp },
          brand: { label: 'Brand', options: normalizedBrands },
          mountingType: { label: 'Montaj', options: normalizedMounting },
          protocol: { label: 'Protocol', options: normalizedProtocol },
          resolution: { label: 'Rezolutie', options: normalizedResolution },
        };

        const preferredKeys = preferredFacetsByCategory[category] || [
          'kelvin',
          'ip',
          'brand',
          'mountingType',
        ];
        const facets = preferredKeys
          .map((key) => ({
            key,
            label: facetMap[key]?.label,
            options: facetMap[key]?.options || [],
          }))
          .filter((facet) => facet.label && facet.options.length > 0);

        return {
          category: category || null,
          facets,
          strip_types: normalizedStripType,
          led_voltages: normalizedLedVoltage,
          light_colors: normalizedLightColor,
          brands: normalizedBrands,
          ip_ratings: normalizedIp,
          color_temperatures: normalizedKelvin,
          mounting_types: normalizedMounting,
          protocols: normalizedProtocol,
          resolutions: normalizedResolution,
          price_range: {
            min: parseFloat(priceRange[0]?.min_price || '0'),
            max: parseFloat(priceRange[0]?.max_price || '0'),
          },
          wattage_range: { min: 3, max: 200 },
        };
      };

      const projectionService = new InventoryProductProjectionService(this.dataSource);
      const projectionExists = await projectionService.projectionTableExists();

      if (projectionExists) {
        const readDataSource = getReadDataSource(this.dataSource);
        const where: string[] = ['ip.is_active = true'];
        const params: any[] = [];
        const addParam = (value: any): string => {
          params.push(value);
          return `$${params.length}`;
        };

        if (hasCategoryIdFilter && parsedCategoryId !== null) {
          where.push(`ip.category_id = ${addParam(parsedCategoryId)}`);
        }

        if (category) {
          const categoryParam = addParam(`%${category}%`);
          where.push(
            `(ip.category_root ILIKE ${categoryParam} OR COALESCE(ip.category_name, '') ILIKE ${categoryParam})`,
          );
        }

        const whereSql = `WHERE ${where.join(' AND ')}`;
        const baseFrom = `FROM inventory_product_projection ip ${whereSql}`;
        const searchBlobSql = "COALESCE(ip.search_blob, '')";

        const [
          stripTypeRows,
          ledVoltageRows,
          lightColorRows,
          kelvinRows,
          ipRatings,
          brands,
          mountingTypes,
          priceRange,
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
              SELECT
                MIN(ip.base_price) AS min_price,
                MAX(ip.base_price) AS max_price
              ${baseFrom}
            `,
            params,
          ),
        ]);

        res.status(200).json({
          success: true,
          data: buildResponse(
            stripTypeRows,
            ledVoltageRows,
            lightColorRows,
            kelvinRows,
            ipRatings,
            brands,
            mountingTypes,
            [],
            [],
            priceRange,
          ),
        });
        return;
      }

      const categorySql = this.getCatalogCategorySqlExpression();
      const where: string[] = ['p.is_active = true', 'p.deleted_at IS NULL'];
      const params: any[] = [];
      const addParam = (value: any): string => {
        params.push(value);
        return `$${params.length}`;
      };

      if (hasCategoryIdFilter && parsedCategoryId !== null) {
        const categoryIdParam = addParam(parsedCategoryId);
        where.push(`(p.category_id = ${categoryIdParam} OR c.parent_id = ${categoryIdParam})`);
      }

      if (category) {
        const categoryParam = addParam(`%${category}%`);
        where.push(
          `(${categorySql} ILIKE ${categoryParam} OR COALESCE(c.name, '') ILIKE ${categoryParam})`,
        );
      }

      const whereSql = `WHERE ${where.join(' AND ')}`;

      const [brands, ipRatings, colorTemps, mountingTypes, priceRange] = await Promise.all([
        this.dataSource.query(
          `
            SELECT COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) AS value,
                   COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) AS label,
                   COUNT(*)::int AS count
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN suppliers s ON s.id = p.supplier_id
            LEFT JOIN product_specifications ps ON ps.product_id = p.id
            ${whereSql}
              AND COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, '')) IS NOT NULL
            GROUP BY COALESCE(NULLIF(ps.brand, ''), NULLIF(s.name, ''))
            ORDER BY count DESC, label ASC
            LIMIT 25
          `,
          params,
        ),
        this.dataSource.query(
          `
            SELECT UPPER(ps.ip_rating) AS value,
                   UPPER(ps.ip_rating) AS label,
                   COUNT(*)::int AS count
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN product_specifications ps ON ps.product_id = p.id
            ${whereSql}
              AND COALESCE(ps.ip_rating, '') <> ''
            GROUP BY UPPER(ps.ip_rating)
            ORDER BY count DESC, label ASC
            LIMIT 25
          `,
          params,
        ),
        this.dataSource.query(
          `
            SELECT *
            FROM (
              SELECT '3000' AS value, '3000K' AS label, COUNT(*)::int AS count
              FROM products p
              LEFT JOIN categories c ON c.id = p.category_id
              LEFT JOIN product_specifications ps ON ps.product_id = p.id
              ${whereSql}
                AND (
                  COALESCE(ps.color_temperature::text, '') = '3000'
                  OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* '(^|[^0-9])3000\\s*k([^0-9]|$)'
                )
              UNION ALL
              SELECT '4000' AS value, '4000K' AS label, COUNT(*)::int AS count
              FROM products p
              LEFT JOIN categories c ON c.id = p.category_id
              LEFT JOIN product_specifications ps ON ps.product_id = p.id
              ${whereSql}
                AND (
                  COALESCE(ps.color_temperature::text, '') = '4000'
                  OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* '(^|[^0-9])4000\\s*k([^0-9]|$)'
                )
              UNION ALL
              SELECT '6500' AS value, '6500K' AS label, COUNT(*)::int AS count
              FROM products p
              LEFT JOIN categories c ON c.id = p.category_id
              LEFT JOIN product_specifications ps ON ps.product_id = p.id
              ${whereSql}
                AND (
                  COALESCE(ps.color_temperature::text, '') = '6500'
                  OR LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~* '(^|[^0-9])6500\\s*k([^0-9]|$)'
                )
            ) x
            WHERE x.count > 0
            ORDER BY x.count DESC
          `,
          params,
        ),
        this.dataSource.query(
          `
            SELECT ps.mounting_type AS value,
                   ps.mounting_type AS label,
                   COUNT(*)::int AS count
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN product_specifications ps ON ps.product_id = p.id
            ${whereSql}
              AND COALESCE(ps.mounting_type, '') <> ''
            GROUP BY ps.mounting_type
            ORDER BY count DESC, label ASC
            LIMIT 25
          `,
          params,
        ),
        this.dataSource.query(
          `
            SELECT MIN(p.base_price) as min_price, MAX(p.base_price) as max_price
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            ${whereSql}
          `,
          params,
        ),
      ]);

      res.status(200).json({
        success: true,
        data: buildResponse(
          [],
          [],
          [],
          colorTemps,
          ipRatings,
          brands,
          mountingTypes,
          [],
          [],
          priceRange,
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product categories tree
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async getProductCategories(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const categorySql = this.getCatalogCategorySqlExpression();
      const rows = await this.dataSource.query(`
        SELECT
          ${categorySql} AS root_category,
          COALESCE(NULLIF(TRIM(c.name), ''), 'Diverse') AS raw_category,
          COUNT(*)::int AS product_count
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = true
          AND p.deleted_at IS NULL
        GROUP BY root_category, raw_category
        ORDER BY root_category ASC, product_count DESC, raw_category ASC
      `);

      const rootOrder = [
        'Benzi LED',
        'Surse si Drivere',
        'Profile LED',
        'Iluminat Interior',
        'Iluminat Exterior',
        'Iluminat Industrial',
        'Becuri si Tuburi LED',
        'Accesorii Iluminat',
        'Materiale Electrice',
        'Automatizari si Smart',
        'Securitate CCTV',
        'Fotovoltaice',
        'Diverse',
      ];

      const slugify = (value: string): string =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

      const roots = new Map<string, any>();
      let nextId = 1000;

      for (const rootName of rootOrder) {
        roots.set(rootName, {
          id: nextId++,
          name: rootName,
          slug: slugify(rootName),
          description: `Categorie ${rootName}`,
          parent_id: null,
          sort_order: 0,
          is_active: true,
          product_count: 0,
          parent_name: null,
          children: [],
        });
      }

      const childByRoot = new Map<string, Map<string, any>>();

      for (const row of rows) {
        const rootName = String(row.root_category || 'Diverse').trim() || 'Diverse';
        const rawName = String(row.raw_category || '').trim();
        const count = parseInt(String(row.product_count || '0'), 10) || 0;

        if (!roots.has(rootName)) {
          roots.set(rootName, {
            id: nextId++,
            name: rootName,
            slug: slugify(rootName),
            description: `Categorie ${rootName}`,
            parent_id: null,
            sort_order: 0,
            is_active: true,
            product_count: 0,
            parent_name: null,
            children: [],
          });
        }

        const root = roots.get(rootName);
        root.product_count += count;

        const normalizedChild = this.normalizeCatalogSubcategory(rawName, rootName);

        if (!normalizedChild) {
          continue;
        }

        if (!childByRoot.has(rootName)) {
          childByRoot.set(rootName, new Map<string, any>());
        }

        const rootChildren = childByRoot.get(rootName)!;
        if (!rootChildren.has(normalizedChild)) {
          rootChildren.set(normalizedChild, {
            id: nextId++,
            name: normalizedChild,
            slug: slugify(normalizedChild),
            description: `Subcategorie ${normalizedChild}`,
            parent_id: root.id,
            sort_order: 0,
            is_active: true,
            product_count: 0,
            parent_name: rootName,
          });
        }

        rootChildren.get(normalizedChild).product_count += count;
      }

      const visibleTree = Array.from(roots.values())
        .map((root: any) => {
          const childrenMap = childByRoot.get(root.name);
          const children = childrenMap
            ? Array.from(childrenMap.values()).sort(
                (a: any, b: any) => b.product_count - a.product_count,
              )
            : [];

          return {
            ...root,
            children,
          };
        })
        .filter((root: any) => root.product_count > 0)
        .sort((a: any, b: any) => {
          const ai = rootOrder.indexOf(a.name);
          const bi = rootOrder.indexOf(b.name);
          if (ai === -1 && bi === -1) return b.product_count - a.product_count;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

      res.status(200).json({
        success: true,
        data: { categories: visibleTree },
      });
    } catch (error) {
      next(error);
    }
  }
}
