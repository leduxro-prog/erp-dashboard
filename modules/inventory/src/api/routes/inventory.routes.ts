import { wrapController } from '@shared/middleware/async-handler';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { errorResponse } from '@shared/utils/response';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '@shared/middleware/validation.middleware';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import { InventoryController } from '../controllers/InventoryController';
import { InventoryPickingController } from '../controllers/InventoryPickingController';
import {
  checkStockSchema,
  reserveStockSchema,
  adjustStockSchema,
  getMovementsSchema,
} from '../validators/inventory.validators';

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.resolve(process.cwd(), 'uploads/products');
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 80);
      cb(null, `${Date.now()}-${randomUUID()}-${safeBase || 'product'}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only JPG, PNG, WebP, and GIF images are allowed'));
  },
});

async function detectAllowedImageExtension(filePath: string): Promise<string | null> {
  const buffer = await fs.promises.readFile(filePath);

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return '.png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }

  if (
    buffer.length >= 6 &&
    (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return '.gif';
  }

  return null;
}

async function normalizeUploadedImageExtension(file: Express.Multer.File, detectedExt: string): Promise<void> {
  const currentExt = path.extname(file.filename).toLowerCase();
  if (currentExt === detectedExt) {
    return;
  }

  const nextFilename = `${path.basename(file.filename, currentExt)}${detectedExt}`;
  const nextPath = path.join(path.dirname(file.path), nextFilename);
  if (fs.existsSync(nextPath)) {
    throw new Error('Image upload filename collision');
  }
  await fs.promises.rename(file.path, nextPath);
  file.filename = nextFilename;
  file.path = nextPath;
}

const productImageUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  productImageUpload.single('image')(req, res, (error) => {
    if (!error) {
      const file = req.file;
      if (!file) {
        next();
        return;
      }

      void (async () => {
        const detectedExt = await detectAllowedImageExtension(file.path);
        if (!detectedExt) {
          await fs.promises.unlink(file.path).catch(() => undefined);
          res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid image content', 400));
          return;
        }

        await normalizeUploadedImageExtension(file, detectedExt);
        next();
      })().catch((validationError) => {
        void fs.promises.unlink(file.path).catch(() => undefined);
        res
          .status(400)
          .json(
            errorResponse(
              'VALIDATION_ERROR',
              validationError instanceof Error ? validationError.message : 'Invalid image upload',
              400,
            ),
          );
      });
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json(errorResponse('VALIDATION_ERROR', 'Image file exceeds 5 MB', 413));
      return;
    }

    res.status(400).json(errorResponse('VALIDATION_ERROR', error.message || 'Invalid image upload', 400));
  });
};

export function createInventoryRoutes(
  controller: InventoryController,
  pickingController: InventoryPickingController
): Router {
  const router = Router();

  // Picking routes
  router.use('/', pickingController.getRouter());

  // Apply authentication to all routes
  router.use(authenticate);

  // Stock levels list endpoint (with alias for frontend compatibility)
  router.get('/stock-levels', wrapController(controller, 'getStockLevels'));
  router.get('/products/facets', wrapController(controller, 'getProductFacets'));


  router.get('/products', wrapController(controller, 'getStockLevels'));

  // Static routes MUST be registered before parameterized routes
  // to prevent Express from matching e.g. /alerts as /:productId

  router.post(
    '/check',
    validateBody(checkStockSchema),
    wrapController(controller, 'checkStockBatch'),
  );

  // Stock reservation endpoints
  router.post(
    '/reserve',
    validateBody(reserveStockSchema),
    wrapController(controller, 'reserveStock'),
  );

  router.delete('/reservations/:id', wrapController(controller, 'releaseReservation'));

  // Admin only endpoints
  router.post(
    '/adjust',
    requireRole(['admin']),
    validateBody(adjustStockSchema),
    wrapController(controller, 'adjustStock'),
  );

  // Alerts
  router.get('/alerts', wrapController(controller, 'getLowStockAlerts'));

  router.post('/alerts/:id/acknowledge', wrapController(controller, 'acknowledgeAlert'));

  // Sync endpoints (admin only)
  router.post(
    '/sync/smartbill',
    requireRole(['admin']),
    wrapController(controller, 'syncSmartBill'),
  );

  router.post(
    '/sync/suppliers',
    requireRole(['admin']),
    wrapController(controller, 'syncSuppliers'),
  );

  // Warehouses
  router.get('/warehouses', wrapController(controller, 'getWarehouses'));

  // Parameterized routes AFTER all static routes
  router.get('/:productId', wrapController(controller, 'getStock'));

  router.get(
    '/:productId/movements',
    validateQuery(getMovementsSchema),
    wrapController(controller, 'getMovementHistory'),
  );

  // Product Images (admin only)
  router.post(
    '/products/:productId/images',
    requireRole(['admin']),
    wrapController(controller, 'addProductImage'),
  );

  router.post(
    '/products/:productId/images/upload',
    requireRole(['admin']),
    productImageUploadMiddleware,
    wrapController(controller, 'uploadProductImage'),
  );

  router.post(
    '/products/:productId/images/search',
    requireRole(['admin']),
    wrapController(controller, 'searchProductImage'),
  );

  router.post(
    '/products/:productId/images/select',
    requireRole(['admin']),
    wrapController(controller, 'selectSearchedImage'),
  );

  router.delete(
    '/products/:productId/images/:imageId',
    requireRole(['admin']),
    wrapController(controller, 'deleteProductImage'),
  );

  router.post(
    '/products/images/bulk-import',
    requireRole(['admin']),
    wrapController(controller, 'bulkImportImages'),
  );

  router.post(
    '/products/images/auto-search',
    requireRole(['admin']),
    wrapController(controller, 'autoSearchProductImages'),
  );

  return router;
}
