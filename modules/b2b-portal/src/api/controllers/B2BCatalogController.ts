/**
 * B2B Catalog API Controller
 * Direct database queries for high-performance B2B product catalog
 * Supports: product listing, filtering, search, stock visibility, pricing tiers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { VAT_RATE } from '@shared/constants';

export function createB2BCatalogRouter(dataSource: DataSource): Router {
  const router = Router();

  // ==========================================
  // GET /products - List products with filters
  // ==========================================
  router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = '1',
        limit = '24',
        search,
        category_id,
        category_slug,
        brand,
        ip_rating,
        wattage_min,
        wattage_max,
        color_temperature,
        dimmable,
        mounting_type,
        price_min,
        price_max,
        in_stock,
        sort_by = 'name',
        sort_order = 'ASC',
        supplier_id,
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Build dynamic WHERE clause
      const conditions: string[] = ['p.is_active = true', 'p.deleted_at IS NULL'];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        conditions.push(
          `(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR ps.brand ILIKE $${paramIndex})`,
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (category_id) {
        // Include subcategories
        conditions.push(`(p.category_id = $${paramIndex} OR c.parent_id = $${paramIndex})`);
        params.push(parseInt(category_id));
        paramIndex++;
      }

      if (category_slug) {
        conditions.push(`(c.slug = $${paramIndex} OR pc.slug = $${paramIndex})`);
        params.push(category_slug);
        paramIndex++;
      }

      if (brand) {
        const brands = brand.split(',');
        conditions.push(`ps.brand = ANY($${paramIndex})`);
        params.push(brands);
        paramIndex++;
      }

      if (ip_rating) {
        const ratings = ip_rating.split(',');
        conditions.push(`ps.ip_rating = ANY($${paramIndex})`);
        params.push(ratings);
        paramIndex++;
      }

      if (wattage_min) {
        conditions.push(`ps.wattage >= $${paramIndex}`);
        params.push(parseFloat(wattage_min));
        paramIndex++;
      }

      if (wattage_max) {
        conditions.push(`ps.wattage <= $${paramIndex}`);
        params.push(parseFloat(wattage_max));
        paramIndex++;
      }

      if (color_temperature) {
        const temps = color_temperature.split(',').map(Number);
        conditions.push(`ps.color_temperature = ANY($${paramIndex})`);
        params.push(temps);
        paramIndex++;
      }

      if (dimmable === 'true') {
        conditions.push(`ps.dimmable = true`);
      }

      if (mounting_type) {
        const types = mounting_type.split(',');
        conditions.push(`ps.mounting_type = ANY($${paramIndex})`);
        params.push(types);
        paramIndex++;
      }

      if (price_min) {
        conditions.push(`p.base_price >= $${paramIndex}`);
        params.push(parseFloat(price_min));
        paramIndex++;
      }

      if (price_max) {
        conditions.push(`p.base_price <= $${paramIndex}`);
        params.push(parseFloat(price_max));
        paramIndex++;
      }

      if (in_stock === 'true') {
        conditions.push(`COALESCE(sl.quantity_available, 0) > 0`);
      }

      if (supplier_id) {
        conditions.push(`p.supplier_id = $${paramIndex}`);
        params.push(parseInt(supplier_id));
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Sort mapping
      const sortMap: Record<string, string> = {
        name: 'p.name',
        price: 'p.base_price',
        price_asc: 'p.base_price',
        price_desc: 'p.base_price',
        newest: 'p.created_at',
        stock: 'COALESCE(sl.quantity_available, 0)',
        brand: 'ps.brand',
        wattage: 'ps.wattage',
      };
      const sortCol = sortMap[sort_by] || 'p.name';
      const sortDir =
        sort_by === 'price_desc' || sort_by === 'newest'
          ? 'DESC'
          : sort_order?.toUpperCase() === 'DESC'
            ? 'DESC'
            : 'ASC';

      // Count query
      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = 1
        ${whereClause}
      `;

      const countResult = await dataSource.query(countQuery, params);
      const total = parseInt(countResult[0]?.total || '0');

      // Main query with all joins
      const query = `
        SELECT 
          p.id,
          p.sku,
          p.name,
          p.description,
          p.short_description,
          p.base_price,
          p.currency_code,
          p.unit_of_measure,
          p.min_order_quantity,
          p.lead_time_days,
          p.category_id,
          c.name as category_name,
          c.slug as category_slug,
          pc.name as parent_category_name,
          pc.slug as parent_category_slug,
          -- Specifications
          ps.wattage,
          ps.lumens,
          ps.color_temperature,
          ps.cri,
          ps.beam_angle,
          ps.ip_rating,
          ps.efficacy,
          ps.dimmable,
          ps.dimming_type,
          ps.voltage_input,
          ps.mounting_type,
          ps.material,
          ps.color as product_color,
          ps.lifespan_hours,
          ps.warranty_years,
          ps.certification_ce,
          ps.certification_rohs,
          ps.energy_class,
          ps.brand,
          ps.manufacturer,
          ps.country_of_origin,
          ps.datasheet_url,
          -- Stock - local warehouse
          COALESCE(sl.quantity_on_hand, 0) as stock_local,
          COALESCE(sl.quantity_available, 0) as stock_available,
          COALESCE(sl.reorder_point, 0) as reorder_point,
          -- Stock - supplier (aggregated)
          COALESCE(ssc.supplier_stock, 0) as stock_supplier,
          COALESCE(ssc.supplier_lead_time, 0) as supplier_lead_time,
          COALESCE(ssc.supplier_count, 0) as supplier_count,
          -- Images
          (SELECT json_agg(json_build_object('url', pi.image_url, 'alt', pi.alt_text)) 
           FROM product_images pi WHERE pi.product_id = p.id) as images,
          -- Volume discounts
          (SELECT json_agg(json_build_object('min_qty', vd.min_quantity, 'max_qty', vd.max_quantity, 'discount', vd.discount_percentage))
           FROM volume_discounts vd WHERE vd.product_id = p.id AND vd.is_active = true AND (vd.end_date IS NULL OR vd.end_date >= CURRENT_DATE)) as volume_discounts
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = 1
        LEFT JOIN LATERAL (
          SELECT 
            SUM(sc.quantity_available) as supplier_stock,
            MIN(sc.lead_time_days) as supplier_lead_time,
            COUNT(DISTINCT sc.supplier_id) as supplier_count
          FROM supplier_stock_cache sc 
          WHERE sc.product_id = p.id AND sc.is_available = true
        ) ssc ON true
        ${whereClause}
        ORDER BY ${sortCol} ${sortDir} NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limitNum, offset);
      const products = await dataSource.query(query, params);

      res.json({
        success: true,
        data: {
          products: products.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description,
            short_description: p.short_description,
            base_price: parseFloat(p.base_price),
            currency: p.currency_code || 'RON',
            unit: p.unit_of_measure || 'buc',
            min_order_qty: p.min_order_quantity || 1,
            category: {
              id: p.category_id,
              name: p.category_name,
              slug: p.category_slug,
              parent_name: p.parent_category_name,
              parent_slug: p.parent_category_slug,
            },
            specs: {
              wattage: p.wattage ? parseFloat(p.wattage) : null,
              lumens: p.lumens,
              color_temperature: p.color_temperature,
              cri: p.cri,
              beam_angle: p.beam_angle,
              ip_rating: p.ip_rating,
              efficacy: p.efficacy ? parseFloat(p.efficacy) : null,
              dimmable: p.dimmable || false,
              dimming_type: p.dimming_type,
              voltage: p.voltage_input,
              mounting: p.mounting_type,
              material: p.material,
              color: p.product_color,
              lifespan_hours: p.lifespan_hours,
              warranty_years: p.warranty_years,
              certifications: {
                ce: p.certification_ce || false,
                rohs: p.certification_rohs || false,
              },
              energy_class: p.energy_class,
              brand: p.brand,
              manufacturer: p.manufacturer,
              origin: p.country_of_origin,
              datasheet_url: p.datasheet_url,
            },
            stock: {
              local: parseInt(p.stock_available) || 0,
              local_total: parseInt(p.stock_local) || 0,
              supplier: parseInt(p.supplier_stock) || 0,
              supplier_lead_days: parseInt(p.supplier_lead_time) || 0,
              supplier_count: parseInt(p.supplier_count) || 0,
              status:
                parseInt(p.stock_available) > 0
                  ? 'in_stock'
                  : parseInt(p.supplier_stock) > 0
                    ? 'supplier_stock'
                    : 'out_of_stock',
            },
            images: p.images || [],
            volume_discounts: p.volume_discounts || [],
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      next(error);
    }
  });

  // ==========================================
  // GET /products/:id - Product detail
  // ==========================================
  router.get('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.id);

      const query = `
        SELECT 
          p.*,
          c.name as category_name, c.slug as category_slug,
          pc.name as parent_category_name, pc.id as parent_category_id,
          ps.*,
          COALESCE(sl.quantity_on_hand, 0) as stock_local,
          COALESCE(sl.quantity_available, 0) as stock_available
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = 1
        WHERE p.id = $1 AND p.is_active = true
      `;

      const results = await dataSource.query(query, [productId]);
      if (results.length === 0) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      // Get supplier stock
      const supplierStock = await dataSource.query(
        `SELECT sc.*, s.name as supplier_name 
         FROM supplier_stock_cache sc 
         JOIN suppliers s ON s.id = sc.supplier_id 
         WHERE sc.product_id = $1 AND sc.is_available = true`,
        [productId],
      );

      // Get volume discounts
      const discounts = await dataSource.query(
        `SELECT * FROM volume_discounts WHERE product_id = $1 AND is_active = true ORDER BY min_quantity`,
        [productId],
      );

      // Get images
      const images = await dataSource.query(
        `SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order`,
        [productId],
      );

      // Get related products (same category)
      const related = await dataSource.query(
        `SELECT p.id, p.name, p.sku, p.base_price, p.currency_code,
                COALESCE(sl.quantity_available, 0) as stock_available,
                ps.brand, ps.wattage
         FROM products p
         LEFT JOIN product_specifications ps ON ps.product_id = p.id
         LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = 1
         WHERE p.category_id = $1 AND p.id != $2 AND p.is_active = true
         LIMIT 6`,
        [results[0].category_id, productId],
      );

      const p = results[0];
      res.json({
        success: true,
        data: {
          product: {
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description,
            short_description: p.short_description,
            base_price: parseFloat(p.base_price),
            currency: p.currency_code || 'RON',
            unit: p.unit_of_measure,
            min_order_qty: p.min_order_quantity,
            category: {
              id: p.category_id,
              name: p.category_name,
              slug: p.category_slug,
              parent_name: p.parent_category_name,
            },
            specs: {
              wattage: p.wattage ? parseFloat(p.wattage) : null,
              lumens: p.lumens,
              color_temperature: p.color_temperature,
              cri: p.cri,
              beam_angle: p.beam_angle,
              ip_rating: p.ip_rating,
              efficacy: p.efficacy ? parseFloat(p.efficacy) : null,
              dimmable: p.dimmable,
              dimming_type: p.dimming_type,
              voltage: p.voltage_input,
              mounting: p.mounting_type,
              material: p.material,
              color: p.color,
              lifespan_hours: p.lifespan_hours,
              warranty_years: p.warranty_years,
              certifications: {
                ce: p.certification_ce,
                rohs: p.certification_rohs,
                ul: p.certification_ul,
                etl: p.certification_etl,
              },
              energy_class: p.energy_class,
              brand: p.brand,
              manufacturer: p.manufacturer,
              origin: p.country_of_origin,
              datasheet_url: p.datasheet_url,
              ies_file_url: p.ies_file_url,
              installation_guide_url: p.installation_guide_url,
            },
            stock: {
              local: parseInt(p.stock_available) || 0,
              local_total: parseInt(p.stock_local) || 0,
              suppliers: supplierStock.map((ss: any) => ({
                supplier_name: ss.supplier_name,
                quantity: ss.quantity_available,
                price: parseFloat(ss.supplier_price),
                lead_time_days: ss.lead_time_days,
                min_order_qty: ss.min_order_qty,
              })),
            },
            images: images.map((img: any) => ({ url: img.image_url, alt: img.alt_text })),
            volume_discounts: discounts.map((d: any) => ({
              min_qty: d.min_quantity,
              max_qty: d.max_quantity,
              discount: parseFloat(d.discount_percentage),
            })),
            related_products: related,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // GET /categories - Category tree
  // ==========================================
  router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await dataSource.query(`
        SELECT c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order, c.is_active,
               COUNT(DISTINCT p.id) as product_count,
               pc.name as parent_name
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
        LEFT JOIN categories pc ON c.parent_id = pc.id
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order, c.is_active, pc.name
        ORDER BY c.sort_order, c.name
      `);

      // Build tree structure
      const roots = categories.filter((c: any) => !c.parent_id);
      const tree = roots.map((root: any) => ({
        ...root,
        product_count: parseInt(root.product_count),
        children: categories
          .filter((c: any) => c.parent_id === root.id)
          .map((child: any) => ({
            ...child,
            product_count: parseInt(child.product_count),
          })),
      }));

      res.json({ success: true, data: { categories: tree } });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // GET /filters - Available filter options
  // ==========================================
  router.get('/filters', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category_id } = req.query as Record<string, string>;
      let catCondition = '';
      const params: any[] = [];

      if (category_id) {
        catCondition = 'AND (p.category_id = $1 OR c.parent_id = $1)';
        params.push(parseInt(category_id));
      }

      const [brands, ipRatings, colorTemps, mountingTypes, priceRange] = await Promise.all([
        dataSource.query(
          `
          SELECT DISTINCT ps.brand, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.brand IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.brand ORDER BY count DESC
        `,
          params,
        ),
        dataSource.query(
          `
          SELECT DISTINCT ps.ip_rating, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.ip_rating IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.ip_rating ORDER BY ps.ip_rating
        `,
          params,
        ),
        dataSource.query(
          `
          SELECT DISTINCT ps.color_temperature, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.color_temperature IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.color_temperature ORDER BY ps.color_temperature
        `,
          params,
        ),
        dataSource.query(
          `
          SELECT DISTINCT ps.mounting_type, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.mounting_type IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.mounting_type ORDER BY count DESC
        `,
          params,
        ),
        dataSource.query(
          `
          SELECT MIN(p.base_price) as min_price, MAX(p.base_price) as max_price
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.is_active = true ${catCondition}
        `,
          params,
        ),
      ]);

      res.json({
        success: true,
        data: {
          brands: brands.map((b: any) => ({ value: b.brand, count: parseInt(b.count) })),
          ip_ratings: ipRatings.map((r: any) => ({ value: r.ip_rating, count: parseInt(r.count) })),
          color_temperatures: colorTemps.map((t: any) => ({
            value: t.color_temperature,
            count: parseInt(t.count),
            label: `${t.color_temperature}K`,
          })),
          mounting_types: mountingTypes.map((m: any) => ({
            value: m.mounting_type,
            count: parseInt(m.count),
          })),
          price_range: {
            min: parseFloat(priceRange[0]?.min_price || '0'),
            max: parseFloat(priceRange[0]?.max_price || '0'),
          },
          wattage_range: { min: 3, max: 200 },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // GET /suppliers - Supplier list
  // ==========================================
  router.get('/suppliers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const suppliers = await dataSource.query(`
        SELECT s.id, s.name, s.code, s.email, s.phone_number, s.website, s.city, s.country,
               s.lead_time_days,
               COUNT(DISTINCT ssc.id) as product_count,
               SUM(ssc.quantity_available) as total_stock
        FROM suppliers s
        LEFT JOIN supplier_stock_cache ssc ON ssc.supplier_id = s.id AND ssc.is_available = true
        WHERE s.is_active = true
        GROUP BY s.id ORDER BY s.name
      `);

      res.json({
        success: true,
        data: {
          suppliers: suppliers.map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            city: s.city,
            country: s.country,
            lead_time_days: s.lead_time_days,
            product_count: parseInt(s.product_count),
            total_stock: parseInt(s.total_stock) || 0,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // GET /stock-summary - Stock overview
  // ==========================================
  router.get('/stock-summary', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [localStock, supplierStock, lowStock] = await Promise.all([
        dataSource.query(`
          SELECT COUNT(*) as total_products,
                 SUM(sl.quantity_on_hand) as total_quantity,
                 SUM(CASE WHEN sl.quantity_available > 0 THEN 1 ELSE 0 END) as in_stock_count,
                 SUM(CASE WHEN sl.quantity_available = 0 THEN 1 ELSE 0 END) as out_of_stock_count
          FROM stock_levels sl
          JOIN products p ON p.id = sl.product_id AND p.is_active = true
          WHERE sl.warehouse_id = 1
        `),
        dataSource.query(`
          SELECT COUNT(DISTINCT sc.product_id) as products_available,
                 SUM(sc.quantity_available) as total_quantity,
                 COUNT(DISTINCT sc.supplier_id) as supplier_count
          FROM supplier_stock_cache sc WHERE sc.is_available = true
        `),
        dataSource.query(`
          SELECT p.id, p.name, p.sku, sl.quantity_available, sl.reorder_point
          FROM stock_levels sl
          JOIN products p ON p.id = sl.product_id AND p.is_active = true
          WHERE sl.warehouse_id = 1 AND sl.quantity_available <= sl.reorder_point
          ORDER BY sl.quantity_available ASC
          LIMIT 20
        `),
      ]);

      res.json({
        success: true,
        data: {
          local: {
            total_products: parseInt(localStock[0]?.total_products || '0'),
            total_quantity: parseInt(localStock[0]?.total_quantity || '0'),
            in_stock: parseInt(localStock[0]?.in_stock_count || '0'),
            out_of_stock: parseInt(localStock[0]?.out_of_stock_count || '0'),
          },
          supplier: {
            products_available: parseInt(supplierStock[0]?.products_available || '0'),
            total_quantity: parseInt(supplierStock[0]?.total_quantity || '0'),
            supplier_count: parseInt(supplierStock[0]?.supplier_count || '0'),
          },
          low_stock_alerts: lowStock,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // B2B Customer endpoints
  // ==========================================
  router.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        tier,
        status,
      } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, parseInt(limit));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        conditions.push(
          `(company_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR cui ILIKE $${paramIndex})`,
        );
        params.push(`%${search}%`);
        paramIndex++;
      }
      if (tier) {
        conditions.push(`tier = $${paramIndex}`);
        params.push(tier);
        paramIndex++;
      }
      if (status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

      params.push(limitNum, offset);
      const [customers, countResult] = await Promise.all([
        dataSource.query(
          `SELECT * FROM b2b_customers ${where} ORDER BY company_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          params,
        ),
        dataSource.query(
          `SELECT COUNT(*) as total FROM b2b_customers ${where}`,
          params.slice(0, -2),
        ),
      ]);

      res.json({
        success: true,
        data: {
          customers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: parseInt(countResult[0]?.total || '0'),
            total_pages: Math.ceil(parseInt(countResult[0]?.total || '0') / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      const result = await dataSource.query('SELECT * FROM b2b_customers WHERE id = $1', [id]);
      if (result.length === 0) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }

      const orders = await dataSource.query(
        'SELECT * FROM b2b_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10',
        [id],
      );

      res.json({ success: true, data: { customer: result[0], recent_orders: orders } });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // B2B Orders
  // ==========================================
  router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '20', customer_id, status } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, parseInt(limit));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: any[] = [];
      let pi = 1;

      if (customer_id) {
        conditions.push(`o.customer_id = $${pi}`);
        params.push(parseInt(customer_id));
        pi++;
      }
      if (status) {
        conditions.push(`o.status = $${pi}`);
        params.push(status);
        pi++;
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

      params.push(limitNum, offset);
      const orders = await dataSource.query(
        `
        SELECT o.*, bc.company_name as customer_name
        FROM b2b_orders o
        JOIN b2b_customers bc ON bc.id = o.customer_id
        ${where}
        ORDER BY o.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}
      `,
        params,
      );

      const count = await dataSource.query(
        `SELECT COUNT(*) as total FROM b2b_orders o ${where}`,
        params.slice(0, -2),
      );

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: parseInt(count[0]?.total || '0'),
            total_pages: Math.ceil(parseInt(count[0]?.total || '0') / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // B2B Cart
  // ==========================================
  router.post('/cart/add', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customer_id, product_id, quantity = 1, notes } = req.body;

      // Verify the authenticated user owns this customer_id
      const authenticatedCustomerId = (req as any).user?.customerId ?? (req as any).b2bCustomer?.id;
      if (authenticatedCustomerId && String(authenticatedCustomerId) !== String(customer_id)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: cart does not belong to authenticated user',
        });
        return;
      }

      // Get or create active cart
      let cart = await dataSource.query(
        'SELECT * FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1',
        [customer_id],
      );

      if (cart.length === 0) {
        cart = await dataSource.query(
          'INSERT INTO b2b_cart (customer_id, name) VALUES ($1, $2) RETURNING *',
          [customer_id, 'Coș Curent'],
        );
      }

      const cartId = cart[0].id;

      // Upsert cart item
      await dataSource.query(
        `
        INSERT INTO b2b_cart_items (cart_id, product_id, quantity, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = b2b_cart_items.quantity + $3, updated_at = NOW()
      `,
        [cartId, product_id, quantity, notes || null],
      );

      // Return updated cart
      const cartItems = await dataSource.query(
        `
        SELECT ci.*, p.name, p.sku, p.base_price, p.currency_code,
               COALESCE(sl.quantity_available, 0) as stock_available
        FROM b2b_cart_items ci
        JOIN products p ON p.id = ci.product_id
        LEFT JOIN stock_levels sl ON sl.product_id = ci.product_id AND sl.warehouse_id = 1
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at
      `,
        [cartId],
      );

      res.json({ success: true, data: { cart_id: cartId, items: cartItems } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cart/:customer_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = parseInt(req.params.customer_id);

      // Verify the authenticated user owns this customer_id
      const authenticatedCustomerId = (req as any).user?.customerId ?? (req as any).b2bCustomer?.id;
      if (authenticatedCustomerId && parseInt(authenticatedCustomerId) !== customerId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: cart does not belong to authenticated user',
        });
        return;
      }

      const cart = await dataSource.query(
        'SELECT * FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1',
        [customerId],
      );

      if (cart.length === 0) {
        res.json({
          success: true,
          data: { cart: null, items: [], totals: { subtotal: 0, items_count: 0 } },
        });
        return;
      }

      const items = await dataSource.query(
        `
        SELECT ci.id, ci.product_id, ci.quantity, ci.notes,
               p.name, p.sku, p.base_price, p.currency_code, p.unit_of_measure,
               ps.brand, ps.wattage, ps.ip_rating,
               COALESCE(sl.quantity_available, 0) as stock_available,
               (ci.quantity * p.base_price) as line_total
        FROM b2b_cart_items ci
        JOIN products p ON p.id = ci.product_id
        LEFT JOIN product_specifications ps ON ps.product_id = ci.product_id
        LEFT JOIN stock_levels sl ON sl.product_id = ci.product_id AND sl.warehouse_id = 1
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at
      `,
        [cart[0].id],
      );

      const subtotal = items.reduce((sum: number, i: any) => sum + parseFloat(i.line_total), 0);

      res.json({
        success: true,
        data: {
          cart: cart[0],
          items: items,
          totals: {
            subtotal,
            items_count: items.length,
            vat: subtotal * VAT_RATE,
            total: subtotal * (1 + VAT_RATE),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/cart/item/:item_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = parseInt(req.params.item_id);

      // Verify the cart item belongs to the authenticated user
      const authenticatedCustomerId = (req as any).user?.customerId ?? (req as any).b2bCustomer?.id;
      if (authenticatedCustomerId) {
        const ownerCheck = await dataSource.query(
          `SELECT ci.id FROM b2b_cart_items ci
           JOIN b2b_cart c ON c.id = ci.cart_id
           WHERE ci.id = $1 AND c.customer_id = $2`,
          [itemId, parseInt(authenticatedCustomerId)],
        );
        if (ownerCheck.length === 0) {
          res.status(403).json({
            success: false,
            error: 'Access denied: cart item does not belong to authenticated user',
          });
          return;
        }
      }

      await dataSource.query('DELETE FROM b2b_cart_items WHERE id = $1', [itemId]);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/cart/item/:item_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = parseInt(req.params.item_id);
      const { quantity } = req.body;

      // Verify the cart item belongs to the authenticated user
      const authenticatedCustomerId = (req as any).user?.customerId ?? (req as any).b2bCustomer?.id;
      if (authenticatedCustomerId) {
        const ownerCheck = await dataSource.query(
          `SELECT ci.id FROM b2b_cart_items ci
           JOIN b2b_cart c ON c.id = ci.cart_id
           WHERE ci.id = $1 AND c.customer_id = $2`,
          [itemId, parseInt(authenticatedCustomerId)],
        );
        if (ownerCheck.length === 0) {
          res
            .status(403)
            .json({
              success: false,
              error: 'Access denied: cart item does not belong to authenticated user',
            });
          return;
        }
      }

      await dataSource.query(
        'UPDATE b2b_cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [quantity, itemId],
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // Dashboard stats
  // ==========================================
  router.get('/dashboard/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [productCount, customerCount, orderStats, stockStats] = await Promise.all([
        dataSource.query('SELECT COUNT(*) as total FROM products WHERE is_active = true'),
        dataSource.query(
          "SELECT COUNT(*) as total, SUM(CASE WHEN tier = 'GOLD' OR tier = 'PLATINUM' THEN 1 ELSE 0 END) as premium FROM b2b_customers WHERE status = 'ACTIVE'",
        ),
        dataSource.query(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing
          FROM b2b_orders`),
        dataSource.query(`SELECT COUNT(*) as low_stock FROM stock_levels sl 
          JOIN products p ON p.id = sl.product_id AND p.is_active = true 
          WHERE sl.quantity_available <= sl.reorder_point AND sl.warehouse_id = 1`),
      ]);

      res.json({
        success: true,
        data: {
          products: parseInt(productCount[0]?.total || '0'),
          customers: {
            total: parseInt(customerCount[0]?.total || '0'),
            premium: parseInt(customerCount[0]?.premium || '0'),
          },
          orders: {
            total: parseInt(orderStats[0]?.total_orders || '0'),
            revenue: parseFloat(orderStats[0]?.total_revenue || '0'),
            pending: parseInt(orderStats[0]?.pending || '0'),
            processing: parseInt(orderStats[0]?.processing || '0'),
          },
          stock: { low_stock_alerts: parseInt(stockStats[0]?.low_stock || '0') },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // Search autocomplete
  // ==========================================
  router.get('/search/autocomplete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query as Record<string, string>;
      if (!q || q.length < 2) {
        res.json({ success: true, data: { suggestions: [] } });
        return;
      }

      const results = await dataSource.query(
        `
        SELECT p.id, p.name, p.sku, p.base_price, c.name as category_name, ps.brand
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        WHERE p.is_active = true AND (p.name ILIKE $1 OR p.sku ILIKE $1 OR ps.brand ILIKE $1)
        ORDER BY CASE WHEN p.sku ILIKE $1 THEN 0 ELSE 1 END, p.name
        LIMIT 10
      `,
        [`%${q}%`],
      );

      res.json({ success: true, data: { suggestions: results } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
