export interface SyncResult {
  success: boolean;
  productId: string;
  wooCommerceId?: number;
  syncType: string;
  message: string;
  duration: number; // milliseconds
  error?: string;
  timestamp: Date;
}

export interface BatchSyncResult {
  batchId: string;
  totalProducts: number;
  synced: number;
  failed: number;
  skipped: number;
  duration: number; // milliseconds
  startedAt: Date;
  completedAt: Date;
  failedItems?: Array<{
    productId: string;
    reason: string;
  }>;
}

export interface PulledOrder {
  id: number;
  orderNumber: string;
  customerId: number;
  customerEmail: string;
  customerName: string;
  status: string;
  total: string;
  currency: string;
  paymentMethod: string;
  shippingTotal: string;
  taxTotal: string;
  subtotal: string;
  items: PulledOrderItem[];
  shippingAddress: ShippingAddress;
  billingAddress: BillingAddress;
  datePaid?: Date;
  dateCreated: Date;
  dateModified: Date;
}

export interface PulledOrderItem {
  id: number;
  productId: number;
  variationId: number;
  quantity: number;
  taxClass: string;
  subtotal: string;
  subtotalTax: string;
  total: string;
  totalTax: string;
  sku: string;
  price: string;
  name: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface BillingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  dateCreated: Date;
  dateModified: Date;
  type: string;
  status: string;
  featured: boolean;
  catalogVisibility: string;
  description: string;
  shortDescription: string;
  sku: string;
  price: string;
  regularPrice: string;
  salePrice?: string;
  dateOnSaleFrom?: Date;
  dateOnSaleTo?: Date;
  onSale: boolean;
  purchasable: boolean;
  totalSales: number;
  virtual: boolean;
  downloadable: boolean;
  downloadLimit: number;
  downloadExpiration: number;
  externalUrl?: string;
  buttonText?: string;
  taxStatus: string;
  taxClass: string;
  manageStock: boolean;
  stockQuantity?: number;
  inStock: boolean;
  backordersAllowed: boolean;
  backordered: boolean;
  lowStockAmount?: number;
  soldIndividually: boolean;
  weight?: string;
  dimensions?: {
    length: string;
    width: string;
    height: string;
  };
  shippingRequired: boolean;
  shippingTaxable: boolean;
  shippingClass: string;
  shippingClassId?: number;
  reviewsAllowed: boolean;
  averageRating: string;
  ratingCount: number;
  relatedIds: number[];
  upsellIds: number[];
  crossSellIds: number[];
  parentId: number;
  purchaseNote: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images: Array<{
    id: number;
    dateCreated: Date;
    dateModified: Date;
    src: string;
    name: string;
    alt: string;
  }>;
  attributes: Array<{
    id: number;
    name: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }>;
  defaultAttributes: Array<{
    id?: number;
    name: string;
    option: string;
  }>;
  variations: number[];
  groupedProducts: number[];
  menuOrder: number;
  metaData: Array<{
    id: number;
    key: string;
    value: string | object;
  }>;
}

export interface CreateProductPayload {
  name: string;
  description: string;
  shortDescription?: string;
  sku: string;
  regularPrice: string;
  salePrice?: string;
  images: Array<{
    src: string;
    alt?: string;
    name?: string;
  }>;
  categories: Array<{
    id: number;
  }>;
  attributes?: Array<{
    id?: number;
    name: string;
    options: string[];
  }>;
  manageStock: boolean;
  stockQuantity?: number;
  status?: string;
}

export interface UpdateProductPayload {
  id: number;
  name?: string;
  description?: string;
  shortDescription?: string;
  regularPrice?: string;
  salePrice?: string;
  images?: Array<{
    src: string;
    alt?: string;
    name?: string;
  }>;
  categories?: Array<{
    id: number;
  }>;
  stockQuantity?: number;
  status?: string;
}

export interface SyncStats {
  totalPendingItems: number;
  totalFailedItems: number;
  totalMappings: number;
  lastSyncTime?: Date;
  totalItemsSyncedToday: number;
  failureRate: number; // percentage
}
