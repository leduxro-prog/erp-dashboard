import { ISupplierRepository } from '../../domain';
import { SupplierNotFoundError } from '../errors/supplier.errors';
import { GetSupplierProductsOptions, SupplierProductDTO } from '../dtos/supplier.dtos';

export class GetSupplierProducts {
  constructor(private repository: ISupplierRepository) {}

  async execute(
    supplierId: number,
    options?: GetSupplierProductsOptions,
  ): Promise<SupplierProductDTO[]> {
    // Validate supplier exists
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    // Get all products
    let products = await this.repository.getSupplierProducts(supplierId);

    // Apply filters
    if (options) {
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.supplierSku.toLowerCase().includes(searchLower),
        );
      }

      if (options.minStock !== undefined) {
        products = products.filter(
          (p) => p.stockQuantity >= options.minStock!,
        );
      }

      if (options.minPrice !== undefined) {
        products = products.filter((p) => p.price >= options.minPrice!);
      }

      if (options.maxPrice !== undefined) {
        products = products.filter((p) => p.price <= options.maxPrice!);
      }
    }

    // Convert to DTOs
    let dtos = products.map((p) => this.toDTO(p));

    // Apply pagination with limits
    const page = options?.page !== undefined ? Math.max(1, options.page) : 1;
    const limit = Math.min(options?.limit || 50, 200); // Max 200 items per page
    const offset = (page - 1) * limit;
    dtos = dtos.slice(offset, offset + limit);

    return dtos;
  }

  async getByStock(
    supplierId: number,
    inStock: boolean = true,
  ): Promise<SupplierProductDTO[]> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    let products = await this.repository.getSupplierProducts(supplierId);

    if (inStock) {
      products = products.filter((p) => p.stockQuantity > 0);
    } else {
      products = products.filter((p) => p.stockQuantity === 0);
    }

    return products.map((p) => this.toDTO(p));
  }

  async getLowStock(
    supplierId: number,
    threshold: number = 10,
  ): Promise<SupplierProductDTO[]> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    const products = await this.repository.getSupplierProducts(supplierId);

    const lowStockProducts = products.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= threshold,
    );

    return lowStockProducts.map((p) => this.toDTO(p));
  }

  async getPriceRange(
    supplierId: number,
  ): Promise<{ minPrice: number; maxPrice: number }> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    const products = await this.repository.getSupplierProducts(supplierId);

    if (products.length === 0) {
      return { minPrice: 0, maxPrice: 0 };
    }

    const prices = products.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return { minPrice, maxPrice };
  }

  async getStatistics(supplierId: number): Promise<{
    totalProducts: number;
    inStock: number;
    outOfStock: number;
    totalValue: number;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    currency: string;
  }> {
    const supplier = await this.repository.getSupplier(supplierId);
    if (!supplier) {
      throw new SupplierNotFoundError(supplierId);
    }

    const products = await this.repository.getSupplierProducts(supplierId);

    if (products.length === 0) {
      return {
        totalProducts: 0,
        inStock: 0,
        outOfStock: 0,
        totalValue: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        currency: 'USD',
      };
    }

    const inStock = products.filter((p) => p.stockQuantity > 0).length;
    const outOfStock = products.filter((p) => p.stockQuantity === 0).length;

    const totalValue = products.reduce(
      (sum, p) => sum + p.price * p.stockQuantity,
      0,
    );

    const averagePrice =
      products.reduce((sum, p) => sum + p.price, 0) / products.length;

    const prices = products.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return {
      totalProducts: products.length,
      inStock,
      outOfStock,
      totalValue,
      averagePrice,
      minPrice,
      maxPrice,
      currency: products[0].currency,
    };
  }

  private toDTO(product: any): SupplierProductDTO {
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
