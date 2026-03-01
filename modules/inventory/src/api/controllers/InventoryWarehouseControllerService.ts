import { Request, Response } from 'express';
import { DataSource } from 'typeorm';

import { errorResponse, successResponse } from '@shared/utils/response';

import { GetWarehouses } from '../../application/use-cases/GetWarehouses';

interface InventoryWarehouseLogger {
  error: (...args: any[]) => void;
}

interface InventoryWarehouseControllerDependencies {
  dataSource?: DataSource;
  getWarehousesUseCase: GetWarehouses;
  logger: InventoryWarehouseLogger;
}

export class InventoryWarehouseControllerService {
  constructor(private readonly deps: InventoryWarehouseControllerDependencies) {}

  async getWarehouses(_req: Request, res: Response): Promise<void> {
    try {
      if (this.deps.dataSource) {
        const result = await this.deps.dataSource.query(
          `SELECT id::text AS id, name, address, is_active AS "isActive"
           FROM warehouses
           WHERE is_active = true
           ORDER BY name ASC`,
        );

        res.json(successResponse(result));
        return;
      }

      const fallback = await this.deps.getWarehousesUseCase.execute();
      res.json(successResponse(fallback));
    } catch (error) {
      this.deps.logger.error('Error getting warehouses:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to get warehouses', 500));
    }
  }

  async createWarehouse(req: Request, res: Response): Promise<void> {
    try {
      if (!this.deps.dataSource) {
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

      const inserted = await this.deps.dataSource.query(
        `INSERT INTO warehouses (name, code, address, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id::text AS id, name, address, is_active AS "isActive"`,
        [name.trim(), code, (address || '').trim()],
      );

      res.status(201).json(successResponse(inserted[0]));
    } catch (error) {
      this.deps.logger.error('Error creating warehouse:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create warehouse', 500));
    }
  }
}
