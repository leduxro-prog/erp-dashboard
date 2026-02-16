import { DataSource } from 'typeorm';
import { ComponentCatalog } from '../../domain/entities/ComponentCatalog';
import { ICatalogRepository } from '../../domain/repositories/ICatalogRepository';

export class TypeOrmCatalogRepository implements ICatalogRepository {
  constructor(private dataSource: DataSource) {}

  async findByConfiguratorType(type: string): Promise<ComponentCatalog[]> {
    return [];
  }

  async findByComponentType(type: string): Promise<ComponentCatalog[]> {
    return [];
  }

  async findById(id: string): Promise<ComponentCatalog | undefined> {
    return undefined;
  }

  async findBySku(sku: string): Promise<ComponentCatalog | undefined> {
    return undefined;
  }

  async findAll(): Promise<ComponentCatalog[]> {
    return [];
  }

  async save(catalog: ComponentCatalog): Promise<ComponentCatalog> {
    return catalog;
  }

  async delete(id: string): Promise<boolean> {
    return false;
  }
}
