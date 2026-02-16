import { SupplierProduct } from '../../domain/entities/SupplierProduct';
import { SkuMapping } from '../../domain/entities/SkuMapping';
import { SupplierOrderItem } from '../../domain/entities/SupplierOrder';

export interface PriceChangeAlert {
  supplierSku: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  changePercentage: number;
  currency: string;
}

export interface ScrapeResult {
  supplierId: number;
  supplierName: string;
  productsFound: number;
  productsUpdated: number;
  productsCreated: number;
  priceChanges: PriceChangeAlert[];
  significantPriceChanges: PriceChangeAlert[];
  errors: string[];
  duration: number; // in milliseconds
  startTime: Date;
  endTime: Date;
  success: boolean;
}

export interface SupplierOrderResult {
  orderId: number;
  supplierId: number;
  whatsappMessage: string;
  whatsappUrl: string;
  items: SupplierOrderItem[];
  itemCount: number;
  totalEstimate: number;
  currency: string;
}

export interface SkuMappingDTO {
  id: number;
  supplierId: number;
  supplierSku: string;
  internalProductId: number;
  internalSku: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierProductDTO {
  id: number;
  supplierId: number;
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
  lastScraped: Date;
  priceHistory: Array<{
    price: number;
    date: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierDTO {
  id: number;
  name: string;
  code: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  productCount: number;
  isActive: boolean;
  syncFrequency: number;
  lastSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetSupplierProductsOptions {
  search?: string;
  minStock?: number;
  maxPrice?: number;
  minPrice?: number;
  page?: number; // 1-indexed page number, defaults to 1
  limit?: number; // items per page, defaults to 50, max 200
  offset?: number; // legacy offset-based pagination (page-based is preferred)
}

export interface UnmappedProductsDTO {
  supplierId: number;
  totalUnmapped: number;
  mappedCount: number;
  coveragePercentage: number;
  products: SupplierProductDTO[];
}
