import { B2BCustomer } from '../entities/B2BCustomer';
import { SavedCart, CartItemData } from '../entities/SavedCart';
import { ProductPriceEntity } from '../../../../pricing-engine/src/infrastructure/entities/ProductPriceEntity';
import { ISavedCartRepository } from '../repositories/ISavedCartRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { NotFoundError } from '@shared/errors/BaseError';

export class B2BCartService {
    constructor(
        private readonly cartRepository: ISavedCartRepository,
        private readonly productRepository: IProductRepository
    ) { }

    async createCart(customerId: string, name: string): Promise<SavedCart> {
        const cart = new SavedCart(
            `cart_${Date.now()}`, // Generate ID
            customerId,
            name,
            []
        );
        return this.cartRepository.save(cart);
    }

    async addItem(cartId: string, productId: string, quantity: number): Promise<SavedCart> {
        const cart = await this.cartRepository.findById(cartId);
        if (!cart) throw new NotFoundError('Cart', cartId);

        const product = await this.productRepository.findById(productId);
        if (!product) throw new NotFoundError('Product', productId);

        // Mock customer for price calculation (In real app, fetch customer)
        // const customer = await this.customerRepository.findById(cart.customerId);

        // Mock price calculation
        const price = Number(product.base_price); // Simplify for now

        cart.addItem(
            product.id.toString(),
            product.name,
            product.sku,
            quantity,
            price
        );

        return this.cartRepository.save(cart);
    }

    // Placeholder for Tier Pricing Logic
    calculateTierPrice(product: ProductPriceEntity, _customer: B2BCustomer): number {
        // Implement tier-based logic:
        // switch(customer.tier) {
        //   case 'GOLD': return product.price * 0.8;
        //   case 'SILVER': return product.price * 0.9;
        //   default: return product.price;
        // }
        return Number(product.base_price);
    }
}
