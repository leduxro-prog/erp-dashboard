export interface SupplierCredentials {
  username: string;
  password: string;
  apiKey?: string;
  customHeader?: Record<string, string>;
}

export enum SupplierCode {
  ACA_LIGHTING = 'aca-lighting',
  MASTERLED = 'masterled',
  ARELUX = 'arelux',
  BRAYTRON = 'braytron',
  FSL = 'fsl',
}

export interface Supplier {
  id: number;
  name: string;
  code: SupplierCode;
  website: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  productCount: number;
  isActive: boolean;
  credentials: SupplierCredentials;
  syncFrequency: number; // in hours
  lastSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SupplierEntity implements Supplier {
  id!: number;
  name!: string;
  code!: SupplierCode;
  website!: string;
  contactEmail!: string;
  contactPhone!: string;
  whatsappNumber!: string;
  productCount!: number;
  isActive!: boolean;
  credentials!: SupplierCredentials;
  syncFrequency!: number;
  lastSync!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Supplier) {
    Object.assign(this, data);
  }

  isReadyForSync(): boolean {
    if (!this.isActive) return false;
    if (!this.lastSync) return true;

    const hoursSinceLastSync =
      (new Date().getTime() - this.lastSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastSync >= this.syncFrequency;
  }

  canSyncAtTime(hour: number): boolean {
    // Sync only between 06:00-22:00
    return hour >= 6 && hour < 22;
  }

  getDisplayName(): string {
    return `${this.name} (${this.code})`;
  }
}

// Known suppliers constants
export const KNOWN_SUPPLIERS: Record<SupplierCode, Partial<Supplier>> = {
  [SupplierCode.ACA_LIGHTING]: {
    name: 'Aca Lighting',
    code: SupplierCode.ACA_LIGHTING,
    website: 'https://aca-lighting.com',
    contactEmail: 'contact@aca-lighting.com',
    contactPhone: '+1-800-ACALIGHTING',
    whatsappNumber: '+201001234567',
    productCount: 5000,
    syncFrequency: 4,
  },
  [SupplierCode.MASTERLED]: {
    name: 'Masterled',
    code: SupplierCode.MASTERLED,
    website: 'https://masterled.com',
    contactEmail: 'sales@masterled.com',
    contactPhone: '+1-800-MASTERLED',
    whatsappNumber: '+201234567890',
    productCount: 1000,
    syncFrequency: 4,
  },
  [SupplierCode.ARELUX]: {
    name: 'Arelux',
    code: SupplierCode.ARELUX,
    website: 'https://arelux.com',
    contactEmail: 'info@arelux.com',
    contactPhone: '+1-800-ARELUX',
    whatsappNumber: '+201567890123',
    productCount: 1000,
    syncFrequency: 4,
  },
  [SupplierCode.BRAYTRON]: {
    name: 'Braytron',
    code: SupplierCode.BRAYTRON,
    website: 'https://braytron.com',
    contactEmail: 'support@braytron.com',
    contactPhone: '+1-800-BRAYTRON',
    whatsappNumber: '+201890123456',
    productCount: 500,
    syncFrequency: 4,
  },
  [SupplierCode.FSL]: {
    name: 'FSL',
    code: SupplierCode.FSL,
    website: 'https://fsl.com',
    contactEmail: 'orders@fsl.com',
    contactPhone: '+1-800-FSL',
    whatsappNumber: '+201123456789',
    productCount: 800,
    syncFrequency: 4,
  },
};
