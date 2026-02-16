import { ProductPriceEntity } from '../../../../pricing-engine/src/infrastructure/entities/ProductPriceEntity';

export interface IProductRepository {
    findById(id: string): Promise<ProductPriceEntity | null>;
    findAll(criteria?: any): Promise<ProductPriceEntity[]>;
}
