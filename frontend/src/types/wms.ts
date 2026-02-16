export interface Shipment {
  id: string;
  orderIds: string[];
  status: 'pending' | 'packed' | 'shipped' | 'delivered';
  trackingNumber?: string;
  carrier?: string;
  items: ShipmentItem[];
  createdAt: string;
  deliveredAt?: string;
}

export interface ShipmentItem {
  productId: string;
  quantity: number;
  weight: number;
}
