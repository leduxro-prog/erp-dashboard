import { CreateQuoteDTO, CreateQuoteItemDTO } from '../../application/dtos/CreateQuoteDTO';

export class QuotationValidators {
  static validateCreateQuoteDTO(dto: CreateQuoteDTO): void {
    if (!dto.customerId || typeof dto.customerId !== 'string') {
      throw new Error('customerId is required and must be a string');
    }

    if (!dto.customerName || typeof dto.customerName !== 'string') {
      throw new Error('customerName is required and must be a string');
    }

    if (!dto.customerEmail || !this.isValidEmail(dto.customerEmail)) {
      throw new Error('customerEmail is required and must be a valid email');
    }

    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new Error('items array is required and must contain at least one item');
    }

    dto.items.forEach((item, index) => {
      this.validateQuoteItem(item, index);
    });

    if (!dto.billingAddress) {
      throw new Error('billingAddress is required');
    }

    if (!dto.shippingAddress) {
      throw new Error('shippingAddress is required');
    }

    if (!dto.paymentTerms || typeof dto.paymentTerms !== 'string') {
      throw new Error('paymentTerms is required and must be a string');
    }

    if (!dto.deliveryEstimate || typeof dto.deliveryEstimate !== 'string') {
      throw new Error('deliveryEstimate is required and must be a string');
    }

    if (dto.discountPercentage !== undefined) {
      if (typeof dto.discountPercentage !== 'number' || dto.discountPercentage < 0 || dto.discountPercentage > 100) {
        throw new Error('discountPercentage must be a number between 0 and 100');
      }
    }

    if (dto.validityDays !== undefined) {
      if (typeof dto.validityDays !== 'number' || dto.validityDays < 1 || dto.validityDays > 365) {
        throw new Error('validityDays must be a number between 1 and 365');
      }
    }
  }

  static validateQuoteItem(item: CreateQuoteItemDTO, index: number): void {
    if (!item.productId || typeof item.productId !== 'string') {
      throw new Error(`items[${index}].productId is required and must be a string`);
    }

    if (!item.sku || typeof item.sku !== 'string') {
      throw new Error(`items[${index}].sku is required and must be a string`);
    }

    if (!item.productName || typeof item.productName !== 'string') {
      throw new Error(`items[${index}].productName is required and must be a string`);
    }

    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new Error(`items[${index}].quantity must be a positive number`);
    }

    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new Error(`items[${index}].unitPrice must be a non-negative number`);
    }
  }

  static validateQuoteId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Quote ID is required and must be a string');
    }
  }

  static validateRejectReason(reason: string): void {
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('Rejection reason is required and must be a non-empty string');
    }
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
