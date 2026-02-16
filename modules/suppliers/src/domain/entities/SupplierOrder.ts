export enum SupplierOrderStatus {
  PENDING = 'pending',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface SupplierOrderItem {
  supplierSku: string;
  internalSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SupplierOrder {
  id: number;
  supplierId: number;
  orderId: number | null; // Reference to our internal order if exists
  items: SupplierOrderItem[];
  status: SupplierOrderStatus;
  whatsappMessageTemplate: string;
  sentAt: Date | null;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SupplierOrderEntity implements SupplierOrder {
  id!: number;
  supplierId!: number;
  orderId!: number | null;
  items!: SupplierOrderItem[];
  status!: SupplierOrderStatus;
  whatsappMessageTemplate!: string;
  sentAt!: Date | null;
  confirmedAt!: Date | null;
  deliveredAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: SupplierOrder) {
    Object.assign(this, data);
    this.items = data.items || [];
    this.status = data.status || SupplierOrderStatus.PENDING;
    this.sentAt = data.sentAt || null;
    this.confirmedAt = data.confirmedAt || null;
    this.deliveredAt = data.deliveredAt || null;
  }

  generateWhatsAppMessage(): string {
    const lines: string[] = [];

    lines.push('🛒 *NEW ORDER REQUEST*');
    lines.push('');
    lines.push(`*Order ID:* ${this.orderId || 'Not assigned'}`);
    lines.push(`*Date:* ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('*Items:*');
    lines.push('');

    this.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. *${item.productName}*`,
      );
      lines.push(`   • Supplier SKU: ${item.supplierSku}`);
      lines.push(`   • Qty: ${item.quantity}`);
      lines.push(`   • Unit Price: ${item.unitPrice}`);
      lines.push(`   • Total: ${item.totalPrice}`);
      lines.push('');
    });

    const totalAmount = this.getTotalAmount();
    const totalQuantity = this.getTotalQuantity();

    lines.push('*Summary:*');
    lines.push(`Total Items: ${totalQuantity}`);
    lines.push(`Total Amount: ${totalAmount}`);
    lines.push('');
    lines.push('Please confirm availability and delivery timeline.');

    return lines.join('\n');
  }

  getTotalQuantity(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalAmount(): number {
    return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  getItemCount(): number {
    return this.items.length;
  }

  canBeSent(): boolean {
    return (
      this.status === SupplierOrderStatus.PENDING &&
      this.items.length > 0 &&
      !this.sentAt
    );
  }

  markAsSent(timestamp: Date = new Date()): void {
    if (this.status !== SupplierOrderStatus.PENDING) {
      throw new Error('Can only send pending orders');
    }
    this.status = SupplierOrderStatus.SENT;
    this.sentAt = timestamp;
  }

  markAsConfirmed(timestamp: Date = new Date()): void {
    if (this.status !== SupplierOrderStatus.SENT) {
      throw new Error('Can only confirm sent orders');
    }
    this.status = SupplierOrderStatus.CONFIRMED;
    this.confirmedAt = timestamp;
  }

  markAsDelivered(timestamp: Date = new Date()): void {
    if (this.status !== SupplierOrderStatus.CONFIRMED) {
      throw new Error('Can only deliver confirmed orders');
    }
    this.status = SupplierOrderStatus.DELIVERED;
    this.deliveredAt = timestamp;
  }

  cancel(): void {
    if (
      this.status === SupplierOrderStatus.DELIVERED ||
      this.status === SupplierOrderStatus.CANCELLED
    ) {
      throw new Error('Cannot cancel delivered or already cancelled orders');
    }
    this.status = SupplierOrderStatus.CANCELLED;
  }

  getStatusLabel(): string {
    const labels: Record<SupplierOrderStatus, string> = {
      [SupplierOrderStatus.PENDING]: '⏳ Pending',
      [SupplierOrderStatus.SENT]: '📤 Sent',
      [SupplierOrderStatus.CONFIRMED]: '✅ Confirmed',
      [SupplierOrderStatus.DELIVERED]: '🚚 Delivered',
      [SupplierOrderStatus.CANCELLED]: '❌ Cancelled',
    };
    return labels[this.status];
  }
}
