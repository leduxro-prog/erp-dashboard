import {
  WooCommerceProductData,
  WooCommerceOrderData,
} from './IWooCommerceClient';

export interface IWooCommerceMapper {
  toWooCommerceProduct(product: any, mapping?: any): WooCommerceProductData;
  toWooCommerceStock(
    quantity: number
  ): Partial<WooCommerceProductData>;
  toWooCommercePrice(
    price: number,
    salePrice?: number,
    salePriceStartDate?: Date,
    salePriceEndDate?: Date
  ): Partial<WooCommerceProductData>;
  fromWooCommerceOrder(wooOrder: WooCommerceOrderData): any;
}
