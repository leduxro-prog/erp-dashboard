export interface WooCommerceProductData {
  id?: number;
  name: string;
  sku: string;
  regular_price: string;
  stock_quantity: number;
  description?: string;
  short_description?: string;
  categories?: { id: number }[];
  images?: { src: string; alt?: string }[];
  attributes?: { name: string; options: string[] }[];
  manage_stock?: boolean;
  status?: string;
}

export interface WooCommerceOrderData {
  id: number;
  status: string;
  date_created: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    postcode: string;
    country: string;
  };
  line_items: {
    product_id: number;
    sku: string;
    name: string;
    quantity: number;
    price: string;
  }[];
  total: string;
  currency: string;
}

export interface IWooCommerceClient {
  getProduct(wooId: number): Promise<WooCommerceProductData | null>;
  createProduct(data: WooCommerceProductData): Promise<{ id: number }>;
  updateProduct(
    wooId: number,
    data: Partial<WooCommerceProductData>
  ): Promise<void>;
  batchUpdateProducts(
    data: Partial<WooCommerceProductData>[]
  ): Promise<{ updated: number; failed: number }>;
  getOrders(params: {
    status?: string;
    after?: string;
    per_page?: number;
  }): Promise<WooCommerceOrderData[]>;
  getCategories(): Promise<{ id: number; name: string; slug: string }[]>;
  createCategory(data: {
    name: string;
    slug?: string;
    parent?: number;
  }): Promise<{ id: number }>;
  updateCategory?(
    categoryId: number,
    data: { name?: string; slug?: string; description?: string }
  ): Promise<void>;
}
