export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export interface Customer {
  id: string;
  code: string;
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  taxId?: string;
  segments: string[];
  loyaltyPoints: number;
  totalPurchases: number;
  lastPurchaseDate?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  criteria: {
    minPurchases?: number;
    maxPurchases?: number;
    minSpent?: number;
    maxSpent?: number;
    tags?: string[];
  };
  memberCount: number;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  description?: string;
  pointsPerDollar: number;
  tier: Array<{
    name: string;
    minPoints: number;
    multiplier: number;
  }>;
  active: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: 'earn' | 'redeem';
  points: number;
  reference?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minAmount?: number;
  maxRedemptions?: number;
  currentRedemptions: number;
  expiresAt: string;
  active: boolean;
  createdAt: string;
}
