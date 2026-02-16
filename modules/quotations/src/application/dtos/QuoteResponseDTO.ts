import { QuoteStatus, QuoteItem, BillingAddress, ShippingAddress } from '../../domain/entities/Quote';

export interface QuoteResponseDTO {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: QuoteStatus;
  items: QuoteItem[];
  billingAddress: BillingAddress;
  shippingAddress: ShippingAddress;
  subtotal: number;
  discountAmount: number;
  discountPercentage: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  currency: string;
  paymentTerms: string;
  deliveryEstimate: string;
  validityDays: number;
  validUntil: Date;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
