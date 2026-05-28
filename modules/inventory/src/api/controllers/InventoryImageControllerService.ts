import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';

import { errorResponse, successResponse } from '@shared/utils/response';

import { ProductImageSearchService } from '../../application/services/ProductImageSearchService';
import { InventoryListCache } from '../../infrastructure/cache/InventoryListCache';
import { InventoryControllerHelpers } from './InventoryControllerHelpers';

interface InventoryImageControllerLogger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

interface InventoryImageControllerDependencies {
  dataSource?: DataSource;
  inventoryListCache?: InventoryListCache;
  imageSearchService: ProductImageSearchService;
  helpers: InventoryControllerHelpers;
  logger: InventoryImageControllerLogger;
}

export class InventoryImageControllerService {
  private readonly allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  constructor(private readonly deps: InventoryImageControllerDependencies) {}

  async addProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { imageUrl, altText, isPrimary } = req.body;

      if (!this.deps.helpers.isValidProductImageUrl(imageUrl)) {
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

      if (!(await this.deps.helpers.hasValidImageMimeType(String(imageUrl).trim()))) {
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

      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      if (isPrimary) {
        await dataSource.query(`UPDATE product_images SET is_primary = false WHERE product_id = $1`, [
          productId,
        ]);
      }

      const result = await dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1), 0), NOW())
         RETURNING *`,
        [productId, imageUrl.trim(), altText || '', isPrimary || false],
      );

      await this.deps.inventoryListCache?.invalidateAll();

      res.status(201).json(successResponse(result[0]));
    } catch (error) {
      this.deps.logger.error('Error adding product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add product image', 500));
    }
  }

  async deleteProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId, imageId } = req.params;

      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      await dataSource.query(`DELETE FROM product_images WHERE id = $1 AND product_id = $2`, [
        imageId,
        productId,
      ]);

      await this.deps.inventoryListCache?.invalidateAll();

      res.json(successResponse({ message: 'Image deleted successfully' }));
    } catch (error) {
      this.deps.logger.error('Error deleting product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete product image', 500));
    }
  }

  async bulkImportImages(req: Request, res: Response): Promise<void> {
    try {
      const { images } = req.body;
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
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

          if (!this.deps.helpers.isValidProductImageUrl(imageUrl)) {
            errors.push(`SKU ${sku}: URL imagine invalida`);
            failed++;
            continue;
          }

          const normalizedImageUrl = String(imageUrl).trim();
          if (!mimeValidationCache.has(normalizedImageUrl)) {
            mimeValidationCache.set(
              normalizedImageUrl,
              await this.deps.helpers.hasValidImageMimeType(normalizedImageUrl),
            );
          }

          if (!mimeValidationCache.get(normalizedImageUrl)) {
            errors.push(`SKU ${sku}: URL imagine invalid (MIME)`);
            failed++;
            continue;
          }

          const product = await dataSource.query(
            `SELECT id FROM products WHERE sku = $1 AND is_active = true LIMIT 1`,
            [sku],
          );

          if (product.length === 0) {
            errors.push(`Product not found for SKU: ${sku}`);
            failed++;
            continue;
          }

          const productId = product[0].id;

          if (isPrimary) {
            await dataSource.query(`UPDATE product_images SET is_primary = false WHERE product_id = $1`, [
              productId,
            ]);
          }

          await dataSource.query(
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
        await this.deps.inventoryListCache?.invalidateAll();
      }

      res.json(
        successResponse({
          message: 'Bulk import completed',
          imported,
          failed,
          errors: errors.slice(0, 10),
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error bulk importing images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to bulk import images', 500));
    }
  }

  async autoSearchProductImages(req: Request, res: Response): Promise<void> {
    try {
      const { limit, skipExisting } = req.query;
      const { productIds } = req.body || {};
      const maxProducts = Math.min(parseInt(limit as string) || 50, 200);

      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      let products: any[];

      if (Array.isArray(productIds) && productIds.length > 0) {
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
        products = await dataSource.query(query, ids);
      } else {
        const query =
          skipExisting === 'true'
            ? `SELECT p.id, p.sku, p.name
             FROM products p
             LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
             WHERE p.is_active = true AND pi.id IS NULL
             ORDER BY p.id ASC
             LIMIT $1`
            : `SELECT p.id, p.sku, p.name FROM products p WHERE p.is_active = true ORDER BY p.id ASC LIMIT $1`;
        products = await dataSource.query(query, [maxProducts]);
      }

      this.deps.logger.info(`Starting auto-search for ${products.length} products`);

      const searchResults = await this.deps.imageSearchService.searchProductImagesBatch(
        products.map((p: any) => ({ sku: p.sku, name: p.name })),
        { maxConcurrent: 2, delayMs: 3000 },
      );

      let imported = 0;
      let notFound = 0;
      const errors: string[] = [];

      for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i];
        const product = products[i];

        if (result.imageUrl && result.confidence !== 'low') {
          try {
            await dataSource.query(`UPDATE product_images SET is_primary = false WHERE product_id = $1`, [
              product.id,
            ]);

            await dataSource.query(
              `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
               VALUES ($1, $2, $3, true, 0, NOW())
               ON CONFLICT DO NOTHING`,
              [product.id, result.imageUrl, product.name || result.sku],
            );

            await dataSource.query(
              `UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2`,
              [result.imageUrl, product.id],
            );

            imported++;
            this.deps.logger.info(`Imported image for SKU: ${result.sku}`);
          } catch (err) {
            errors.push(`SKU ${result.sku}: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          notFound++;
        }
      }

      if (imported > 0) {
        await this.deps.inventoryListCache?.invalidateAll();
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
      this.deps.logger.error('Error auto-searching product images:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to auto-search images', 500));
    }
  }

  async uploadProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const file = (req as any).file;

      if (!file) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Nu a fost trimis niciun fisier', 400));
        return;
      }

      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const product = await dataSource.query('SELECT id, name FROM products WHERE id = $1', [productId]);

      if (product.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const imageUrl = `/uploads/products/${file.filename}`;
      const altText = req.body.alt_text || product[0].name || '';
      const isPrimary = req.body.is_primary !== 'false';

      if (isPrimary) {
        await dataSource.query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [
          productId,
        ]);
      }

      const result = await dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, $4, 0, NOW())
         RETURNING id, image_url, alt_text, is_primary`,
        [productId, imageUrl, altText, isPrimary],
      );

      if (isPrimary) {
        await dataSource.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [
          imageUrl,
          productId,
        ]);
      }

      await this.deps.inventoryListCache?.invalidateAll();

      this.deps.logger.info(`Image uploaded for product ${productId}: ${imageUrl}`);

      res.status(201).json(
        successResponse({
          id: result[0].id,
          image_url: imageUrl,
          alt_text: altText,
          is_primary: isPrimary,
          filename: file.filename,
          size: file.size,
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error uploading product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la upload imagine', 500));
    }
  }

  async searchProductImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const products = await dataSource.query('SELECT id, sku, name FROM products WHERE id = $1', [
        productId,
      ]);

      if (products.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const product = products[0];
      const customQuery = req.body?.query;

      this.deps.logger.info(
        `Searching images for product ${productId} (SKU: ${product.sku})${customQuery ? ` with query: ${customQuery}` : ''}`,
      );

      const candidates = customQuery
        ? await this.deps.imageSearchService.searchCandidates(customQuery, undefined, 6)
        : await this.deps.imageSearchService.searchCandidates(product.sku, product.name, 6);

      res.json(
        successResponse({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          candidates,
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error searching product image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la cautarea imaginii', 500));
    }
  }

  async selectSearchedImage(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'imageUrl este obligatoriu', 400));
        return;
      }

      if (!this.deps.helpers.isValidProductImageUrl(imageUrl)) {
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

      if (!(await this.deps.helpers.hasValidImageMimeType(String(imageUrl).trim()))) {
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

      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const products = await dataSource.query('SELECT id, sku, name FROM products WHERE id = $1', [
        productId,
      ]);

      if (products.length === 0) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Produs negasit', 404));
        return;
      }

      const product = products[0];

      const localPath = await this.deps.imageSearchService.downloadExternalImage(
        imageUrl,
        product.id,
        product.sku,
      );

      const selectedImagePath = localPath || imageUrl;

      if (!selectedImagePath) {
        res
          .status(422)
          .json(errorResponse('DOWNLOAD_FAILED', 'Nu s-a putut descarca imaginea', 422));
        return;
      }

      await dataSource.query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [
        productId,
      ]);

      const result = await dataSource.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
         VALUES ($1, $2, $3, true, 0, NOW())
         RETURNING id, image_url, alt_text, is_primary`,
        [productId, selectedImagePath, product.name || product.sku],
      );

      await dataSource.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [
        selectedImagePath,
        productId,
      ]);

      await this.deps.inventoryListCache?.invalidateAll();

      this.deps.logger.info(`Selected searched image for product ${productId}: ${selectedImagePath}`);

      res.status(201).json(
        successResponse({
          id: result[0].id,
          image_url: selectedImagePath,
          alt_text: product.name || product.sku,
          is_primary: true,
          original_url: imageUrl,
          downloaded: Boolean(localPath),
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error selecting searched image:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Eroare la salvarea imaginii', 500));
    }
  }

  async syncSupplierFeedImages(req: Request, res: Response): Promise<void> {
    try {
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const { limit, skipExisting, validateMime } = req.body || {};
      const maxProducts = Math.min(Number(limit) || 500, 5000);
      const onlyMissing = skipExisting !== false;
      const enforceMime = validateMime !== false;

      const candidates = await dataSource.query(
        `SELECT
           p.id,
           p.sku,
           p.name,
           feed.image_url
         FROM products p
         JOIN LATERAL (
           SELECT sp.image_url
           FROM supplier_products sp
           WHERE sp.product_id = p.id
             AND sp.is_active = true
             AND sp.image_url IS NOT NULL
             AND BTRIM(sp.image_url) <> ''
           ORDER BY sp.updated_at DESC
           LIMIT 1
         ) AS feed ON true
         WHERE p.is_active = true
           AND ($1::boolean = false OR p.image_url IS NULL OR p.image_url = '')
         ORDER BY p.id ASC
         LIMIT $2`,
        [onlyMissing, maxProducts],
      );

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];
      const mimeValidationCache = new Map<string, boolean>();

      for (const row of candidates as Array<{
        id: number;
        sku: string;
        name: string;
        image_url: string;
      }>) {
        const imageUrl = String(row.image_url || '').trim();

        try {
          let parsed: URL;
          try {
            parsed = new URL(imageUrl);
          } catch {
            failed++;
            errors.push(`SKU ${row.sku}: invalid URL format`);
            continue;
          }

          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            failed++;
            errors.push(`SKU ${row.sku}: invalid URL protocol`);
            continue;
          }

          if (enforceMime) {
            if (!mimeValidationCache.has(imageUrl)) {
              mimeValidationCache.set(
                imageUrl,
                await this.deps.helpers.hasValidImageMimeType(imageUrl),
              );
            }
            if (!mimeValidationCache.get(imageUrl)) {
              failed++;
              errors.push(`SKU ${row.sku}: URL MIME check failed`);
              continue;
            }
          }

          await this.upsertPrimaryImage(dataSource, row.id, imageUrl, row.name || row.sku);
          imported++;
        } catch (error) {
          failed++;
          errors.push(
            `SKU ${row.sku}: ${error instanceof Error ? error.message : 'unknown import error'}`,
          );
        }
      }

      if (imported > 0) {
        await this.deps.inventoryListCache?.invalidateAll();
      }

      res.json(
        successResponse({
          message: 'Supplier feed image sync completed',
          scanned: candidates.length,
          imported,
          failed,
          errors: errors.slice(0, 20),
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error syncing supplier feed images:', error);
      res
        .status(500)
        .json(errorResponse('INTERNAL_ERROR', 'Failed to sync supplier feed images', 500));
    }
  }

  async fallbackLocalImages(req: Request, res: Response): Promise<void> {
    try {
      const dataSource = this.requireDataSource(res);
      if (!dataSource) {
        return;
      }

      const { limit, skipExisting } = req.body || {};
      const maxProducts = Math.min(Number(limit) || 1000, 10000);
      const onlyMissing = skipExisting !== false;

      const products = await dataSource.query(
        `SELECT
           p.id,
           p.sku,
           p.name,
           COALESCE(MAX(m.name), '') AS manufacturer_name,
           COALESCE(MAX(s.name), '') AS supplier_name
         FROM products p
         LEFT JOIN supplier_products sp ON sp.product_id = p.id AND sp.is_active = true
         LEFT JOIN manufacturers m ON m.id = sp.manufacturer_id
         LEFT JOIN suppliers s ON s.id = sp.supplier_id
         WHERE p.is_active = true
           AND ($1::boolean = false OR p.image_url IS NULL OR p.image_url = '')
         GROUP BY p.id, p.sku, p.name
         ORDER BY p.id ASC
         LIMIT $2`,
        [onlyMissing, maxProducts],
      );

      const productsDir = path.resolve(process.cwd(), 'uploads', 'products');
      const azzardoDir = path.resolve(process.cwd(), 'uploads', 'azzardo');
      const filesByProductId = this.buildFilesByProductId(productsDir);

      let imported = 0;
      let notFound = 0;
      const sources = { productsDir: 0, azzardoDir: 0 };
      const errors: string[] = [];

      for (const row of products as Array<{
        id: number;
        sku: string;
        name: string;
        manufacturer_name: string;
        supplier_name: string;
      }>) {
        try {
          const localImage =
            this.findProductDirImage(filesByProductId.get(Number(row.id)) || [], Number(row.id), row.sku) ||
            this.findBrandFallbackImage(azzardoDir, row.sku, row.name, row.manufacturer_name, row.supplier_name);

          if (!localImage) {
            notFound++;
            continue;
          }

          await this.upsertPrimaryImage(dataSource, Number(row.id), localImage.path, row.name || row.sku);
          imported++;

          if (localImage.source === 'uploads/products') {
            sources.productsDir++;
          } else if (localImage.source === 'uploads/azzardo') {
            sources.azzardoDir++;
          }
        } catch (error) {
          errors.push(
            `SKU ${row.sku}: ${error instanceof Error ? error.message : 'local fallback error'}`,
          );
        }
      }

      if (imported > 0) {
        await this.deps.inventoryListCache?.invalidateAll();
      }

      res.json(
        successResponse({
          message: 'Local fallback image sync completed',
          scanned: products.length,
          imported,
          notFound,
          sources,
          errors: errors.slice(0, 20),
        }),
      );
    } catch (error) {
      this.deps.logger.error('Error running local fallback image sync:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to run local fallback sync', 500));
    }
  }

  private async upsertPrimaryImage(
    dataSource: DataSource,
    productId: number,
    imageUrl: string,
    altText: string,
  ): Promise<void> {
    await dataSource.query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [
      productId,
    ]);

    await dataSource.query(
      `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order, created_at)
       VALUES ($1, $2, $3, true, 0, NOW())
       ON CONFLICT DO NOTHING`,
      [productId, imageUrl, altText || ''],
    );

    await dataSource.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [
      imageUrl,
      productId,
    ]);
  }

  private buildFilesByProductId(productsDir: string): Map<number, string[]> {
    const index = new Map<number, string[]>();
    if (!fs.existsSync(productsDir)) {
      return index;
    }

    for (const fileName of fs.readdirSync(productsDir)) {
      const match = fileName.match(/^(\d+)-.+\.(jpg|jpeg|png|webp|gif)$/i);
      if (!match) {
        continue;
      }

      const productId = Number(match[1]);
      if (!Number.isInteger(productId) || productId <= 0) {
        continue;
      }

      const existing = index.get(productId) || [];
      existing.push(fileName);
      index.set(productId, existing);
    }

    return index;
  }

  private findProductDirImage(
    fileNames: string[],
    productId: number,
    sku: string,
  ): { path: string; source: string } | null {
    if (fileNames.length === 0) {
      return null;
    }

    const escapedSku = this.escapeRegExp(String(sku || '').trim());
    const strictPattern = new RegExp(
      `^${productId}-${escapedSku}(?:[-_.].+)?\\.(?:jpg|jpeg|png|webp|gif)$`,
      'i',
    );

    const strictMatch = fileNames.find((name) => strictPattern.test(name));
    if (strictMatch) {
      return { path: `/uploads/products/${strictMatch}`, source: 'uploads/products' };
    }

    const normalizedSku = this.normalizeSkuToken(sku);
    if (!normalizedSku) {
      return null;
    }

    for (const name of fileNames) {
      const normalizedFile = this.normalizeSkuToken(name.replace(/^\d+-/, '').replace(/\.[^.]+$/, ''));
      if (normalizedFile.startsWith(normalizedSku)) {
        return { path: `/uploads/products/${name}`, source: 'uploads/products' };
      }
    }

    return null;
  }

  private findBrandFallbackImage(
    azzardoDir: string,
    sku: string,
    name: string,
    manufacturerName: string,
    supplierName: string,
  ): { path: string; source: string } | null {
    const skuTrimmed = String(sku || '').trim();
    if (!skuTrimmed) {
      return null;
    }

    const brandSignals = [name, manufacturerName, supplierName, skuTrimmed]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');

    const likelyAzzardo =
      brandSignals.includes('azzardo') ||
      skuTrimmed.toUpperCase().startsWith('AZ') ||
      skuTrimmed.toUpperCase().startsWith('AZZ');

    if (!likelyAzzardo || !fs.existsSync(azzardoDir)) {
      return null;
    }

    for (const ext of this.allowedExtensions) {
      const fileName = `${skuTrimmed}${ext}`;
      const absolute = path.resolve(azzardoDir, fileName);
      if (fs.existsSync(absolute)) {
        return { path: `/uploads/azzardo/${fileName}`, source: 'uploads/azzardo' };
      }

      const upperAbsolute = path.resolve(azzardoDir, `${skuTrimmed.toUpperCase()}${ext}`);
      if (fs.existsSync(upperAbsolute)) {
        return { path: `/uploads/azzardo/${skuTrimmed.toUpperCase()}${ext}`, source: 'uploads/azzardo' };
      }
    }

    return null;
  }

  private normalizeSkuToken(value: string): string {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private requireDataSource(res: Response): DataSource | null {
    if (!this.deps.dataSource) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'DataSource not available', 500));
      return null;
    }

    return this.deps.dataSource;
  }
}
