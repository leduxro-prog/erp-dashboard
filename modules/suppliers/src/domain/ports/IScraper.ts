export interface ScrapedProduct {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity?: number;
  category?: string;
  imageUrl?: string;
  images?: string[];
  ean?: string;
  brand?: string;
  manufacturer?: string;
  sourceUpdatedAt?: string | Date;
  attributes?: Record<string, unknown>;
  specifications?: {
    countryOfOrigin?: string;
    wattage?: number;
    lumens?: number;
    colorTemperature?: number;
    cri?: number;
    beamAngle?: number;
    ipRating?: string;
    efficacy?: number;
    dimmable?: boolean;
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
    certificationCe?: boolean;
    certificationRohs?: boolean;
    certificationUl?: boolean;
    certificationEtl?: boolean;
    certificationEnec?: boolean;
    energyClass?: string;
    datasheetUrl?: string;
    iesFileUrl?: string;
    installationGuideUrl?: string;
    customSpecs?: Record<string, unknown>;
  };
}

export interface IScraper {
  scrapeProducts(credentials?: any): Promise<ScrapedProduct[]>;
  scrapeStock(): Promise<{ sku: string; quantity: number }[]>;
}

export interface IScraperFactory {
  getScraper(supplierCode: SupplierCode): IScraper;
}
import { SupplierCode } from '../entities/Supplier';
