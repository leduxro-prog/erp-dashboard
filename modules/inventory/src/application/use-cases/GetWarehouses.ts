/**
 * Get Warehouses Use Case
 * Retrieves list of all warehouses in the inventory system
 */

import { IInventoryRepository } from '../../domain/repositories';

interface WarehouseEntity {
  id: string;
  name: string;
  location?: string;
}

/**
 * Warehouse information DTO
 */
export interface WarehouseInfo {
  id: string;
  name: string;
  location?: string;
  isActive: boolean;
}

/**
 * GetWarehouses Use Case
 * Implements retrieval of all warehouses
 */
export class GetWarehouses {
  /**
   * Create instance of GetWarehouses use case
   * @param repository - Inventory repository for data access
   */
  constructor(private readonly repository: IInventoryRepository) { }

  /**
   * Execute get warehouses use case
   * Retrieves all warehouses available in the system
   *
   * @returns Promise resolving to array of warehouse information
   */
  async execute(): Promise<WarehouseInfo[]> {
    const warehouses = await this.repository.getWarehouses();

    return warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      location: undefined,
      isActive: true, // warehouse.is_active
    }));
  }
}
