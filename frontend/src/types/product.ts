export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  parentId?: string;
  active: boolean;
}

export interface PriceInfo {
  currency: string;
  amount: number;
  discount?: number;
  tax?: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: PriceInfo;
  cost: number;
  stock: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: ProductCategory;
  image?: string;
  basePrice: PriceInfo;
  baseCost: number;
  variants?: ProductVariant[];
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDTO {
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  basePrice: PriceInfo;
  baseCost: number;
  barcode?: string;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
  id: string;
}
