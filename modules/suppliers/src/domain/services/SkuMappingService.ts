import { SupplierProduct } from '../entities/SupplierProduct';
import { SkuMapping } from '../entities/SkuMapping';
import { ISupplierRepository } from '../repositories/ISupplierRepository';

export class SkuMappingService {
  constructor(private repository: ISupplierRepository) {}

  async mapSupplierSku(
    supplierId: number,
    supplierSku: string,
  ): Promise<number | null> {
    const mapping = await this.repository.getSkuMapping(
      supplierId,
      supplierSku,
    );

    if (!mapping || !mapping.isActive) {
      return null;
    }

    return mapping.internalProductId;
  }

  async findUnmappedProducts(
    supplierId: number,
  ): Promise<SupplierProduct[]> {
    const products = await this.repository.getSupplierProducts(supplierId);
    const mappings = await this.repository.getSkuMappings(supplierId);

    const mappedSkus = new Set(
      mappings.map((m) => m.supplierSku),
    );

    return products.filter((product) => !mappedSkus.has(product.supplierSku));
  }

  async getProductMapping(
    supplierId: number,
    supplierSku: string,
  ): Promise<SkuMapping | null> {
    return this.repository.getSkuMapping(supplierId, supplierSku);
  }

  async bulkGetMappings(
    supplierId: number,
    supplierSkus: string[],
  ): Promise<Map<string, SkuMapping>> {
    const mappings = await this.repository.getSkuMappings(supplierId);

    const result = new Map<string, SkuMapping>();
    for (const mapping of mappings) {
      if (supplierSkus.includes(mapping.supplierSku)) {
        result.set(mapping.supplierSku, mapping);
      }
    }

    return result;
  }

  async countMappedProducts(supplierId: number): Promise<number> {
    const mappings = await this.repository.getSkuMappings(supplierId);
    return mappings.filter((m) => m.isActive).length;
  }

  async countUnmappedProducts(supplierId: number): Promise<number> {
    const unmapped = await this.findUnmappedProducts(supplierId);
    return unmapped.length;
  }

  getMappingCoverage(
    totalProducts: number,
    mappedProducts: number,
  ): number {
    if (totalProducts === 0) return 0;
    return (mappedProducts / totalProducts) * 100;
  }
}
