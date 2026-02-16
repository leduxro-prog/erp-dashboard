/**
 * B2B Stock Import & SmartBill Sync API
 * Handles CSV/Excel import of supplier stock and SmartBill stock sync
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import * as https from 'https';
import * as http from 'http';

export function createB2BStockRouter(dataSource: DataSource): Router {
  const router = Router();

  // ==========================================
  // POST /import/csv - Import supplier stock from CSV
  // ==========================================
  router.post('/import/csv', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplier_id, data, column_mapping } = req.body;

      if (!supplier_id || !data || !Array.isArray(data)) {
        res.status(400).json({ success: false, error: 'supplier_id and data array are required' });
        return;
      }

      // Default column mapping
      const mapping = column_mapping || {
        sku: 'sku',
        name: 'name',
        quantity: 'quantity',
        price: 'price',
        lead_time: 'lead_time',
        min_order_qty: 'min_order_qty',
      };

      let imported = 0;
      let errors: string[] = [];

      for (const row of data) {
        try {
          const sku = row[mapping.sku];
          const name = row[mapping.name] || sku;
          const quantity = parseInt(row[mapping.quantity]) || 0;
          const price = parseFloat(row[mapping.price]) || 0;
          const leadTime = parseInt(row[mapping.lead_time]) || 3;
          const minOrderQty = parseInt(row[mapping.min_order_qty]) || 1;

          if (!sku) {
            errors.push(`Row missing SKU: ${JSON.stringify(row)}`);
            continue;
          }

          // Try to match with existing product by SKU
          const productMatch = await dataSource.query(
            `SELECT p.id FROM products p WHERE p.sku = $1 
             UNION 
             SELECT sp.product_id FROM supplier_products sp WHERE sp.supplier_sku = $1 AND sp.supplier_id = $2
             UNION
             SELECT ssc.product_id FROM supplier_stock_cache ssc WHERE ssc.supplier_sku = $1 AND ssc.supplier_id = $2 AND ssc.product_id IS NOT NULL
             LIMIT 1`,
            [sku, supplier_id]
          );

          const productId = productMatch.length > 0 ? productMatch[0].id : null;

          await dataSource.query(`
            INSERT INTO supplier_stock_cache (supplier_id, product_id, supplier_sku, supplier_product_name, quantity_available, supplier_price, lead_time_days, min_order_qty, last_updated, is_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
            ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET
              supplier_product_name = COALESCE($4, supplier_stock_cache.supplier_product_name),
              quantity_available = $5,
              supplier_price = CASE WHEN $6 > 0 THEN $6 ELSE supplier_stock_cache.supplier_price END,
              lead_time_days = $7,
              min_order_qty = $8,
              last_updated = NOW(),
              is_available = $9,
              product_id = COALESCE($2, supplier_stock_cache.product_id)
          `, [supplier_id, productId, sku, name, quantity, price, leadTime, minOrderQty, quantity > 0]);

          imported++;
        } catch (err) {
          errors.push(`Error importing row: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Update supplier stock feed status
      await dataSource.query(`
        UPDATE supplier_stock_feeds 
        SET last_sync_at = NOW(), last_sync_status = 'SUCCESS', products_synced = $1 
        WHERE supplier_id = $2 AND is_active = true
      `, [imported, supplier_id]);

      res.json({
        success: true,
        data: {
          imported,
          total_rows: data.length,
          errors: errors.length,
          error_details: errors.slice(0, 10),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // POST /import/csv-text - Import from raw CSV text
  // ==========================================
  router.post('/import/csv-text', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplier_id, csv_text, delimiter = ',', has_header = true } = req.body;

      if (!supplier_id || !csv_text) {
        res.status(400).json({ success: false, error: 'supplier_id and csv_text are required' });
        return;
      }

      const lines = csv_text.trim().split('\n');
      if (lines.length < (has_header ? 2 : 1)) {
        res.status(400).json({ success: false, error: 'CSV must have at least one data row' });
        return;
      }

      let headers: string[];
      let startIndex: number;

      if (has_header) {
        headers = lines[0].split(delimiter).map((h: string) => h.trim().toLowerCase().replace(/['"]/g, ''));
        startIndex = 1;
      } else {
        headers = ['sku', 'name', 'quantity', 'price', 'lead_time'];
        startIndex = 0;
      }

      // Auto-detect column mapping
      const mapping: Record<string, number> = {};
      const skuAliases = ['sku', 'cod', 'code', 'cod_produs', 'product_code', 'articol', 'ref', 'referinta'];
      const nameAliases = ['name', 'nume', 'denumire', 'descriere', 'product_name', 'produs'];
      const qtyAliases = ['quantity', 'qty', 'cantitate', 'stoc', 'stock', 'disponibil', 'available'];
      const priceAliases = ['price', 'pret', 'pret_unitar', 'unit_price', 'cost', 'pret_achizitie'];
      const leadAliases = ['lead_time', 'termen', 'zile_livrare', 'delivery_days'];

      headers.forEach((h, i) => {
        if (skuAliases.includes(h)) mapping.sku = i;
        if (nameAliases.includes(h)) mapping.name = i;
        if (qtyAliases.includes(h)) mapping.quantity = i;
        if (priceAliases.includes(h)) mapping.price = i;
        if (leadAliases.includes(h)) mapping.lead_time = i;
      });

      // Fallback: if no mapping found, assume order: sku, name, qty, price
      if (mapping.sku === undefined) mapping.sku = 0;
      if (mapping.name === undefined && headers.length > 1) mapping.name = 1;
      if (mapping.quantity === undefined) mapping.quantity = headers.length > 2 ? 2 : 1;
      if (mapping.price === undefined && headers.length > 3) mapping.price = 3;

      const data: Record<string, string>[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map((c: string) => c.trim().replace(/['"]/g, ''));
        if (cols.length < 2) continue;

        data.push({
          sku: cols[mapping.sku] || '',
          name: cols[mapping.name] || cols[mapping.sku] || '',
          quantity: cols[mapping.quantity] || '0',
          price: cols[mapping.price] || '0',
          lead_time: cols[mapping.lead_time] || '3',
          min_order_qty: '1',
        });
      }

      // Reuse the JSON import logic
      let imported = 0;
      let errors: string[] = [];

      for (const row of data) {
        try {
          if (!row.sku) continue;
          const quantity = parseInt(row.quantity) || 0;
          const price = parseFloat(row.price) || 0;
          const leadTime = parseInt(row.lead_time) || 3;

          const productMatch = await dataSource.query(
            `SELECT p.id FROM products p WHERE p.sku = $1 LIMIT 1`,
            [row.sku]
          );
          const productId = productMatch.length > 0 ? productMatch[0].id : null;

          await dataSource.query(`
            INSERT INTO supplier_stock_cache (supplier_id, product_id, supplier_sku, supplier_product_name, quantity_available, supplier_price, lead_time_days, min_order_qty, last_updated, is_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), $8)
            ON CONFLICT (supplier_id, supplier_sku) DO UPDATE SET
              supplier_product_name = COALESCE($4, supplier_stock_cache.supplier_product_name),
              quantity_available = $5,
              supplier_price = CASE WHEN $6 > 0 THEN $6 ELSE supplier_stock_cache.supplier_price END,
              lead_time_days = $7,
              last_updated = NOW(),
              is_available = $8,
              product_id = COALESCE($2, supplier_stock_cache.product_id)
          `, [supplier_id, productId, row.sku, row.name, quantity, price, leadTime, quantity > 0]);
          imported++;
        } catch (err) {
          errors.push(`SKU ${row.sku}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      res.json({
        success: true,
        data: {
          imported,
          total_rows: data.length,
          errors: errors.length,
          detected_columns: headers,
          column_mapping: mapping,
          error_details: errors.slice(0, 10),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================
  // POST /smartbill/sync-stock - Sync stock from SmartBill
  // ==========================================
  router.post('/smartbill/sync-stock', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouse_name } = req.body;

      // Get SmartBill credentials from settings or env
      const settings = await dataSource.query(
        "SELECT key, value FROM settings WHERE key IN ('SMARTBILL_USERNAME', 'SMARTBILL_TOKEN', 'SMARTBILL_COMPANY_VAT')"
      );

      const config: Record<string, string> = {};
      settings.forEach((s: any) => { config[s.key] = s.value; });

      const username = config.SMARTBILL_USERNAME || process.env.SMARTBILL_USERNAME;
      const token = config.SMARTBILL_TOKEN || process.env.SMARTBILL_TOKEN;
      const companyVat = config.SMARTBILL_COMPANY_VAT || process.env.SMARTBILL_COMPANY_VAT;

      if (!username || !token || !companyVat) {
        res.status(400).json({
          success: false,
          error: 'SmartBill credentials not configured. Set SMARTBILL_USERNAME, SMARTBILL_TOKEN, and SMARTBILL_COMPANY_VAT in Settings.',
        });
        return;
      }

      // Call SmartBill Stock API
      const authHeader = Buffer.from(`${username}:${token}`).toString('base64');
      const warehouseParam = warehouse_name ? `&warehouseName=${encodeURIComponent(warehouse_name)}` : '';
      const url = `https://ws.smartbill.ro/SBORO/api/stocks?cif=${companyVat}${warehouseParam}&date=${new Date().toISOString().split('T')[0]}`;

      const smartbillData: any = await new Promise((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Accept': 'application/json',
          },
        }, (response) => {
          let data = '';
          response.on('data', (chunk: string) => { data += chunk; });
          response.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Invalid SmartBill response'));
            }
          });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('SmartBill API timeout')); });
      });

      if (!smartbillData || !smartbillData.list) {
        res.json({
          success: false,
          error: 'No stock data from SmartBill',
          raw_response: smartbillData?.errorText || 'Empty response',
        });
        return;
      }

      // Update local stock levels based on SmartBill data
      let synced = 0;
      let errors: string[] = [];

      for (const item of smartbillData.list) {
        try {
          const productCode = item.productCode || item.code;
          const productName = item.productName || item.name;
          const quantity = parseFloat(item.quantity) || 0;

          // Try to match product by SmartBill mapping first, then by SKU
          const match = await dataSource.query(`
            SELECT COALESCE(sm.product_id, p.id) as product_id
            FROM (SELECT $1::text as code) q
            LEFT JOIN smartbill_product_mapping sm ON sm.smartbill_product_code = q.code AND sm.is_active = true
            LEFT JOIN products p ON p.sku = q.code AND p.is_active = true
            WHERE sm.product_id IS NOT NULL OR p.id IS NOT NULL
            LIMIT 1
          `, [productCode]);

          if (match.length > 0) {
            const productId = match[0].product_id;

            // Update stock level
            await dataSource.query(`
              INSERT INTO stock_levels (product_id, warehouse_id, quantity_on_hand, quantity_available, reorder_point, reorder_quantity)
              VALUES ($1, 1, $2, $2, 10, 50)
              ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
                quantity_on_hand = $2,
                quantity_available = $2 - COALESCE(stock_levels.quantity_reserved, 0),
                updated_at = NOW()
            `, [productId, Math.floor(quantity)]);

            // Update mapping
            await dataSource.query(`
              INSERT INTO smartbill_product_mapping (product_id, smartbill_product_name, smartbill_product_code, last_synced_quantity, last_sync_at)
              VALUES ($1, $2, $3, $4, NOW())
              ON CONFLICT (product_id, smartbill_product_code) DO UPDATE SET
                smartbill_product_name = $2,
                last_synced_quantity = $4,
                last_sync_at = NOW()
            `, [productId, productName, productCode, Math.floor(quantity)]);

            synced++;
          } else {
            // Store unmatched for manual mapping later
            await dataSource.query(`
              INSERT INTO smartbill_product_mapping (product_id, smartbill_product_name, smartbill_product_code, warehouse_name, last_synced_quantity, last_sync_at, is_active)
              SELECT 0, $1, $2, $3, $4, NOW(), false
              WHERE NOT EXISTS (SELECT 1 FROM smartbill_product_mapping WHERE smartbill_product_code = $2 AND product_id = 0)
            `, [productName, productCode, warehouse_name || 'Default', Math.floor(quantity)]);
          }
        } catch (err) {
          errors.push(`Product ${item.productCode}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Log sync
      await dataSource.query(`
        INSERT INTO smartbill_sync (sync_type, status, details, synced_at)
        VALUES ('STOCK', 'COMPLETED', $1, NOW())
      `, [JSON.stringify({ synced, total: smartbillData.list.length, errors: errors.length })]).catch(() => {});

      res.json({
        success: true,
        data: {
          total_smartbill_items: smartbillData.list.length,
          synced_to_local: synced,
          unmatched: smartbillData.list.length - synced,
          errors: errors.length,
          error_details: errors.slice(0, 10),
        },
      });
    } catch (error) {
      console.error('SmartBill sync error:', error);
      next(error);
    }
  });

  // ==========================================
  // GET /smartbill/mapping - View SmartBill product mappings
  // ==========================================
  router.get('/smartbill/mapping', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const mappings = await dataSource.query(`
        SELECT sm.*, p.name as erp_product_name, p.sku as erp_sku
        FROM smartbill_product_mapping sm
        LEFT JOIN products p ON p.id = sm.product_id AND sm.product_id > 0
        ORDER BY sm.is_active DESC, sm.last_sync_at DESC
      `);

      res.json({ success: true, data: { mappings } });
    } catch (error) { next(error); }
  });

  // ==========================================
  // PUT /smartbill/mapping/:id - Update mapping (link to product)
  // ==========================================
  router.put('/smartbill/mapping/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { product_id } = req.body;
      const mappingId = parseInt(req.params.id);

      await dataSource.query(
        'UPDATE smartbill_product_mapping SET product_id = $1, is_active = true, updated_at = NOW() WHERE id = $2',
        [product_id, mappingId]
      );

      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // ==========================================
  // GET /supplier-feeds - List supplier stock feeds
  // ==========================================
  router.get('/supplier-feeds', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const feeds = await dataSource.query(`
        SELECT sf.*, s.name as supplier_name, s.code as supplier_code
        FROM supplier_stock_feeds sf
        JOIN suppliers s ON s.id = sf.supplier_id
        ORDER BY sf.supplier_id
      `);

      res.json({ success: true, data: { feeds } });
    } catch (error) { next(error); }
  });

  // ==========================================
  // POST /supplier-feeds - Create supplier stock feed config
  // ==========================================
  router.post('/supplier-feeds', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplier_id, feed_type, feed_url, feed_config, sync_interval_minutes } = req.body;

      const result = await dataSource.query(`
        INSERT INTO supplier_stock_feeds (supplier_id, feed_type, feed_url, feed_config, sync_interval_minutes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [supplier_id, feed_type || 'CSV', feed_url, JSON.stringify(feed_config || {}), sync_interval_minutes || 60]);

      res.status(201).json({ success: true, data: result[0] });
    } catch (error) { next(error); }
  });

  // ==========================================
  // GET /stock-report - Detailed stock report
  // ==========================================
  router.get('/stock-report', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await dataSource.query(`
        SELECT 
          p.id, p.sku, p.name, p.base_price,
          c.name as category,
          ps.brand,
          COALESCE(sl.quantity_on_hand, 0) as local_stock,
          COALESCE(sl.quantity_available, 0) as local_available,
          COALESCE(supplier_agg.total_supplier_stock, 0) as supplier_stock,
          COALESCE(supplier_agg.min_lead_time, 0) as min_lead_time,
          COALESCE(supplier_agg.supplier_names, '') as suppliers,
          CASE 
            WHEN COALESCE(sl.quantity_available, 0) > 0 THEN 'IN_STOCK'
            WHEN COALESCE(supplier_agg.total_supplier_stock, 0) > 0 THEN 'SUPPLIER_ONLY'
            ELSE 'OUT_OF_STOCK'
          END as availability_status
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_specifications ps ON ps.product_id = p.id
        LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.warehouse_id = 1
        LEFT JOIN LATERAL (
          SELECT 
            SUM(sc.quantity_available) as total_supplier_stock,
            MIN(sc.lead_time_days) as min_lead_time,
            STRING_AGG(DISTINCT s.name, ', ') as supplier_names
          FROM supplier_stock_cache sc
          JOIN suppliers s ON s.id = sc.supplier_id
          WHERE sc.product_id = p.id AND sc.is_available = true
        ) supplier_agg ON true
        WHERE p.is_active = true
        ORDER BY p.name
      `);

      const summary = {
        total_products: report.length,
        in_stock: report.filter((r: any) => r.availability_status === 'IN_STOCK').length,
        supplier_only: report.filter((r: any) => r.availability_status === 'SUPPLIER_ONLY').length,
        out_of_stock: report.filter((r: any) => r.availability_status === 'OUT_OF_STOCK').length,
      };

      res.json({ success: true, data: { summary, products: report } });
    } catch (error) { next(error); }
  });

  return router;
}
