import { ISupplierRepository, SkuMapping, SkuMappingEntity } from '../../domain';
import {
  SkuMappingError,
  SkuMappingAlreadyExistsError,
  InvalidSkuMappingError,
  SupplierNotFoundError,
} from '../errors/supplier.errors';
import { SkuMappingDTO, UnmappedProductsDTO, SupplierProductDTO } from '../dtos/supplier.dtos';

export class MapSku {
  constructor(private repository: ISupplierRepository) {}

  async create(
    supplierId: number,
    supplierSku: string,
    internalProductId: number,
    internalSku: string,
  ): Promise<SkuMapping> {
    // Validate inputs
    if (!supplierId || !supplierSku || !internalProductId || !internalSku) {
      throw new InvalidSkuMappingError(
        'All mapping fields are required',
      );
    }

    if (supplierSku.trim().length === 0 || internalSku.trim().length === 0) {
      throw new InvalidSkuMappingError(
        'SKU values cannot be empty',
      );
    }

    // Check supplier exists
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    // Check if mapping already exists
    const existing = await this.repository.getSkuMapping(
      supplierId,
      supplierSku,
    );

    if (existing) {
      throw new SkuMappingAlreadyExistsError(supplierId, supplierSku);
    }

    // Create new mapping
    const mapping = new SkuMappingEntity({
      id: 0, // Will be assigned by repository
      supplierId,
      supplierSku: supplierSku.trim(),
      internalProductId,
      internalSku: internalSku.trim(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!mapping.isValid()) {
      throw new SkuMappingError('Invalid SKU mapping data');
    }

    return this.repository.createSkuMapping(mapping);
  }

  async getMapping(
    supplierId: number,
    supplierSku: string,
  ): Promise<SkuMappingDTO | null> {
    const mapping = await this.repository.getSkuMapping(
      supplierId,
      supplierSku,
    );

    if (!mapping) return null;

    return this.mapToDTO(mapping);
  }

  async listMappings(supplierId: number): Promise<SkuMappingDTO[]> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    const mappings = await this.repository.getSkuMappings(supplierId);
    return mappings.map((m) => this.mapToDTO(m));
  }

  async getUnmapped(supplierId: number): Promise<UnmappedProductsDTO> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    // Get all products and mappings
    const products = await this.repository.getSupplierProducts(supplierId);
    const mappings = await this.repository.getSkuMappings(supplierId);

    const mappedSkus = new Set(
      mappings.filter((m) => m.isActive).map((m) => m.supplierSku),
    );

    const unmappedProducts = products.filter(
      (p) => !mappedSkus.has(p.supplierSku),
    );

    const mappedCount = mappings.filter((m) => m.isActive).length;
    const coveragePercentage = products.length > 0
      ? (mappedCount / products.length) * 100
      : 0;

    return {
      supplierId,
      totalUnmapped: unmappedProducts.length,
      mappedCount,
      coveragePercentage,
      products: unmappedProducts.map((p) => this.productToDTO(p)),
    };
  }

  async deleteMapping(mappingId: number): Promise<void> {
    await this.repository.deleteSkuMapping(mappingId);
  }

  async updateActive(
    supplierId: number,
    supplierSku: string,
    isActive: boolean,
  ): Promise<SkuMapping> {
    const mapping = await this.repository.getSkuMapping(
      supplierId,
      supplierSku,
    );

    if (!mapping) {
      throw new SkuMappingError(
        `Mapping not found for supplier ${supplierId} and SKU ${supplierSku}`,
      );
    }

    mapping.isActive = isActive;
    mapping.updatedAt = new Date();

    await this.repository.updateSkuMapping(mapping);

    return mapping;
  }

  private mapToDTO(mapping: SkuMapping): SkuMappingDTO {
    return {
      id: mapping.id,
      supplierId: mapping.supplierId,
      supplierSku: mapping.supplierSku,
      internalProductId: mapping.internalProductId,
      internalSku: mapping.internalSku,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt,
    };
  }

  private productToDTO(product: any): SupplierProductDTO {
    return {
      id: product.id,
      supplierId: product.supplierId,
      supplierSku: product.supplierSku,
      name: product.name,
      price: product.price,
      currency: product.currency,
      stockQuantity: product.stockQuantity,
      lastScraped: product.lastScraped,
      priceHistory: product.priceHistory || [],
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
