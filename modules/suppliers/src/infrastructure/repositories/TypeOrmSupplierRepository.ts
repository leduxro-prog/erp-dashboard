import { Repository } from 'typeorm';
import {
  ISupplierRepository,
  BulkUpsertResult,
  Supplier,
  SupplierProduct,
  SupplierProductSpecification,
  SkuMapping,
  SupplierOrder,
} from '../../domain';
import { CategoryMarkup, ManufacturerMarkup } from '../../application/ports/ISupplierRepository';

export class TypeOrmSupplierRepository implements ISupplierRepository {
  constructor(
    private supplierRepository: Repository<any>,
    private supplierProductRepository: Repository<any>,
    private skuMappingRepository: Repository<any>,
    private supplierOrderRepository: Repository<any>,
    _dataSource?: unknown,
  ) {}

  // Supplier operations
  async getSupplier(id: number): Promise<Supplier | null> {
    const rows = await this.supplierRepository.query(
      `SELECT
         id,
         name,
         code,
         COALESCE(website, '') AS website,
         COALESCE(email, '') AS "contactEmail",
         COALESCE(phone_number, '') AS "contactPhone",
         COALESCE(phone_number, '') AS "whatsappNumber",
         is_active AS "isActive",
         COALESCE(api_key, '') AS "apiKey",
         COALESCE(api_endpoint, '') AS "apiEndpoint",
         COALESCE(metadata, '{}'::jsonb) AS metadata,
         COALESCE(default_markup_percentage, 30) AS "defaultMarkupPercentage",
         COALESCE(markup_type, 'percentage') AS "markupType",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM suppliers
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    if (!rows.length) {
      return null;
    }

    const row = rows[0];
    const metadata = row.metadata || {};
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      website: row.website,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      whatsappNumber: row.whatsappNumber,
      productCount: 0,
      isActive: row.isActive,
      credentials: {
        username: metadata.username || '',
        password: metadata.password || '',
        apiKey: row.apiKey || undefined,
        customHeader: row.apiEndpoint ? { apiEndpoint: row.apiEndpoint } : undefined,
      },
      syncFrequency: 4,
      defaultMarkupPercentage: row.defaultMarkupPercentage ?? 30,
      markupType: row.markupType ?? 'percentage',
      lastSync: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getSupplierByCode(code: string): Promise<Supplier | null> {
    const rows = await this.supplierRepository.query(
      `SELECT id FROM suppliers WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
      [code],
    );

    if (!rows.length) {
      return null;
    }

    return this.getSupplier(rows[0].id);
  }

