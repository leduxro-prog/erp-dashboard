export interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacity: number;
  address?: string;
  active: boolean;
}

export interface StockLevel {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: string;
}

export enum StockMovementType {
  IN = 'in',
  OUT = 'out',
  ADJUSTMENT = 'adjustment',
  RETURN = 'return',
  TRANSFER = 'transfer',
  SCRAP = 'scrap',
}

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  warehouseId: string;
  type: 'low_stock' | 'overstock' | 'expired';
  severity: 'low' | 'medium' | 'high';
  message: string;
  acknowledged: boolean;
  createdAt: string;
}
