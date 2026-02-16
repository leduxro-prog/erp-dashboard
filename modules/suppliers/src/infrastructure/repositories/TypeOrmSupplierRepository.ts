import { Repository } from 'typeorm';
import {
  ISupplierRepository,
  BulkUpsertResult,
  Supplier,
  SupplierProduct,
  SkuMapping,
  SupplierOrder,
} from '../../domain';

export class TypeOrmSupplierRepository implements ISupplierRepository {
  constructor(
    private supplierRepository: Repository<any>,
    private supplierProductRepository: Repository<any>,
    private skuMappingRepository: Repository<any>,
    private supplierOrderRepository: Repository<any>,
  ) {}

  // Supplier operations
  async getSupplier(id: number): Promise<Supplier | null> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
    });
    return supplier || null;
  }

  async getSupplierByCode(code: string): Promise<Supplier | null> {
    const supplier = await this.supplierRepository.findOne({
      where: { code },
    });
    return supplier || null;
  }

  async listSuppliers(activeOnly: boolean = false): Promise<Supplier[]> {
    const query = this.supplierRepository.find();

    if (activeOnly) {
      const suppliers = await this.supplierRepository.find({
        where: { isActive: true },
      });
      return suppliers;
    }

    return query;
  }

  // Supplier Product operations
  async getSupplierProducts(
    supplierId: number,
    limit?: number,
    offset?: number,
  ): Promise<SupplierProduct[]> {
    const query = this.supplierProductRepository.find({
      where: { supplierId },
      relations: ['supplier', 'product'],
      order: { supplierSku: 'ASC' },
    });

    if (limit !== undefined && offset !== undefined) {
      return this.supplierProductRepository.find({
        where: { supplierId },
        relations: ['supplier', 'product'],
        order: { supplierSku: 'ASC' },
        take: limit,
        skip: offset,
      });
    }

    return query;
  }

  async getSupplierProduct(
    supplierId: number,
    supplierSku: string,
  ): Promise<SupplierProduct | null> {
    const product = await this.supplierProductRepository.findOne({
      where: { supplierId, supplierSku },
      relations: ['supplier', 'product'],
    });
    return product || null;
  }

  async upsertSupplierProduct(product: SupplierProduct): Promise<void> {
    await this.supplierProductRepository.save(product);
  }

  async bulkUpsertProducts(
    products: SupplierProduct[],
  ): Promise<BulkUpsertResult> {
    if (products.length === 0) {
      return { created: 0, updated: 0 };
    }

    const result = await this.supplierProductRepository
      .createQueryBuilder()
      .insert()
      .into('supplier_products')
      .values(
        products.map((p) => ({
          supplier_id: p.supplierId,
          product_id: p.productId,
          supplier_sku: p.supplierSku,
          supplier_price: p.price,
          min_order_quantity: p.minOrderQuantity || 1,
          lead_time_days: p.leadTimeDays,
          is_active: p.isActive !== undefined ? p.isActive : true,
        })),
      )
      .orUpdate(
        ['supplier_price', 'min_order_quantity', 'lead_time_days', 'is_active', 'updated_at'],
        ['supplier_id', 'product_id']
      )
      .execute();

    return { created: result.identifiers.length, updated: result.raw.length };
  }

  // SKU Mapping operations
  async getSkuMapping(
    supplierId: number,
    supplierSku: string,
  ): Promise<SkuMapping | null> {
    const mapping = await this.skuMappingRepository.findOne({
      where: { supplierId, supplierSku },
    });
    return mapping || null;
  }

  async getSkuMappings(supplierId: number): Promise<SkuMapping[]> {
    return this.skuMappingRepository.find({
      where: { supplierId },
      relations: ['supplier', 'product'],
      order: { supplierSku: 'ASC' },
    });
  }

  async createSkuMapping(mapping: SkuMapping): Promise<SkuMapping> {
    return this.skuMappingRepository.save(mapping);
  }

  async updateSkuMapping(mapping: SkuMapping): Promise<void> {
    await this.skuMappingRepository.save(mapping);
  }

  async deleteSkuMapping(id: number): Promise<void> {
    await this.skuMappingRepository.delete({ id });
  }

  // Supplier Order operations
  async createSupplierOrder(order: SupplierOrder): Promise<SupplierOrder> {
    return this.supplierOrderRepository.save(order);
  }

  async getSupplierOrder(id: number): Promise<SupplierOrder | null> {
    const order = await this.supplierOrderRepository.findOne({
      where: { id },
      relations: ['supplier', 'items', 'items.product'],
    });
    return order || null;
  }

  async getSupplierOrders(
    supplierId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<SupplierOrder[]> {
    return this.supplierOrderRepository.find({
      where: { supplierId },
      relations: ['supplier', 'items', 'items.product'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async updateSupplierOrder(order: SupplierOrder): Promise<void> {
    await this.supplierOrderRepository.save(order);
  }

  // Sync tracking
  async updateLastSync(supplierId: number, syncTime: Date): Promise<void> {
    await this.supplierRepository.update(
      { id: supplierId },
      { lastSync: syncTime },
    );
  }

  async getLastSync(supplierId: number): Promise<Date | null> {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId },
      select: ['lastSync'],
    });

    return supplier?.lastSync || null;
  }
}
