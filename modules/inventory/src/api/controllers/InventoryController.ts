import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';

import { getReadDataSource } from '@shared/database/read-replica-manager';
import { InventoryProductProjectionService } from '@shared/read-model/InventoryProductProjectionService';
import { errorResponse, successResponse } from '@shared/utils/response';
import { createModuleLogger } from '@shared/utils/logger';

import { ProductImageSearchService } from '../../application/services/ProductImageSearchService';
import { CheckStock } from '../../application/use-cases/CheckStock';
import { ReserveStock } from '../../application/use-cases/ReserveStock';
import { ReleaseStock } from '../../application/use-cases/ReleaseStock';
import { AdjustStock } from '../../application/use-cases/AdjustStock';
import { GetLowStockAlerts } from '../../application/use-cases/GetLowStockAlerts';
import { GetMovementHistory } from '../../application/use-cases/GetMovementHistory';
import { GetWarehouses } from '../../application/use-cases/GetWarehouses';
import { InventoryListCache } from '../../infrastructure/cache/InventoryListCache';

interface InventoryCursor {
  name: string;
  id: number;
}

export class InventoryController {
  private logger = createModuleLogger('InventoryController');
  private imageSearchService = new ProductImageSearchService();

  private readonly allowedImageExtensions = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
  ]);

  private readonly allowedRemoteImageMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

  private isValidProductImageUrl(imageUrl: unknown): boolean {
    if (typeof imageUrl !== 'string') {
      return false;
    }

    const trimmed = imageUrl.trim();
    if (!trimmed || trimmed.length > 2000) {
      return false;
    }

    if (trimmed.startsWith('/uploads/products/')) {
      const lowerPath = trimmed.toLowerCase();
      const finalExt = lowerPath.slice(lowerPath.lastIndexOf('.'));
      return this.allowedImageExtensions.has(finalExt);
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      const lowerPathname = parsed.pathname.toLowerCase();
      return Array.from(this.allowedImageExtensions).some((ext) => lowerPathname.endsWith(ext));
    } catch (_error) {
      return false;
    }
  }

  private async hasValidImageMimeType(imageUrl: string): Promise<boolean> {
    if (imageUrl.startsWith('/uploads/products/')) {
      return true;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const checkResponse = async (response: globalThis.Response): Promise<boolean> => {
        const contentType = (response.headers.get('content-type') || '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        return response.ok && this.allowedRemoteImageMimeTypes.has(contentType);
      };

      const headResponse = await fetch(imageUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });

      if (await checkResponse(headResponse)) {
        return true;
      }

      const getResponse = await fetch(imageUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal,
      });

      return checkResponse(getResponse);
    } catch (_error) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
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

  private parseMultiValue(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => String(entry || '').split(','))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    return [];
  }

  private normalizeLedColorFilterValue(value: string): string {
    const normalized = value.toLowerCase().trim().replace(//g, '');
    const withoutK = normalized.endsWith('k') ? normalized.slice(0, -1) : normalized;

    if (/^\d{3}$/.test(withoutK)) {
      return `${withoutK}0`;
    }

    return withoutK;
  }

  private normalizeCatalogCategory(
    rawCategory: string | null,
    productName: string,
    sku: string,
  ): string {
    const text = `${rawCategory || ''} ${productName || ''} ${sku || ''}`.toLowerCase();

    if (
      text.includes('cctv') ||
      text.includes('camera') ||
      text.includes('kamery') ||
      text.includes('nvr') ||
      text.includes('xvr')
    ) {
      return 'Securitate CCTV';
    }

    if (
      text.includes('pv') ||
      text.includes('fotovolta') ||
      text.includes('solar') ||
      text.includes('inverter') ||
      text.includes('falown')
    ) {
      return 'Fotovoltaice';
    }

    if (text.includes('profil') || text.includes('profile') || text.includes('alulicht')) {
      return 'Profile LED';
    }

    if (
      text.includes('benzi') ||
      text.includes('banda') ||
      text.includes('strip') ||
      text.includes('neon') ||
      text.includes('cob')
    ) {
      return 'Benzi LED';
    }

    if (
      text.includes('sursa') ||
      text.includes('alimentator') ||
      text.includes('driver') ||
      text.includes('power supply') ||
      text.includes('adin') ||
      text.includes('adws') ||
      text.includes('gpv') ||
      text.includes('din') ||
      text.includes('cliq')
    ) {
      return 'Surse si Drivere';
    }

    if (
      text.includes('bec') ||
      text.includes('bulb') ||
      text.includes('tub') ||
      text.includes('t8') ||
      text.includes('t5') ||
      text.includes('e27') ||
      text.includes('e14') ||
      text.includes('gu10')
    ) {
      return 'Becuri si Tuburi LED';
    }

    if (
      text.includes('spot') ||
      text.includes('downlight') ||
      text.includes('panel') ||
      text.includes('panou') ||
      text.includes('lustra') ||
      text.includes('pendul') ||
      text.includes('aplica') ||
      text.includes('plafon') ||
      text.includes('track') ||
      text.includes('azzardo')
    ) {
      return 'Iluminat Interior';
    }

    if (
      text.includes('proiector') ||
      text.includes('flood') ||
      text.includes('exterior') ||
      text.includes('outdoor') ||
      text.includes('stradal') ||
      text.includes('ip65') ||
      text.includes('ip66') ||
      text.includes('ip67')
    ) {
      return 'Iluminat Exterior';
    }

    if (text.includes('industrial') || text.includes('highbay') || text.includes('depozit')) {
      return 'Iluminat Industrial';
    }

    if (
      text.includes('cablu') ||
      text.includes('kable') ||
      text.includes('priza') ||
      text.includes('intrerup') ||
      text.includes('electr')
    ) {
      return 'Materiale Electrice';
    }

    if (
      text.includes('automat') ||
      text.includes('smart') ||
      text.includes('zigbee') ||
      text.includes('sensor') ||
      text.includes('senzor')
    ) {
      return 'Automatizari si Smart';
    }

    if (text.includes('akcesoria') || text.includes('accesor')) {
      return 'Accesorii Iluminat';
    }

    return 'Diverse';
  }

  private normalizeCatalogSubcategory(rawCategory: string | null, rootCategory: string): string {
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

  private encodeInventoryCursor(cursor: InventoryCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeInventoryCursor(rawCursor: string): InventoryCursor | null {
    try {
      const decoded = Buffer.from(rawCursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as Partial<InventoryCursor>;

      if (typeof parsed.name !== 'string') {
        return null;
      }

      const id = Number(parsed.id);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      return {
        name: parsed.name,
        id,
      };
    } catch (_error) {
      return null;
    }
  }

  private normalizeCursorName(value: unknown): string {
    return String(value ?? '').trim();
  }

  private async getStockLevelsFromProjection(options: {
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
  }): Promise<any | null> {
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
      const cursorName = this.normalizeCursorName(options.cursorData.name);
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
          ip.source_updated_at
        FROM inventory_product_projection ip
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
        this.normalizeCatalogCategory(row.category_name, row.product_name, row.sku);
      const subcategoryName = this.normalizeCatalogSubcategory(row.category_name, categoryName);

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
      };
    });

    const totalPages = Math.ceil(total / options.limit);
    const firstItem = mappedItems[0];
    const lastItem = mappedItems[mappedItems.length - 1];

    let hasNextPage = options.page < totalPages;
    let hasPrevPage = options.page > 1;
    let nextCursor: string | null =
      hasNextPage && lastItem
        ? this.encodeInventoryCursor({
            id: Number(lastItem.id),
            name: String(lastItem.name || ''),
          })
        : null;
    let prevCursor: string | null =
      hasPrevPage && firstItem
        ? this.encodeInventoryCursor({
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
            ? this.encodeInventoryCursor({
                id: Number(firstItem.id),
                name: String(firstItem.name || ''),
              })
            : null;
        nextCursor =
          hasNextPage && lastItem
            ? this.encodeInventoryCursor({
                id: Number(lastItem.id),
                name: String(lastItem.name || ''),
              })
            : null;
      } else {
        hasNextPage = hasOverflowRow;
        hasPrevPage = Boolean(options.cursorToken);
        nextCursor =
          hasNextPage && lastItem
            ? this.encodeInventoryCursor({
                id: Number(lastItem.id),
                name: String(lastItem.name || ''),
              })
            : null;
        prevCursor =
          hasPrevPage && firstItem
            ? this.encodeInventoryCursor({
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

  private async getProductFacetsFromProjection(
    dataSource: DataSource,
    category: string,
  ): Promise<any | null> {
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

  constructor(
    private checkStockUseCase: CheckStock,
    private reserveStockUseCase: ReserveStock,
    private releaseStockUseCase: ReleaseStock,
    private adjustStockUseCase: AdjustStock,
    private getLowStockAlertsUseCase: GetLowStockAlerts,
    private getMovementHistoryUseCase: GetMovementHistory,
    private getWarehousesUseCase: GetWarehouses,
    private dataSource?: DataSource,
    private inventoryListCache?: InventoryListCache,
  ) {}

  async getStockLevels(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
      const search = (req.query.search as string) || '';
      const cursorToken = String(req.query.cursor || '').trim();
      const cursorDirection: 'next' | 'prev' = req.query.direction === 'prev' ? 'prev' : 'next';
      const cursorData = cursorToken ? this.decodeInventoryCursor(cursorToken) : null;
      const isCursorMode = Boolean(cursorToken && cursorData);
      const fetchDirection: 'ASC' | 'DESC' =
        isCursorMode && cursorDirection === 'prev' ? 'DESC' : 'ASC';
      const orderDirection: 'ASC' | 'DESC' = 'ASC';
      const effectiveLimit = isCursorMode ? limit + 1 : limit;
      const category = String(req.query.category || '').trim();
      const stripTypes = Array.from(
        new Set(
          this.parseMultiValue(req.query.stripType ?? req.query.strip_type)
            .map((value) => value.toLowerCase())
            .filter((value) => value.length > 0),
        ),
      );
      const ledVoltages = Array.from(
        new Set(
          this.parseMultiValue(req.query.ledVoltage ?? req.query.led_voltage ?? req.query.voltage)
            .map((value) => parseInt(value, 10))
            .filter((value) => Number.isFinite(value)),
        ),
      );
      const lightColors = Array.from(
        new Set(
          this.parseMultiValue(
            req.query.lightColor ?? req.query.light_color ?? req.query.colorTemperature,
          )
            .map((value) => this.normalizeLedColorFilterValue(value))
            .filter((value) => value.length > 0),
        ),
      );
      const kelvinFilters = Array.from(
        new Set(
          this.parseMultiValue(req.query.kelvin)
            .map((value) => this.normalizeLedColorFilterValue(value))
            .filter((value) => /^\d{4}$/.test(value)),
        ),
      );
      const ipFilters = Array.from(
        new Set(
          this.parseMultiValue(req.query.ip)
            .map((value) => value.toUpperCase())
            .filter((value) => value.length > 0),
        ),
      );
      const brandFilters = Array.from(
        new Set(
          this.parseMultiValue(req.query.brand)
            .map((value) => value.toLowerCase())
            .filter((value) => value.length > 0),
        ),
      );
      const mountingTypeFilters = Array.from(
        new Set(
          this.parseMultiValue(req.query.mountingType ?? req.query.mounting_type)
            .map((value) => value.toLowerCase())
            .filter((value) => value.length > 0),
        ),
      );
      const protocolFilters = Array.from(
        new Set(
          this.parseMultiValue(req.query.protocol)
            .map((value) => value.toLowerCase())
            .filter((value) => value.length > 0),
        ),
      );
      const cctvResolutionFilters = Array.from(
        new Set(
          this.parseMultiValue(req.query.resolution)
            .map((value) => value.toLowerCase())
            .filter((value) => value.length > 0),
        ),
      );
      const rawStatus = String(req.query.status || '')
        .trim()
        .toLowerCase();
      const stockStatus: '' | 'normal' | 'warning' | 'critical' =
        rawStatus === 'normal' || rawStatus === 'warning' || rawStatus === 'critical'
          ? rawStatus
          : '';
      const offset = (page - 1) * limit;
      const categorySql = this.getCatalogCategorySqlExpression();
      const catalogTextSql =
        "LOWER(COALESCE(c.name, '') || ' ' || COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.sku, ''))";

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const dataSource = this.dataSource;
      const readDataSource = getReadDataSource(dataSource);

      let whereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
      let countWhereClause = 'WHERE p.deleted_at IS NULL AND p.is_active = true';
      const params: any[] = isCursorMode ? [effectiveLimit] : [effectiveLimit, offset];
      const countParams: any[] = [];

      const appendCondition = (conditionBuilder: (startIndex: number) => string, values: any[]) => {
        const queryStartIndex = params.length + 1;
        const countStartIndex = countParams.length + 1;

        whereClause += ` AND ${conditionBuilder(queryStartIndex)}`;
        countWhereClause += ` AND ${conditionBuilder(countStartIndex)}`;

        params.push(...values);
        countParams.push(...values);
      };

      if (search) {
        appendCondition(
          (startIndex) => `(p.sku ILIKE $${startIndex} OR p.name ILIKE $${startIndex})`,
          [`%${search}%`],
        );
      }

      if (category) {
        appendCondition(
          (startIndex) => `(${categorySql} ILIKE $${startIndex} OR c.name ILIKE $${startIndex})`,
          [`%${category}%`],
        );
      }

      if (stripTypes.length > 0) {
        const stripTypePatterns = stripTypes
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

      if (ledVoltages.length > 0) {
        const voltageValues = ledVoltages.flatMap((voltage) => [
          voltage,
          `(^|[^0-9])${voltage}\\s*v([^0-9]|$)`,
        ]);

        appendCondition(
          (startIndex) =>
            `(${ledVoltages
              .map((_, index) => {
                const voltageParamIndex = startIndex + index * 2;
                const regexParamIndex = voltageParamIndex + 1;

                return `(p.led_voltage = $${voltageParamIndex} OR ${catalogTextSql} ~* $${regexParamIndex})`;
              })
              .join(' OR ')})`,
          voltageValues,
        );
      }

      if (lightColors.length > 0) {
        const colorDescriptors = lightColors.map((value) => ({
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

      if (kelvinFilters.length > 0) {
        const kelvinValues = kelvinFilters.flatMap((value) => [
          `%${value}%`,
          value,
          `(^|[^0-9])${value}\\s*k([^0-9]|$)`,
        ]);

        appendCondition(
          (startIndex) =>
            `(${kelvinFilters
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

      if (ipFilters.length > 0) {
        const ipValues = ipFilters.flatMap((value) => [value, `%${value.toLowerCase()}%`]);

        appendCondition(
          (startIndex) =>
            `(${ipFilters
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

      if (brandFilters.length > 0) {
        appendCondition(
          (startIndex) =>
            `(${brandFilters
              .map(
                (_, index) =>
                  `(LOWER(COALESCE(ps.brand, '')) = $${startIndex + index} OR LOWER(COALESCE(s.name, '')) = $${startIndex + index})`,
              )
              .join(' OR ')})`,
          brandFilters,
        );
      }

      if (mountingTypeFilters.length > 0) {
        appendCondition(
          (startIndex) =>
            `(${mountingTypeFilters
              .map((_, index) => `LOWER(COALESCE(ps.mounting_type, '')) = $${startIndex + index}`)
              .join(' OR ')})`,
          mountingTypeFilters,
        );
      }

      if (protocolFilters.length > 0) {
        const protocolPatterns = protocolFilters.map(
          (value) => `(^|[^a-z0-9])${value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`,
        );

        appendCondition(
          (startIndex) =>
            `(${protocolPatterns
              .map((_, index) => `${catalogTextSql} ~* $${startIndex + index}`)
              .join(' OR ')})`,
          protocolPatterns,
        );
      }

      if (cctvResolutionFilters.length > 0) {
        const resolutionPatterns = cctvResolutionFilters
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

      if (stockStatus) {
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
          stockStatus === 'critical'
            ? `${stockTotalSql} <= 0`
            : stockStatus === 'warning'
              ? `(${stockTotalSql} > 0 AND ${stockTotalSql} <= ${reorderPointSql})`
              : `${stockTotalSql} > ${reorderPointSql}`;

        appendCondition(() => statusCondition, []);
      }

      if (isCursorMode && cursorData) {
        const cursorName = this.normalizeCursorName(cursorData.name);
        const comparator = fetchDirection === 'ASC' ? '>' : '<';
        const nameParamIndex = params.length + 1;
        const idParamIndex = params.length + 2;

        whereClause += `
          AND (
            COALESCE(p.name, '') ${comparator} $${nameParamIndex}
            OR (
              COALESCE(p.name, '') = $${nameParamIndex}
              AND p.id ${comparator} $${idParamIndex}
            )
          )`;
        params.push(cursorName, cursorData.id);
      }

      const paginationClause = isCursorMode ? 'LIMIT $1' : 'LIMIT $1 OFFSET $2';

      const listCachePayload = {
        mode: isCursorMode ? 'cursor' : 'page',
        page,
        limit,
        cursor: cursorData || null,
        direction: cursorDirection,
        search,
        category,
        stripTypes,
        ledVoltages,
        lightColors,
        kelvinFilters,
        ipFilters,
        brandFilters,
        mountingTypeFilters,
        protocolFilters,
        cctvResolutionFilters,
        stockStatus,
      };

      if (this.inventoryListCache) {
        const cached = await this.inventoryListCache.getList<any>(listCachePayload);
        if (cached) {
          res.json(successResponse(cached));
          return;
        }
      }

      const projectionPayload = await this.getStockLevelsFromProjection({
        dataSource,
        page,
        limit,
        offset,
        search,
        category,
        stripTypes,
        ledVoltages,
        lightColors,
        kelvinFilters,
        ipFilters,
        brandFilters,
        mountingTypeFilters,
        protocolFilters,
        cctvResolutionFilters,
        stockStatus,
        isCursorMode,
        cursorData,
        cursorToken,
        cursorDirection,
        fetchDirection,
        effectiveLimit,
      });

      if (projectionPayload) {
        if (this.inventoryListCache) {
          await this.inventoryListCache.setList(listCachePayload, projectionPayload);
        }
        res.json(successResponse(projectionPayload));
        return;
      }

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
          ORDER BY COALESCE(p.name, '') ${fetchDirection}, p.id ${fetchDirection}
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

      const hasOverflowRow = isCursorMode && rows.length > limit;
      const pageRows = isCursorMode ? rows.slice(0, limit) : rows;

      if (isCursorMode && fetchDirection === 'DESC') {
        pageRows.reverse();
      }

      const mappedItems = pageRows.map((r: any) => {
        const localAvailable = parseInt(r.quantity_available) || 0;
        const supplierStock = parseInt(r.supplier_stock) || 0;
        const totalStock = localAvailable + supplierStock;
        const reorderPoint = parseInt(r.reorder_point) || 0;
        const categoryName =
          String(r.category_root || '').trim() ||
          this.normalizeCatalogCategory(r.category_name, r.product_name, r.sku);
        const subcategoryName = this.normalizeCatalogSubcategory(r.category_name, categoryName);

        return {
          id: r.product_id,
          productId: r.product_id,
          sku: r.sku || `ID-${r.product_id}`,
          name: r.product_name || 'Unknown',
          categoryId: r.category_id ? Number(r.category_id) : null,
          categoryName,
          subcategoryName: subcategoryName || null,
          price: parseFloat(r.base_price) || 0,
          imageUrl: r.image_url || null,
          warehouseId: r.warehouse_id || 1,
          warehouseName: r.warehouse_name || 'Principal',
          current: parseInt(r.quantity_on_hand) || 0,
          reserved: parseInt(r.quantity_reserved) || 0,
          available: localAvailable,
          localStock: localAvailable,
          supplierStock,
          supplierLeadTime: parseInt(r.supplier_lead_time) || 0,
          totalStock,
          reorderPoint,
          status:
            totalStock <= 0 ? 'Critic' : totalStock <= reorderPoint ? 'Atentionare' : 'Normal',
          updatedAt: r.updated_at,
        };
      });

      const totalPages = Math.ceil(total / limit);
      const firstItem = mappedItems[0];
      const lastItem = mappedItems[mappedItems.length - 1];

      let hasNextPage = page < totalPages;
      let hasPrevPage = page > 1;
      let nextCursor: string | null =
        hasNextPage && lastItem
          ? this.encodeInventoryCursor({
              id: Number(lastItem.id),
              name: String(lastItem.name || ''),
            })
          : null;
      let prevCursor: string | null =
        hasPrevPage && firstItem
          ? this.encodeInventoryCursor({
              id: Number(firstItem.id),
              name: String(firstItem.name || ''),
            })
          : null;

      if (isCursorMode) {
        if (cursorDirection === 'prev') {
          hasPrevPage = hasOverflowRow;
          hasNextPage = Boolean(cursorToken);
          prevCursor =
            hasPrevPage && firstItem
              ? this.encodeInventoryCursor({
                  id: Number(firstItem.id),
                  name: String(firstItem.name || ''),
                })
              : null;
          nextCursor =
            hasNextPage && lastItem
              ? this.encodeInventoryCursor({
                  id: Number(lastItem.id),
                  name: String(lastItem.name || ''),
                })
              : null;
        } else {
          hasNextPage = hasOverflowRow;
          hasPrevPage = Boolean(cursorToken);
          nextCursor =
            hasNextPage && lastItem
              ? this.encodeInventoryCursor({
                  id: Number(lastItem.id),
                  name: String(lastItem.name || ''),
                })
              : null;
          prevCursor =
            hasPrevPage && firstItem
              ? this.encodeInventoryCursor({
                  id: Number(firstItem.id),
                  name: String(firstItem.name || ''),
                })
              : null;
        }
      }

      const responsePayload = {
        items: mappedItems,
        pagination: {
          mode: isCursorMode ? 'cursor' : 'page',
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
          nextCursor,
          prevCursor,
          sortBy: 'name',
          sortDir: orderDirection.toLowerCase(),
        },
      };

      if (this.inventoryListCache) {
        await this.inventoryListCache.setList(listCachePayload, responsePayload);
      }

      res.json(successResponse(responsePayload));
    } catch (error) {
      this.logger.error('Error getting stock levels:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get stock levels', 500));
    }
  }

  async getProductFacets(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const readDataSource = getReadDataSource(this.dataSource);

      const category = String(req.query.category || '').trim();
      const categorySql = this.getCatalogCategorySqlExpression();
      const catalogTextSql =
        "LOWER(COALESCE(c.name, '') || ' ' || COALESCE(p.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.sku, ''))";

      const facetsCachePayload = {
        category,
      };

      if (this.inventoryListCache) {
        const cached = await this.inventoryListCache.getFacets<any>(facetsCachePayload);
        if (cached) {
          res.json(successResponse(cached));
          return;
        }
      }

      const projectionPayload = await this.getProductFacetsFromProjection(
        this.dataSource,
        category,
      );
      if (projectionPayload) {
        if (this.inventoryListCache) {
          await this.inventoryListCache.setFacets(facetsCachePayload, projectionPayload);
        }
        res.json(successResponse(projectionPayload));
        return;
      }

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

      const responsePayload = {
        category: category || null,
        facets,
      };

      if (this.inventoryListCache) {
        await this.inventoryListCache.setFacets(facetsCachePayload, responsePayload);
      }

      res.json(successResponse(responsePayload));
    } catch (error) {
      this.logger.error('Error getting product facets:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get product facets', 500));
    }
  }

  async getStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const result = await this.checkStockUseCase.execute(productId);
      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get stock levels', 500));
    }
  }

  async checkStockBatch(req: Request, res: Response): Promise<void> {
    try {
      const { productIds } = req.body;

      const results = await this.checkStockUseCase.executeBatch(productIds);

      const data = results.reduce(
        (acc, result) => {
          acc[result.productId] = result;
          return acc;
        },
        {} as Record<string, any>,
      );

      res.json(successResponse(data));
    } catch (error) {
      this.logger.error('Error checking batch stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to check batch stock', 500));
    }
  }

  async reserveStock(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, items, expiresAt } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      const result = await this.reserveStockUseCase.execute(
        orderId,
        items,
        // expiresAt and userId are not supported by the current Use Case signature
      );

      res.status(201).json(successResponse(result));
    } catch (error) {
      this.logger.error('Error reserving stock:', error);

      if (error instanceof Error && error.message.includes('Insufficient')) {
        res.status(400).json(errorResponse('INSUFFICIENT_STOCK', error.message, 400));
        return;
      }

      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to reserve stock', 500));
    }
  }

  async releaseReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const reservationId = id; // Or simply use id if it is the reservationId

      await this.releaseStockUseCase.execute(reservationId);

      res.json(successResponse({ message: 'Reservation released successfully' }));
    } catch (error) {
      this.logger.error('Error releasing reservation:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to release reservation', 500));
    }
  }

  async adjustStock(req: Request, res: Response): Promise<void> {
    try {
      const { productId, warehouseId, quantity, reason } = req.body;
      const userId = req.user?.id as string;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      await this.adjustStockUseCase.execute(productId, warehouseId, quantity, reason, userId);

      res.json(successResponse({ message: 'Stock adjusted successfully' }));
    } catch (error) {
      this.logger.error('Error adjusting stock:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to adjust stock', 500));
    }
  }

  async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { acknowledged, severity } = req.query;

      const filters = {
        acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
        severity: severity as string | undefined,
      };

      const result = await this.getLowStockAlertsUseCase.execute(filters.acknowledged);

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting low stock alerts:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get low stock alerts', 500));
    }
  }

  async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id as string;

      if (!userId) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'Unauthorized', 401));
        return;
      }

      await this.getLowStockAlertsUseCase.acknowledgeAlert(id, userId);

      res.json(successResponse({ message: 'Alert acknowledged successfully' }));
    } catch (error) {
      this.logger.error('Error acknowledging alert:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to acknowledge alert', 500));
    }
  }

  async getMovementHistory(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { startDate, endDate, limit, offset } = req.query;

      let resolvedProductId = String(productId || '').trim();

      if (!resolvedProductId) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Product ID or SKU is required', 400));
        return;
      }

      if (this.dataSource && !/^\d+$/.test(resolvedProductId)) {
        const skuMatch = await this.dataSource.query(
          `
            SELECT id
            FROM products
            WHERE LOWER(sku) = LOWER($1)
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [resolvedProductId],
        );

        if (!skuMatch[0]?.id) {
          res
            .status(404)
            .json(errorResponse('NOT_FOUND', 'Product not found for provided ID/SKU', 404));
          return;
        }

        resolvedProductId = String(skuMatch[0].id);
      }

      const result = await this.getMovementHistoryUseCase.execute(
        resolvedProductId,
        // other filters are not supported by the current Use Case signature
      );

      res.json(successResponse(result));
    } catch (error) {
      this.logger.error('Error getting movement history:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get movement history', 500));
    }
  }

  async syncSmartBill(req: Request, res: Response): Promise<void> {
    try {
      // This would trigger the SmartBill sync job
      // For now, just acknowledge the request

      res.json(successResponse({ message: 'SmartBill sync triggered' }));
    } catch (error) {
      this.logger.error('Error triggering SmartBill sync:', error);
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to trigger SmartBill sync', 500));
    }
  }

  async syncSuppliers(req: Request, res: Response): Promise<void> {
    try {
      // This would trigger the supplier sync job
      // For now, just acknowledge the request

      res.json(successResponse({ message: 'Supplier sync triggered' }));
    } catch (error) {
      this.logger.error('Error triggering supplier sync:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to trigger supplier sync', 500));
    }
  }

  async refreshProjection(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const projectionService = new InventoryProductProjectionService(this.dataSource);
      await projectionService.ensureSchema();

      const body = req.body as { productIds?: unknown; mode?: string };
      const productIds = Array.isArray(body?.productIds)
        ? body.productIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];

      const mode = String(body?.mode || 'queue').toLowerCase();

      if (productIds.length > 0) {
        if (mode === 'sync') {
          await projectionService.refreshByProductIds(productIds);
          res.json(
            successResponse({
              message: 'Projection refresh completed',
              mode: 'sync',
              productCount: productIds.length,
            }),
          );
          return;
        }

        await projectionService.scheduleRefreshByProductIds(productIds, 'inventory.manual');
        res.json(
          successResponse({
            message: 'Projection refresh queued',
            mode: 'queue',
            productCount: productIds.length,
          }),
        );
        return;
      }

      await projectionService.refreshAll();
      res.json(successResponse({ message: 'Projection full rebuild completed', mode: 'sync' }));
    } catch (error) {
      this.logger.error('Error refreshing inventory projection:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to refresh projection', 500));
    }
  }

  async getProjectionStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const staleThresholdSeconds = Math.max(
        Number.parseInt(String(req.query.staleThresholdSeconds || '300'), 10) || 300,
        30,
      );

      const projectionService = new InventoryProductProjectionService(this.dataSource);
      const [projection, queue] = await Promise.all([
        projectionService.getProjectionStats(staleThresholdSeconds),
        projectionService.getQueueStats(),
      ]);

      res.json(
        successResponse({
          staleThresholdSeconds,
          projection,
          queue,
        }),
      );
    } catch (error) {
      this.logger.error('Error reading projection status:', error);
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to read projection status', 500));
    }
  }

  async processProjectionQueue(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const batchSize = Math.max(Number.parseInt(String(req.body?.batchSize || '20'), 10) || 20, 1);
      const maxAttempts = Math.max(
        Number.parseInt(String(req.body?.maxAttempts || '6'), 10) || 6,
        1,
      );

      const projectionService = new InventoryProductProjectionService(this.dataSource);
      const result = await projectionService.processRefreshQueue(batchSize, maxAttempts);
      const queue = await projectionService.getQueueStats();

      res.json(
        successResponse({
          message: 'Projection queue processed',
          picked: result.picked,
          processed: result.processed,
          retried: result.retried,
          failed: result.failed,
          recoveredStale: result.recoveredStale,
          durationMs: result.durationMs,
          queue,
          batchSize,
          maxAttempts,
        }),
      );
    } catch (error) {
      this.logger.error('Error processing projection queue:', error);
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to process projection queue', 500));
    }
  }

  async requeueFailedProjectionJobs(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const limit = Math.max(Number.parseInt(String(req.body?.limit || '500'), 10) || 500, 1);
      const projectionService = new InventoryProductProjectionService(this.dataSource);
      const requeued = await projectionService.requeueFailedJobs(limit);

      res.json(
        successResponse({
          message: 'Failed projection jobs requeued',
          requeued,
          limit,
        }),
      );
    } catch (error) {
      this.logger.error('Error requeueing failed projection jobs:', error);
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to requeue projection jobs', 500));
    }
  }

  async getWarehouses(req: Request, res: Response): Promise<void> {
    try {
      if (this.dataSource) {
        const result = await this.dataSource.query(
          `SELECT id::text AS id, name, address, is_active AS "isActive"
           FROM warehouses
           WHERE is_active = true
           ORDER BY name ASC`,
        );

        res.json(successResponse(result));
        return;
      }

      const fallback = await this.getWarehousesUseCase.execute();
      res.json(successResponse(fallback));
    } catch (error) {
      this.logger.error('Error getting warehouses:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get warehouses', 500));
    }
  }

  async createWarehouse(req: Request, res: Response): Promise<void> {
    try {
      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const { name, address } = req.body as { name?: string; address?: string };

      if (!name || !name.trim()) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'Warehouse name is required', 400));
        return;
      }

      const codeBase =
        name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 20) || 'WH';
      const code = `${codeBase}-${Date.now().toString().slice(-4)}`;

      const inserted = await this.dataSource.query(
        `INSERT INTO warehouses (name, code, address, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id::text AS id, name, address, is_active AS "isActive"`,
        [name.trim(), code, (address || '').trim()],
      );

      res.status(201).json(successResponse(inserted[0]));
    } catch (error) {
      this.logger.error('Error creating warehouse:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create warehouse', 500));
    }
  }

  async addProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { imageUrl, altText, isPrimary } = req.body;

      if (!this.isValidProductImageUrl(imageUrl)) {
        res
          .status(400)
          .json(
            errorResponse(
              'VALIDATION_ERROR',
              'URL imagine invalida. Foloseste un link direct catre imagine.',
              400,
            ),
          );
        return;
      }

      if (!(await this.hasValidImageMimeType(String(imageUrl).trim()))) {
        res
          .status(400)
          .json(
            errorResponse(
              'VALIDATION_ERROR',
              'URL imagine invalid: serverul nu confirma un continut de tip imagine.',
              400,
            ),
          );
        return;
      }

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      // If isPrimary is true, set all other images as non-primary
      if (isPrimary) {
        await this.dataSource.query(
          `UPDATE product_images SET is_primary = false WHERE product_id = $1`,
          [productId],
        );
      }

      const result = await this.dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
         RETURNING *`,
        [productId, imageUrl.trim(), altText || '', isPrimary || false],
      );

      await this.inventoryListCache?.invalidateAll();

      res.status(201).json(successResponse(result[0]));
    } catch (error) {
      this.logger.error('Error adding product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add product image', 500));
    }
  }

  async deleteProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId, imageId } = req.params;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      await this.dataSource.query(`DELETE FROM product_images WHERE id = $1 AND product_id = $2`, [
        imageId,
        productId,
      ]);

      await this.inventoryListCache?.invalidateAll();

      res.json(successResponse({ message: 'Image deleted successfully' }));
    } catch (error) {
      this.logger.error('Error deleting product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete product image', 500));
    }
  }

  async bulkImportImages(req: Request, res: Response): Promise<void> {
    try {
      const { images } = req.body; // Array of { sku, imageUrl, altText?, isPrimary? }

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'Images array is required', 400));
        return;
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];
      const mimeValidationCache = new Map<string, boolean>();

      for (const img of images) {
        try {
          const { sku, imageUrl, altText, isPrimary } = img;

          if (!sku || !imageUrl) {
            errors.push(`Missing SKU or imageUrl for entry: ${JSON.stringify(img)}`);
            failed++;
            continue;
          }

          if (!this.isValidProductImageUrl(imageUrl)) {
            errors.push(`SKU ${sku}: URL imagine invalida`);
            failed++;
            continue;
          }

          const normalizedImageUrl = String(imageUrl).trim();
          if (!mimeValidationCache.has(normalizedImageUrl)) {
            mimeValidationCache.set(
              normalizedImageUrl,
              await this.hasValidImageMimeType(normalizedImageUrl),
            );
          }

          if (!mimeValidationCache.get(normalizedImageUrl)) {
            errors.push(`SKU ${sku}: URL imagine invalid (MIME)`);
            failed++;
            continue;
          }

          // Find product by SKU
          const product = await this.dataSource.query(
            `SELECT id FROM products WHERE sku = $1 AND is_active = true LIMIT 1`,
            [sku],
          );

          if (product.length === 0) {
            errors.push(`Product not found for SKU: ${sku}`);
            failed++;
            continue;
          }

          const productId = product[0].id;

          // If isPrimary, set all other images as non-primary
          if (isPrimary) {
            await this.dataSource.query(
              `UPDATE product_images SET is_primary = false WHERE product_id = $1`,
              [productId],
            );
          }

          // Insert image
          await this.dataSource.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
             VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
             ON CONFLICT DO NOTHING`,
            [productId, normalizedImageUrl, altText || '', isPrimary || false],
          );

          imported++;
        } catch (err) {
          errors.push(`SKU ${img.sku}: ${err instanceof Error ? err.message : String(err)}`);
          failed++;
        }
      }

      if (imported > 0) {
        await this.inventoryListCache?.invalidateAll();
      }

      res.json(
        successResponse({
          message: 'Bulk import completed',
          imported,
          failed,
          errors: errors.slice(0, 10), // Return first 10 errors
        }),
      );
    } catch (error) {
      this.logger.error('Error bulk importing images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to bulk import images', 500));
    }
  }

  async autoSearchProductImages(req: Request, res: Response): Promise<void> {
    try {
      const { limit, skipExisting } = req.query;
      const { productIds } = req.body || {};
      const maxProducts = Math.min(parseInt(limit as string) || 50, 200);

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      let products: any[];

      if (Array.isArray(productIds) && productIds.length > 0) {
        // Search images only for specific product IDs
        const ids = productIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        if (ids.length === 0) {
          res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid product IDs', 400));
          return;
        }
        const placeholders = ids.map((_: number, i: number) => `$${i + 1}`).join(',');
        const query =
          skipExisting === 'true'
            ? `SELECT p.id, p.sku, p.name
             FROM products p
             LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
             WHERE p.id IN (${placeholders}) AND pi.id IS NULL
             ORDER BY p.id ASC`
            : `SELECT p.id, p.sku, p.name
             FROM products p
             WHERE p.id IN (${placeholders})
             ORDER BY p.id ASC`;
        products = await this.dataSource.query(query, ids);
      } else {
        // Original behavior: get products without images or all products
        const query =
          skipExisting === 'true'
            ? `SELECT p.id, p.sku, p.name
             FROM products p
             LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
             WHERE p.is_active = true AND pi.id IS NULL
             ORDER BY p.id ASC
             LIMIT $1`
            : `SELECT p.id, p.sku, p.name FROM products p WHERE p.is_active = true ORDER BY p.id ASC LIMIT $1`;
        products = await this.dataSource.query(query, [maxProducts]);
      }

      this.logger.info(`Starting auto-search for ${products.length} products`);

      // Search for images in batches
      const searchResults = await this.imageSearchService.searchProductImagesBatch(
        products.map((p: any) => ({ sku: p.sku, name: p.name })),
        { maxConcurrent: 2, delayMs: 3000 }, // Be respectful to Google
      );

      // Import found images
      let imported = 0;
      let notFound = 0;
      const errors: string[] = [];

      for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i];
        const product = products[i];

        if (result.imageUrl && result.confidence !== 'low') {
          try {
            // Set all other images as non-primary
            await this.dataSource.query(
              `UPDATE product_images SET is_primary = false WHERE product_id = $1`,
              [product.id],
            );

            // Insert image
            await this.dataSource.query(
              `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
               VALUES ($1, $2, $3, true, 0, NOW())
               ON CONFLICT DO NOTHING`,
              [product.id, result.imageUrl, product.name || result.sku],
            );

            imported++;
            this.logger.info(`Imported image for SKU: ${result.sku}`);
          } catch (err) {
            errors.push(`SKU ${result.sku}: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          notFound++;
        }
      }

      if (imported > 0) {
        await this.inventoryListCache?.invalidateAll();
      }

      res.json(
        successResponse({
          message: 'Auto-search completed',
          searched: products.length,
          imported,
          notFound,
          errors: errors.slice(0, 10),
        }),
      );
    } catch (error) {
      this.logger.error('Error auto-searching product images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to auto-search images', 500));
    }
  }

  /**
   * Upload a product image file to disk and save to product_images table.
   * POST /products/:productId/images/upload
   * Expects multipart/form-data with field "image"
   */
  async uploadProductImage(req: Request, res: Response): Promise<void> {
    const file = (req as any).file;
    let dbCommitted = false;
    const cleanupUploadedFile = async (): Promise<void> => {
      if (!file?.path) {
        return;
      }

      try {
        await fs.promises.unlink(file.path);
      } catch (unlinkError) {
        this.logger.warn(`Failed to clean up uploaded image ${file.path}: ${unlinkError instanceof Error ? unlinkError.message : String(unlinkError)}`);
      }
    };

    try {
      const { productId } = req.params;

      if (!file) {
        res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'Nu a fost trimis niciun fisier', 400));
        return;
      }

      if (!this.dataSource) {
        await cleanupUploadedFile();
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const transactionResult = await this.dataSource.transaction(async (manager) => {
        const product = await manager.query('SELECT id, name FROM products WHERE id = $1', [productId]);

        if (product.length === 0) {
          return { found: false as const };
        }

        const imageUrl = `/uploads/products/${file.filename}`;
        const altText = req.body.alt_text || product[0].name || '';
        const isPrimary = req.body.is_primary !== 'false';

        if (isPrimary) {
          await manager.query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [
            productId,
          ]);
        }

        const result = await manager.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
           VALUES ($1, $2, $3, $4, 0, NOW())
           RETURNING id, image_url, alt_text, is_primary`,
          [productId, imageUrl, altText, isPrimary],
        );

        if (isPrimary) {
          await manager.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [
            imageUrl,
            productId,
          ]);
        }

        return { found: true as const, result: result[0], imageUrl, altText, isPrimary };
      });

      if (!transactionResult.found) {
        await cleanupUploadedFile();
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      dbCommitted = true;

      await this.inventoryListCache?.invalidateAll().catch((cacheError) => {
        this.logger.warn(`Failed to invalidate inventory list cache after image upload: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}`);
      });

      this.logger.info(`Image uploaded for product ${productId}: ${transactionResult.imageUrl}`);

      res.status(201).json(
        successResponse({
          id: transactionResult.result.id,
          image_url: transactionResult.imageUrl,
          alt_text: transactionResult.altText,
          is_primary: transactionResult.isPrimary,
          filename: file.filename,
          size: file.size,
        }),
      );
    } catch (error) {
      if (!dbCommitted) {
        await cleanupUploadedFile();
      }
      this.logger.error('Error uploading product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la upload imagine', 500));
    }
  }

  /**
   * Search for product images online based on SKU / product name.
   * POST /products/:productId/images/search
   * Returns an array of candidate image URLs for preview.
   */
  async searchProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const products = await this.dataSource.query(
        'SELECT id, sku, name FROM products WHERE id = $1',
        [productId],
      );

      if (products.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const product = products[0];
      const customQuery = req.body?.query;

      this.logger.info(
        `Searching images for product ${productId} (SKU: ${product.sku})${customQuery ? ` with query: ${customQuery}` : ''}`,
      );

      // Use custom query or default SKU + name
      const candidates = customQuery
        ? await this.imageSearchService.searchCandidates(customQuery, undefined, 6)
        : await this.imageSearchService.searchCandidates(product.sku, product.name, 6);

      res.json(
        successResponse({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          candidates,
        }),
      );
    } catch (error) {
      this.logger.error('Error searching product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la cautarea imaginii', 500));
    }
  }

  /**
   * Select a searched image candidate — download it locally and save as primary.
   * POST /products/:productId/images/select
   * Body: { imageUrl: string }
   */
  async selectSearchedImage(req: Request, res: Response): Promise<void> {
    let localPath: string | null = null;
    let dbCommitted = false;
    const cleanupDownloadedImage = async (): Promise<void> => {
      if (!localPath?.startsWith('/uploads/products/')) {
        return;
      }

      const filePath = path.resolve(process.cwd(), localPath.replace(/^\//, ''));
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkError) {
        this.logger.warn(`Failed to clean up selected image ${filePath}: ${unlinkError instanceof Error ? unlinkError.message : String(unlinkError)}`);
      }
    };

    try {
      const { productId } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'imageUrl este obligatoriu', 400));
        return;
      }

      if (!this.isValidProductImageUrl(imageUrl)) {
        res
          .status(400)
          .json(
            errorResponse(
              'VALIDATION_ERROR',
              'URL imagine invalida. Foloseste un URL direct catre imagine.',
              400,
            ),
          );
        return;
      }

      if (!(await this.hasValidImageMimeType(String(imageUrl).trim()))) {
        res
          .status(400)
          .json(
            errorResponse(
              'VALIDATION_ERROR',
              'URL imagine invalid: serverul nu confirma un continut de tip imagine.',
              400,
            ),
          );
        return;
      }

      if (!this.dataSource) {
        res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
        return;
      }

      const productRows = await this.dataSource.query('SELECT id, sku, name FROM products WHERE id = $1', [
        productId,
      ]);

      if (productRows.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const product = productRows[0];

      // Download the external image to local disk
      localPath = await this.imageSearchService.downloadExternalImage(
        imageUrl,
        product.id,
        product.sku,
      );

      if (!localPath) {
        res
          .status(422)
          .json(errorResponse('DOWNLOAD_FAILED', 'Nu s-a putut descarca imaginea', 422));
        return;
      }

      const transactionResult = await this.dataSource.transaction(async (manager) => {
        await manager.query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [
          productId,
        ]);

        const result = await manager.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
           VALUES ($1, $2, $3, true, 0, NOW())
           RETURNING id, image_url, alt_text, is_primary`,
          [productId, localPath, product.name || product.sku],
        );

        await manager.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [
          localPath,
          productId,
        ]);

        return result[0];
      });

      dbCommitted = true;

      await this.inventoryListCache?.invalidateAll().catch((cacheError) => {
        this.logger.warn(`Failed to invalidate inventory list cache after searched image selection: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}`);
      });

      this.logger.info(`Selected searched image for product ${productId}: ${localPath}`);

      res.status(201).json(
        successResponse({
          id: transactionResult.id,
          image_url: localPath,
          alt_text: product.name || product.sku,
          is_primary: true,
          original_url: imageUrl,
          downloaded: true,
        }),
      );
    } catch (error) {
      if (!dbCommitted) {
        await cleanupDownloadedImage();
      }
      this.logger.error('Error selecting searched image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la salvarea imaginii', 500));
    }
  }
}
