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
  MPL_POWER = 'mpl-power',
  AZZARDO = 'azzardo',
  LED_PROFILES = 'ledprofiles',
  VIPELECTRO = 'vipelectro',
  BUSINESS_CENTRAL = 'business-central',
  EXAMPLE_API = 'example-api',
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
  defaultMarkupPercentage: number;
  markupType: string;
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
  defaultMarkupPercentage!: number;
  markupType!: string;
  lastSync!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: Supplier) {
    Object.assign(this, data);
  }

  isReadyForSync(): boolean {
    if (!this.isActive) return false;
    if (!this.lastSync) return true;

    const hoursSinceLastSync = (new Date().getTime() - this.lastSync.getTime()) / (1000 * 60 * 60);
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
  [SupplierCode.MPL_POWER]: {
    name: 'MPL Power',
    code: SupplierCode.MPL_POWER,
    website: 'https://mplpower.ro',
    contactEmail: 'contact@mplpower.ro',
    contactPhone: '+40-21-123-4567',
    whatsappNumber: '+40721234567',
    productCount: 1200,
    syncFrequency: 4,
  },
  [SupplierCode.AZZARDO]: {
    name: 'Azzardo',
    code: SupplierCode.AZZARDO,
    website: 'https://azzardo.com.pl',
    contactEmail: 'contact@azzardo.com.pl',
    contactPhone: '+48-61-123-4567',
    whatsappNumber: '+48611234567',
    productCount: 3000,
    syncFrequency: 4,
  },
  [SupplierCode.LED_PROFILES]: {
    name: 'LED Profiles',
    code: SupplierCode.LED_PROFILES,
    website: 'https://www.ledprofiles.sk',
    contactEmail: 'office@ledux.ro',
    contactPhone: '',
    whatsappNumber: '',
    productCount: 1300,
    syncFrequency: 4,
  },
  [SupplierCode.VIPELECTRO]: {
    name: 'VIP Electro',
    code: SupplierCode.VIPELECTRO,
    website: 'https://www.vipelectro.pl',
    contactEmail: 'office@ledux.ro',
    contactPhone: '',
    whatsappNumber: '',
    productCount: 3000,
    syncFrequency: 4,
  },
  [SupplierCode.BUSINESS_CENTRAL]: {
    name: 'Business Central',
    code: SupplierCode.BUSINESS_CENTRAL,
    website: 'https://api.businesscentral.dynamics.com',
    contactEmail: 'office@ledux.ro',
    contactPhone: '',
    whatsappNumber: '',
    productCount: 0,
    syncFrequency: 4,
  },
  [SupplierCode.EXAMPLE_API]: {
    name: 'Example API Supplier',
    code: SupplierCode.EXAMPLE_API,
    website: 'https://api.supplier.example',
    contactEmail: 'integration@supplier.example',
    contactPhone: '',
    whatsappNumber: '',
    productCount: 0,
    syncFrequency: 4,
  },
};
