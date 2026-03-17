export const PURCHASING_INVOICE_APPROVED_EVENT = 'purchasing.invoice.approved';

export interface PurchasingInvoiceApprovedEvent {
  invoiceId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  dueDate?: string;
  totalAmount: number;
  currency: string;
  approvedAt: string;
}

export interface PurchasingInvoiceEventPublisher {
  publishInvoiceApproved(event: PurchasingInvoiceApprovedEvent): Promise<void>;
}
