import { BillingAddress, ShippingAddress } from '../../domain/entities/Quote';

export interface CreateQuoteItemDTO {
  productId: string;
  sku: string;
  productName: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateQuoteDTO {
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: CreateQuoteItemDTO[];
  billingAddress: BillingAddress;
  shippingAddress: ShippingAddress;
  paymentTerms: string;
  deliveryEstimate: string;
  discountPercentage?: number;
  validityDays?: number;
  notes?: string;
  createdBy: string;
}