  async listSuppliers(activeOnly: boolean = false): Promise<Supplier[]> {
    const rows = await this.supplierRepository.query(
      `SELECT
         id,
         name,
         code,
         COALESCE(website, '') AS website,
         COALESCE(email, '') AS "contactEmail",
         COALESCE(phone_number, '') AS "contactPhone",
         address,
         is_active AS "isActive",
         COALESCE(api_key, '') AS "apiKey",
         COALESCE(api_endpoint, '') AS "apiEndpoint",
         COALESCE(metadata, '{}'::jsonb) AS metadata,
         COALESCE(default_markup_percentage, 30) AS "defaultMarkupPercentage",
         COALESCE(markup_type, 'percentage') AS "markupType",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM suppliers
       WHERE deleted_at IS NULL
         AND ($1::boolean = false OR is_active = true)
       ORDER BY name ASC`,
      [activeOnly],
    );

    return rows.map((row: any) => {
      const metadata = row.metadata || {};
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        website: row.website,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        whatsappNumber: row.contactPhone,
        productCount: 0,
        isActive: row.isActive,
        credentials: {
          username: metadata.username || '',
          password: metadata.password || '',
          apiKey: row.apiKey || undefined,
        },
        syncFrequency: 4,
        defaultMarkupPercentage: row.defaultMarkupPercentage ?? 30,
        markupType: row.markupType ?? 'percentage',
        lastSync: null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        address: row.address,
        apiEndpoint: row.apiEndpoint,
      } as Supplier;
    });
  }

  async updateSupplierIntegration(
    supplierId: number,
    data: {
      apiKey?: string | null;
      apiEndpoint?: string | null;
      username?: string | null;
      password?: string | null;
    },
  ): Promise<Supplier | null> {
    const existing = await this.supplierRepository.query(
      `SELECT metadata FROM suppliers WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [supplierId],
    );

    if (!existing.length) {
      return null;
    }

    const currentMetadata = existing[0].metadata || {};
    const nextMetadata = {
      ...currentMetadata,
      ...(data.username !== undefined ? { username: data.username || '' } : {}),
      ...(data.password !== undefined ? { password: data.password || '' } : {}),
    };

    await this.supplierRepository.query(
      `UPDATE suppliers
       SET api_key = COALESCE($2, api_key),
           api_endpoint = COALESCE($3, api_endpoint),
           metadata = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [supplierId, data.apiKey ?? null, data.apiEndpoint ?? null, JSON.stringify(nextMetadata)],
    );

    return this.getSupplier(supplierId);
  }

  async createSupplier(data: {
    name: string;
    code: string;
    website?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    isActive?: boolean;
    apiEndpoint?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    integrationType?: string;
    b2bUrl?: string;
    b2bUsername?: string;
    b2bPassword?: string;
    defaultMarkupPercentage?: number;
    markupType?: string;
  }): Promise<Supplier> {
    const metadata: Record<string, any> = {};
    if (data.username) metadata.username = data.username;
    if (data.password) metadata.password = data.password;
    if (data.integrationType) metadata.integrationType = data.integrationType;
    if (data.b2bUrl) metadata.b2bUrl = data.b2bUrl;
    if (data.b2bUsername) metadata.b2bUsername = data.b2bUsername;
    if (data.b2bPassword) metadata.b2bPassword = data.b2bPassword;

    const rows = await this.supplierRepository.query(
      `INSERT INTO suppliers (name, code, website, email, phone_number, address, is_active, api_key, api_endpoint, metadata, default_markup_percentage, markup_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, NOW(), NOW())
       RETURNING id`,
      [
        data.name,
        data.code,
        data.website || '',
        data.contactEmail || '',
        data.contactPhone || '',
        data.address || '',
        data.isActive !== false,
        data.apiKey || null,
        data.apiEndpoint || null,
        JSON.stringify(metadata),
        data.defaultMarkupPercentage ?? 30,
        data.markupType || 'percentage',
      ],
    );

    const supplier = await this.getSupplier(rows[0].id);
    return supplier!;
  }

  async findById(id: number): Promise<Supplier | null> {
    return this.getSupplier(id);
  }

  async updateSupplier(id: number, data: Partial<Supplier>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...updateData } = data as any;
    await this.supplierRepository.update(id, updateData);
  }

  // Supplier Product operations
  async findSupplierProduct(id: number): Promise<SupplierProduct | null> {
    const entity = await this.supplierProductRepository.findOne({ where: { id } });
    if (!entity) {
      return null;
    }
    return {
      ...entity,
      priceHistory: entity.priceHistory || [],
    };
  }

  async updateSupplierProduct(id: number, data: Partial<SupplierProduct>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      id: _id,
      createdAt: _ca,
      updatedAt: _ua,
      priceHistory: _ph,
      ...updateData
    } = data as any;
    await this.supplierProductRepository.update(id, updateData);
  }

  async getSupplierProducts(
    supplierId: number,
    limit?: number,
    offset?: number,
  ): Promise<SupplierProduct[]> {
    const rows = await this.supplierProductRepository.query(
      `SELECT
         sp.id,
         sp.supplier_id AS "supplierId",
         sp.product_id AS "productId",
         sp.supplier_sku AS "supplierSku",
         COALESCE(p.name, sp.supplier_sku) AS name,
         sp.supplier_price AS price,
         COALESCE(s.currency_code, 'RON') AS currency,
         COALESCE(ssc.quantity_available, 0) AS "stockQuantity",
         COALESCE(sp.min_order_quantity, 1) AS "minOrderQuantity",
         sp.lead_time_days AS "leadTimeDays",
         sp.is_active AS "isActive",
         sp.markup_percentage AS "markupPercentage",
         sp.selling_price AS "sellingPrice",
          sp.image_url AS "imageUrl",
          sp.manufacturer_id AS "manufacturerId",
          sp.updated_at AS "lastScraped",
         sp.created_at AS "createdAt",
         sp.updated_at AS "updatedAt"
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       LEFT JOIN products p ON p.id = sp.product_id
       LEFT JOIN supplier_stock_cache ssc
         ON ssc.supplier_id = sp.supplier_id
         AND ssc.product_id = sp.product_id
       WHERE sp.supplier_id = $1
       ORDER BY sp.supplier_sku ASC
       LIMIT $2 OFFSET $3`,
      [supplierId, limit ?? 10000, offset ?? 0],
    );

    return rows.map((row: any) => ({
      ...row,
      markupPercentage:
        row.markupPercentage !== null && row.markupPercentage !== undefined
          ? parseFloat(row.markupPercentage)
          : null,
      sellingPrice:
        row.sellingPrice !== null && row.sellingPrice !== undefined
          ? parseFloat(row.sellingPrice)
          : null,
      imageUrl: row.imageUrl ?? null,
      priceHistory: [],
    }));
  }

  async getSupplierProduct(
    supplierId: number,
    supplierSku: string,
  ): Promise<SupplierProduct | null> {
    const product = await this.supplierProductRepository.findOne({
      where: { supplierId, supplierSku },
      relations: ['supplier', 'product'],
    });
    return product || null;
  }

  async upsertSupplierProduct(product: SupplierProduct): Promise<void> {
    await this.supplierProductRepository.save(product);
  }

  async bulkUpsertProducts(products: SupplierProduct[]): Promise<BulkUpsertResult> {
    if (products.length === 0) {
      return { created: 0, updated: 0 };
    }

    const resolvedProducts = await this.resolveMissingProductIds(products);

    const upsertableProducts = resolvedProducts
      .map((p) => ({
        ...p,
        supplierId: Number(p.supplierId),
        productId: Number(p.productId),
      }))
      .filter((p) => Number.isFinite(p.supplierId) && Number.isFinite(p.productId));

    if (upsertableProducts.length === 0) {
      return { created: 0, updated: 0 };
    }

    const existingPairPlaceholders = upsertableProducts
      .map((_p, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
      .join(', ');
    const existingPairParams = upsertableProducts.flatMap((p) => [p.supplierId, p.productId]);

    const existingRows = await this.supplierProductRepository.query(
      `SELECT supplier_id AS "supplierId", product_id AS "productId"
       FROM supplier_products
       WHERE (supplier_id, product_id) IN (${existingPairPlaceholders})`,
      existingPairParams,
    );

    const existingPairSet = new Set(
      existingRows.map((row: any) => `${Number(row.supplierId)}:${Number(row.productId)}`),
    );

    const valuePlaceholders = upsertableProducts
      .map(
        (_p, index) =>
          `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7}, NOW(), NOW())`,
      )
      .join(', ');

    const params = upsertableProducts.flatMap((p) => [
      p.supplierId,
      p.productId,
      p.supplierSku,
      Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
      Number.isFinite(Number(p.minOrderQuantity)) && Number(p.minOrderQuantity) > 0
        ? Number(p.minOrderQuantity)
        : 1,
      Number.isFinite(Number(p.leadTimeDays)) ? Number(p.leadTimeDays) : null,
      p.isActive !== undefined ? Boolean(p.isActive) : true,
    ]);

    await this.supplierProductRepository.query(
      `INSERT INTO supplier_products (
         supplier_id,
         product_id,
         supplier_sku,
         supplier_price,
         min_order_quantity,
         lead_time_days,
         is_active,
         created_at,
         updated_at
       )
       VALUES ${valuePlaceholders}
       ON CONFLICT (supplier_id, product_id) DO UPDATE
       SET supplier_sku = EXCLUDED.supplier_sku,
           supplier_price = EXCLUDED.supplier_price,
           min_order_quantity = EXCLUDED.min_order_quantity,
           lead_time_days = EXCLUDED.lead_time_days,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
      params,
    );

    const updated = upsertableProducts.filter((p) =>
      existingPairSet.has(`${p.supplierId}:${p.productId}`),
    ).length;
    const created = upsertableProducts.length - updated;

    return { created, updated };
  }

  private async resolveMissingProductIds(products: SupplierProduct[]): Promise<SupplierProduct[]> {
    const unresolved = products.filter(
      (p) => !Number.isFinite(p.productId as number) && Boolean(p.supplierSku?.trim()),
    );

    if (unresolved.length === 0) {
      return products;
    }

    const normalizedSkus = Array.from(
      new Set(unresolved.map((p) => p.supplierSku.trim().toUpperCase())),
    );

    const rows = await this.supplierProductRepository.query(
      `SELECT
         id,
         supplier_id AS "supplierId",
         UPPER(COALESCE(supplier_sku, '')) AS "supplierSku",
         UPPER(COALESCE(sku, '')) AS "sku"
       FROM products
       WHERE deleted_at IS NULL
         AND (
           UPPER(COALESCE(supplier_sku, '')) = ANY($1)
           OR UPPER(COALESCE(sku, '')) = ANY($1)
         )`,
      [normalizedSkus],
    );

    const bySupplierAndSupplierSku = new Map<string, number>();
    const bySupplierSku = new Map<string, number>();
    const bySku = new Map<string, number>();

    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) {
        continue;
      }

      const supplierId = Number(row.supplierId);
      const supplierSku = String(row.supplierSku || '').trim();
      const sku = String(row.sku || '').trim();

      if (Number.isFinite(supplierId) && supplierSku.length > 0) {
        const key = `${supplierId}:${supplierSku}`;
        if (!bySupplierAndSupplierSku.has(key)) {
          bySupplierAndSupplierSku.set(key, id);
        }
      }

      if (supplierSku.length > 0 && !bySupplierSku.has(supplierSku)) {
        bySupplierSku.set(supplierSku, id);
      }

      if (sku.length > 0 && !bySku.has(sku)) {
        bySku.set(sku, id);
      }
    }

    for (const product of unresolved) {
      const normalizedSupplierSku = product.supplierSku.trim().toUpperCase();
      const key = `${product.supplierId}:${normalizedSupplierSku}`;

      const resolvedId =
        bySupplierAndSupplierSku.get(key) ||
        bySupplierSku.get(normalizedSupplierSku) ||
        bySku.get(normalizedSupplierSku);

      if (resolvedId) {
        product.productId = resolvedId;
      }
    }

    const stillUnresolved = products.filter(
      (p) => !Number.isFinite(p.productId as number) && Boolean(p.supplierSku?.trim()),
    );

    if (stillUnresolved.length > 0) {
      await this.createProductsForUnresolvedSkus(stillUnresolved);
    }

    return products;
  }

  private async createProductsForUnresolvedSkus(products: SupplierProduct[]): Promise<void> {
    const fallbackCategoryId = await this.getFallbackCategoryId();
    if (!fallbackCategoryId) {
      return;
    }

    const categoryIdBySupplier = new Map<number, number>();

    for (const product of products) {
      const supplierSku = product.supplierSku.trim();
      if (!supplierSku) {
        continue;
      }

      const supplierId = Number(product.supplierId);
      let categoryId = fallbackCategoryId;

      if (Number.isFinite(supplierId)) {
        if (!categoryIdBySupplier.has(supplierId)) {
          const supplierCategoryId = await this.getCategoryIdForSupplier(supplierId);
          categoryIdBySupplier.set(supplierId, supplierCategoryId || fallbackCategoryId);
        }

        categoryId = categoryIdBySupplier.get(supplierId) || fallbackCategoryId;
      }

      const price = Number.isFinite(product.price) && product.price > 0 ? product.price : 0;
      const minOrderQuantity =
        Number.isFinite(product.minOrderQuantity as number) &&
        (product.minOrderQuantity as number) > 0
          ? (product.minOrderQuantity as number)
          : 1;
      const leadTimeDays =
        Number.isFinite(product.leadTimeDays as number) && (product.leadTimeDays as number) >= 0
          ? (product.leadTimeDays as number)
          : null;
      const productName = product.name?.trim() || supplierSku;

      const rows = await this.supplierProductRepository.query(
        `INSERT INTO products (
           category_id,
           sku,
           name,
           base_price,
           currency_code,
           unit_of_measure,
           is_active,
           supplier_id,
           supplier_sku,
           min_order_quantity,
           lead_time_days,
           created_at,
           updated_at
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           'buc',
           true,
           $6,
           $7,
           $8,
           $9,
           NOW(),
           NOW()
         )
         ON CONFLICT (sku) DO UPDATE
         SET supplier_id = COALESCE(products.supplier_id, EXCLUDED.supplier_id),
             supplier_sku = COALESCE(products.supplier_sku, EXCLUDED.supplier_sku),
             name = COALESCE(NULLIF(products.name, ''), EXCLUDED.name),
             base_price = CASE
               WHEN products.base_price IS NULL OR products.base_price <= 0 THEN EXCLUDED.base_price
               ELSE products.base_price
             END,
             currency_code = COALESCE(products.currency_code, EXCLUDED.currency_code),
             min_order_quantity = COALESCE(products.min_order_quantity, EXCLUDED.min_order_quantity),
             lead_time_days = COALESCE(products.lead_time_days, EXCLUDED.lead_time_days),
             updated_at = NOW()
         RETURNING id`,
        [
          categoryId,
          supplierSku,
          productName,
          price,
          (product.currency || 'RON').toUpperCase().slice(0, 3),
          product.supplierId,
          supplierSku,
          minOrderQuantity,
          leadTimeDays,
        ],
      );

      const createdId = Number(rows[0]?.id);
      if (Number.isFinite(createdId)) {
        product.productId = createdId;
      }
    }
  }

  private async getCategoryIdForSupplier(supplierId: number): Promise<number | null> {
    const byName = await this.supplierProductRepository.query(
      `SELECT c.id
       FROM suppliers s
       JOIN categories c ON c.is_active = true
       WHERE s.id = $1
         AND LOWER(TRIM(c.name)) = LOWER(TRIM(s.name))
       ORDER BY c.id ASC
       LIMIT 1`,
      [supplierId],
    );

    const byNameId = Number(byName[0]?.id);
    if (Number.isFinite(byNameId)) {
      return byNameId;
    }

    const bySlug = await this.supplierProductRepository.query(
      `SELECT c.id
       FROM suppliers s
       JOIN categories c ON c.is_active = true
       WHERE s.id = $1
         AND LOWER(TRIM(c.slug)) = LOWER(TRIM(s.code))
       ORDER BY c.id ASC
       LIMIT 1`,
      [supplierId],
    );

    const bySlugId = Number(bySlug[0]?.id);
    if (Number.isFinite(bySlugId)) {
      return bySlugId;
    }

    const byCodeContained = await this.supplierProductRepository.query(
      `SELECT c.id
       FROM suppliers s
       JOIN categories c ON c.is_active = true
       WHERE s.id = $1
         AND (
           LOWER(c.name) LIKE '%' || LOWER(s.code) || '%'
           OR LOWER(c.slug) LIKE '%' || LOWER(s.code) || '%'
         )
       ORDER BY c.id ASC
       LIMIT 1`,
      [supplierId],
    );

    const byCodeContainedId = Number(byCodeContained[0]?.id);
    return Number.isFinite(byCodeContainedId) ? byCodeContainedId : null;
  }

  private async getFallbackCategoryId(): Promise<number | null> {
    const preferred = await this.supplierProductRepository.query(
      `SELECT id
       FROM categories
       WHERE is_active = true
         AND (name = 'General' OR name ILIKE '%general%')
       ORDER BY id ASC
       LIMIT 1`,
    );

    const preferredId = Number(preferred[0]?.id);
    if (Number.isFinite(preferredId)) {
      return preferredId;
    }

    const fallback = await this.supplierProductRepository.query(
      `SELECT id
       FROM categories
       WHERE is_active = true
       ORDER BY id ASC
       LIMIT 1`,
    );

    const fallbackId = Number(fallback[0]?.id);
    return Number.isFinite(fallbackId) ? fallbackId : null;
  }

  // SKU Mapping operations
  async getSkuMapping(supplierId: number, supplierSku: string): Promise<SkuMapping | null> {
    const mapping = await this.skuMappingRepository.findOne({
      where: { supplierId, supplierSku },
    });
    return mapping || null;
  }

  async getSkuMappings(supplierId: number): Promise<SkuMapping[]> {
    return this.skuMappingRepository.find({
      where: { supplierId },
      relations: ['supplier', 'product'],
      order: { supplierSku: 'ASC' },
    });
  }

  async createSkuMapping(mapping: SkuMapping): Promise<SkuMapping> {
    return this.skuMappingRepository.save(mapping);
  }

  async updateSkuMapping(mapping: SkuMapping): Promise<void> {
    await this.skuMappingRepository.save(mapping);
  }

  async deleteSkuMapping(id: number): Promise<void> {
    await this.skuMappingRepository.delete({ id });
  }

  // Supplier Order operations
  async createSupplierOrder(order: SupplierOrder): Promise<SupplierOrder> {
    return this.supplierOrderRepository.save(order);
  }

  async getSupplierOrder(id: number): Promise<SupplierOrder | null> {
    const order = await this.supplierOrderRepository.findOne({
      where: { id },
      relations: ['supplier', 'items', 'items.product'],
    });
    return order || null;
  }

  async getSupplierOrders(
    supplierId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<SupplierOrder[]> {
    return this.supplierOrderRepository.find({
      where: { supplierId },
      relations: ['supplier', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async updateSupplierOrder(order: SupplierOrder): Promise<void> {
    await this.supplierOrderRepository.save(order);
  }

  // Sync tracking
  async updateLastSync(supplierId: number, syncTime: Date): Promise<void> {
    await this.supplierRepository.query(
      `UPDATE suppliers
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('lastSyncAt', $2::text),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [supplierId, syncTime.toISOString()],
    );
  }

  async getLastSync(supplierId: number): Promise<Date | null> {
    const rows = await this.supplierRepository.query(
      `SELECT metadata->>'lastSyncAt' AS "lastSyncAt"
       FROM suppliers
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [supplierId],
    );

    const value = rows[0]?.lastSyncAt;
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Category Markup operations
  async getCategoryMarkups(supplierId: number): Promise<CategoryMarkup[]> {
    const rows = await this.supplierRepository.query(
      `SELECT
         scm.id,
         scm.supplier_id AS "supplierId",
         scm.category_id AS "categoryId",
         c.name AS "categoryName",
         scm.markup_percentage AS "markupPercentage",
         scm.is_active AS "isActive"
       FROM supplier_category_markups scm
       JOIN categories c ON c.id = scm.category_id
       WHERE scm.supplier_id = $1
       ORDER BY c.name ASC`,
      [supplierId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      supplierId: row.supplierId,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      markupPercentage: parseFloat(row.markupPercentage),
      isActive: row.isActive,
    }));
  }

  async upsertCategoryMarkup(
    supplierId: number,
    categoryId: number,
    markupPercentage: number,
  ): Promise<void> {
    await this.supplierRepository.query(
      `INSERT INTO supplier_category_markups (supplier_id, category_id, markup_percentage, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (supplier_id, category_id)
       DO UPDATE SET markup_percentage = $3, updated_at = NOW()`,
      [supplierId, categoryId, markupPercentage],
    );
  }

  async deleteCategoryMarkup(supplierId: number, categoryId: number): Promise<void> {
    await this.supplierRepository.query(
      `DELETE FROM supplier_category_markups WHERE supplier_id = $1 AND category_id = $2`,
      [supplierId, categoryId],
    );
  }

  async saveCategoryMarkups(
    supplierId: number,
    markups: Array<{ categoryId: number; markupPercentage: number }>,
  ): Promise<void> {
    // Delete existing markups for this supplier
    await this.supplierRepository.query(
      `DELETE FROM supplier_category_markups WHERE supplier_id = $1`,
      [supplierId],
    );

    // Insert new markups
    if (markups.length > 0) {
      const values = markups.map((_m, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
      const params: any[] = [supplierId];
      markups.forEach((m) => {
        params.push(m.categoryId, m.markupPercentage);
      });

      await this.supplierRepository.query(
        `INSERT INTO supplier_category_markups (supplier_id, category_id, markup_percentage)
         VALUES ${values}`,
        params,
      );
    }
  }

  async getAllCategories(): Promise<
    Array<{ id: number; parentId: number | null; name: string; slug: string }>
  > {
    const rows = await this.supplierRepository.query(
      `SELECT id, parent_id AS "parentId", name, slug
       FROM categories
       WHERE is_active = true
       ORDER BY parent_id NULLS FIRST, sort_order ASC, name ASC`,
    );
    return rows.map((r: any) => ({
      id: Number(r.id),
      parentId: r.parentId ? Number(r.parentId) : null,
      name: r.name,
      slug: r.slug,
    }));
  }

  // Manufacturer Markup operations
  async getManufacturerMarkups(supplierId: number): Promise<ManufacturerMarkup[]> {
    const rows = await this.supplierRepository.query(
      `SELECT
         smm.id,
         smm.supplier_id AS "supplierId",
         smm.manufacturer_id AS "manufacturerId",
         m.name AS "manufacturerName",
         smm.markup_percentage AS "markupPercentage",
         smm.is_active AS "isActive"
       FROM supplier_manufacturer_markups smm
       JOIN manufacturers m ON m.id = smm.manufacturer_id
       WHERE smm.supplier_id = $1
       ORDER BY m.name ASC`,
      [supplierId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      supplierId: row.supplierId,
      manufacturerId: row.manufacturerId,
      manufacturerName: row.manufacturerName,
      markupPercentage: parseFloat(row.markupPercentage),
      isActive: row.isActive,
    }));
  }

  async saveManufacturerMarkups(
    supplierId: number,
    markups: Array<{ manufacturerId: number; markupPercentage: number }>,
  ): Promise<void> {
    // Delete existing markups for this supplier
    await this.supplierRepository.query(
      `DELETE FROM supplier_manufacturer_markups WHERE supplier_id = $1`,
      [supplierId],
    );

    // Insert new markups
    if (markups.length > 0) {
      const values = markups.map((_m, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
      const params: any[] = [supplierId];
      markups.forEach((m) => {
        params.push(m.manufacturerId, m.markupPercentage);
      });

      await this.supplierRepository.query(
        `INSERT INTO supplier_manufacturer_markups (supplier_id, manufacturer_id, markup_percentage)
         VALUES ${values}`,
        params,
      );
    }
  }

  async getAllManufacturers(): Promise<
    Array<{ id: number; name: string; slug: string; isActive: boolean }>
  > {
    const rows = await this.supplierRepository.query(
      `SELECT id, name, slug, is_active AS "isActive"
       FROM manufacturers
       WHERE is_active = true
       ORDER BY name ASC`,
    );
    return rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      slug: r.slug,
      isActive: r.isActive,
    }));
  }

  async upsertProductSpecifications(
    specs: SupplierProductSpecification[],
    options?: { conflictPolicy?: string; source?: string },
  ): Promise<number> {
    if (specs.length === 0) {
      return 0;
    }

    let updated = 0;

    for (const spec of specs) {
      try {
        await this.supplierRepository.query(
          `INSERT INTO supplier_product_specifications (
             product_id,
             supplier_id,
             supplier_sku,
             brand,
             manufacturer,
             ean_code,
             custom_specs,
             source,
             source_updated_at,
             updated_at,
             created_at
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,NOW(),NOW())
           ON CONFLICT (product_id, supplier_id) DO UPDATE
           SET supplier_sku = EXCLUDED.supplier_sku,
               brand = COALESCE(NULLIF(EXCLUDED.brand, ''), supplier_product_specifications.brand),
               manufacturer = COALESCE(NULLIF(EXCLUDED.manufacturer, ''), supplier_product_specifications.manufacturer),
               ean_code = COALESCE(NULLIF(EXCLUDED.ean_code, ''), supplier_product_specifications.ean_code),
               custom_specs = CASE
                 WHEN $10 = 'merge_non_empty'
                   THEN COALESCE(supplier_product_specifications.custom_specs, '{}'::jsonb) || COALESCE(EXCLUDED.custom_specs, '{}'::jsonb)
                 ELSE COALESCE(EXCLUDED.custom_specs, supplier_product_specifications.custom_specs)
               END,
               source = COALESCE(EXCLUDED.source, supplier_product_specifications.source),
               source_updated_at = COALESCE(EXCLUDED.source_updated_at, supplier_product_specifications.source_updated_at),
               updated_at = NOW()`,
          [
            spec.productId,
            spec.supplierId,
            spec.supplierSku,
            spec.brand || null,
            spec.manufacturer || null,
            spec.eanCode || null,
            JSON.stringify(spec.customSpecs || {}),
            options?.source || null,
            spec.sourceUpdatedAt || new Date(),
            options?.conflictPolicy || 'replace',
          ],
        );
        updated += 1;
      } catch {
        // best-effort in legacy schemas
      }
    }

    return updated;
  }

  async getSyncReports(
    supplierId: number,
    limit: number = 8,
  ): Promise<Array<{ syncStatus?: string; errorMessage?: string | null; createdAt?: Date }>> {
    try {
      const rows = await this.supplierRepository.query(
        `SELECT
           sync_status AS "syncStatus",
           error_message AS "errorMessage",
           created_at AS "createdAt"
         FROM supplier_sync_reports
         WHERE supplier_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [supplierId, limit],
      );

      return rows;
    } catch {
      return [];
    }
  }

  async saveSyncReport(report: {
    supplierId: number;
    supplierName: string;
    syncType: string;
    success: boolean;
    productsFound: number;
    productsUpdated: number;
    priceChanges: number;
    significantPriceChanges: number;
    specificationsDetected?: number;
    specificationsUpdated?: number;
    specificationCoveragePct?: number;
    durationMs: number;
    errorMessage?: string;
    smartbillOverlap: number;
  }): Promise<void> {
    try {
      await this.supplierRepository.query(
        `INSERT INTO supplier_sync_reports (
           supplier_id,
           supplier_name,
           sync_type,
           sync_status,
           products_found,
           products_updated,
           price_changes,
           significant_price_changes,
           specifications_detected,
           specifications_updated,
           specification_coverage_pct,
           smartbill_overlap,
           duration_ms,
           error_message,
           created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
        [
          report.supplierId,
          report.supplierName,
          report.syncType,
          report.success ? 'success' : 'failed',
          report.productsFound,
          report.productsUpdated,
          report.priceChanges,
          report.significantPriceChanges,
          report.specificationsDetected || 0,
          report.specificationsUpdated || 0,
          report.specificationCoveragePct || null,
          report.smartbillOverlap || 0,
          report.durationMs,
          report.errorMessage || null,
        ],
      );
    } catch {
      // best-effort metrics sink
    }
  }
}
