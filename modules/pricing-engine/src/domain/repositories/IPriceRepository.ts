import { Price } from '../entities/Price';

export interface IPriceRepository {
  getPriceByProductId(productId: number): Promise<Price>;
  getActivePromotionByProductId(productId: number): Promise<Price | null>;
  getVolumeDiscountRules(): Promise<any[]>;
  savePrice(price: Price): Promise<void>;
  savePromotion(
    productId: number,
    promotionalPrice: number,
    validFrom: Date,
    validUntil: Date,
    reason?: string,
  ): Promise<void>;
  deactivatePromotion(promotionId: number): Promise<void>;
}
