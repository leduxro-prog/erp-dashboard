export interface ScrapedProduct {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
  category?: string;
  imageUrl?: string;
  images?: string[];
  manufacturer?: string;
  brand?: string;
  specifications?: SupplierProductSpecificationInput;
  attributes?: Record<string, string | number | boolean>;
  ean?: string;
  sourceUpdatedAt?: Date | string;
}

export interface SupplierProductSpecificationInput {
  countryOfOrigin?: string;
  wattage?: number;
  lumens?: number;
  colorTemperature?: number;
  cri?: number;
  beamAngle?: number;
  ipRating?: string;
  efficacy?: number;
  dimmable?: boolean | string | number;
  dimmingType?: string;
  voltageInput?: string;
  voltageOutput?: string;
  powerFactor?: number;
  frequency?: string;
  mountingType?: string;
  material?: string;
  color?: string;
  lifespanHours?: number;
  warrantyYears?: number;
  certificationCe?: boolean | string | number;
  certificationRohs?: boolean | string | number;
  certificationUl?: boolean | string | number;
  certificationEtl?: boolean | string | number;
  certificationEnec?: boolean | string | number;
  energyClass?: string;
  datasheetUrl?: string;
  iesFileUrl?: string;
  installationGuideUrl?: string;
  customSpecs?: Record<string, unknown>;
}

export interface IScraper {
  scrapeProducts(credentials?: any): Promise<ScrapedProduct[]>;
  scrapeStock(): Promise<{ sku: string; quantity: number }[]>;
}

export interface IScraperFactory {
  getScraper(supplierCode: string): IScraper;
}
