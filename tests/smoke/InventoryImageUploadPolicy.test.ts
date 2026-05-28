import { describe, expect, it } from '@jest/globals';
import express, { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

import { InventoryController } from '../../modules/inventory/src/api/controllers/InventoryController';
import { createInventoryRoutes } from '../../modules/inventory/src/api/routes/inventory.routes';

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (_req: Request, _res: Response, next: () => void) => next(),
  requireRole: () => (_req: Request, _res: Response, next: () => void) => next(),
}));

function buildUploadApp() {
  const app = express();
  const controller = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'uploadProductImage') {
          return async (_req: Request, res: Response) => {
            res.status(201).json({ success: true });
          };
        }

        return async (_req: Request, res: Response) => res.status(200).json({ ok: String(prop) });
      },
    },
  );

  app.use(
    '/api/v1/inventory',
    createInventoryRoutes(controller as never, { getRouter: () => express.Router() } as never),
  );
  return app;
}

describe('Inventory image upload policy', () => {
  it('rejects SVG uploads with a validation response', async () => {
    const response = await request(buildUploadApp())
      .post('/api/v1/inventory/products/123/images/upload')
      .attach('image', Buffer.from('<svg><script>alert(1)</script></svg>'), {
        filename: 'xss.svg',
        contentType: 'image/svg+xml',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects SVG content even when the client spoofs an allowed MIME type', async () => {
    const response = await request(buildUploadApp())
      .post('/api/v1/inventory/products/123/images/upload')
      .attach('image', Buffer.from('<svg><script>alert(1)</script></svg>'), {
        filename: 'spoofed.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects image uploads over 5 MB with 413', async () => {
    const response = await request(buildUploadApp())
      .post('/api/v1/inventory/products/123/images/upload')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('removes the uploaded file when product validation fails after multer writes it', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-upload-'));
    const uploadedPath = path.join(tempDir, 'orphan.jpg');
    fs.writeFileSync(uploadedPath, 'orphan image');

    const controller = new InventoryController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { transaction: async (handler: (manager: { query: () => Promise<unknown[]> }) => Promise<unknown>) => handler({ query: async () => [] }) } as never,
    );

    const req = {
      params: { productId: '404' },
      body: {},
      file: { path: uploadedPath, filename: 'orphan.jpg', size: 12 },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await controller.uploadProductImage(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(fs.existsSync(uploadedPath)).toBe(false);
  });

  it('keeps the uploaded file when DB changes commit and cache invalidation fails', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-upload-'));
    const uploadedPath = path.join(tempDir, 'committed.jpg');
    fs.writeFileSync(uploadedPath, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(4096)]));

    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 123, name: 'Committed Product' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([
          { id: 456, image_url: '/uploads/products/committed.jpg', alt_text: 'Committed Product', is_primary: true },
        ])
        .mockResolvedValueOnce(undefined),
    };
    const dataSource = {
      transaction: jest.fn(async (handler: (transactionalManager: typeof manager) => Promise<unknown>) =>
        handler(manager),
      ),
    };
    const cache = {
      invalidateAll: jest.fn().mockRejectedValue(new Error('cache unavailable')),
    };
    const controller = new InventoryController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      cache as never,
    );

    const req = {
      params: { productId: '123' },
      body: { is_primary: 'true' },
      file: { path: uploadedPath, filename: 'committed.jpg', size: 4 },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await controller.uploadProductImage(req, res);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(fs.existsSync(uploadedPath)).toBe(true);
  });

  it('rejects legacy product image URLs that serve SVG despite a safe extension', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/svg+xml' },
    }) as unknown as typeof fetch;
    const controller = new InventoryController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { query: jest.fn(), transaction: jest.fn() } as never,
    );
    const req = {
      params: { productId: '123' },
      body: { imageUrl: 'https://example.com/payload.jpg' },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    try {
      await controller.addProductImage(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects AVIF URLs because upload and download paths do not support AVIF bytes', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/avif' },
    }) as unknown as typeof fetch;
    const controller = new InventoryController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { query: jest.fn(), transaction: jest.fn() } as never,
    );
    const req = {
      params: { productId: '123' },
      body: { imageUrl: 'https://example.com/image.avif' },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    try {
      await controller.addProductImage(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects searched local image paths with unsafe final extensions', async () => {
    const controller = new InventoryController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { transaction: jest.fn() } as never,
    );
    const req = {
      params: { productId: '123' },
      body: { imageUrl: '/uploads/products/fake.jpg.svg' },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await controller.selectSearchedImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('persists searched images transactionally and keeps committed downloads when cache invalidation fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
    }) as unknown as typeof fetch;

    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([
          { id: 789, image_url: '/uploads/products/selected.jpg', alt_text: 'Selected Product', is_primary: true },
        ])
        .mockResolvedValueOnce(undefined),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ id: 123, sku: 'SKU-1', name: 'Selected Product' }]),
      transaction: jest.fn(async (handler: (transactionalManager: typeof manager) => Promise<unknown>) =>
        handler(manager),
      ),
    };
    const cache = {
      invalidateAll: jest.fn().mockRejectedValue(new Error('cache unavailable')),
    };
    const controller = new InventoryController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
      cache as never,
    );
    (controller as any).imageSearchService = {
      downloadExternalImage: jest.fn().mockResolvedValue('/uploads/products/selected.jpg'),
    };
    const req = {
      params: { productId: '123' },
      body: { imageUrl: 'https://example.com/selected.jpg' },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    try {
      await controller.selectSearchedImage(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
