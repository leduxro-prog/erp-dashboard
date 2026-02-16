/**
 * Product configurator types for customizable products
 * Supports: Track lighting systems, LED strip configurations
 */

import { BaseEntity, Currency } from './common.types';

/**
 * Configurator type enumeration
 */
export const ConfiguratorTypeEnum = {
  TRACK: 'TRACK',
  LED_STRIP: 'LED_STRIP',
} as const;

export type ConfiguratorType = typeof ConfiguratorTypeEnum[keyof typeof ConfiguratorTypeEnum];

/**
 * Compatibility rule type
 */
export const CompatibilityRuleTypeEnum = {
  INCOMPATIBLE: 'INCOMPATIBLE',
  REQUIRES: 'REQUIRES',
  OPTIONAL: 'OPTIONAL',
} as const;

export type CompatibilityRuleType = typeof CompatibilityRuleTypeEnum[keyof typeof CompatibilityRuleTypeEnum];

/**
 * Configurator session (user building custom product)
 */
export interface ConfiguratorSession extends BaseEntity {
  /** Session identifier (UUID) */
  sessionId: string;
  /** Customer ID (if logged in) */
  customerId?: number | null;
  /** Configurator type (TRACK, LED_STRIP) */
  configuratorType: ConfiguratorType;
  /** Base product ID */
  baseProductId: number;
  /** Session status (draft, saved, shared, converted_to_quote) */
  status: 'draft' | 'saved' | 'shared' | 'converted_to_quote';
  /** Quote ID (if converted to quote) */
  quoteId?: number | null;
  /** Order ID (if converted to order) */
  orderId?: number | null;
  /** Total estimated price */
  totalEstimatedPrice: number;
  /** Currency */
  currency: Currency;
  /** Configuration data (type-specific) */
  configuration: Record<string, unknown>;
  /** Session notes */
  notes?: string | null;
  /** Last modified */
  modifiedAt: Date;
  /** Share token (if shared) */
  shareToken?: string | null;
  /** Shared by customer ID */
  sharedByUserId?: number | null;
  /** Shared at */
  sharedAt?: Date | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Track configuration details
 */
export interface TrackConfiguration {
  /** Configuration ID */
  id: number;
  /** Session ID */
  sessionId: string;
  /** Track length in millimeters */
  trackLength: number;
  /** Track profile (e.g., 3-phase, 1-phase) */
  trackProfile: string;
  /** Color temperature selection */
  colorTemperature: string;
  /** Mounting type (recessed, surface, pendant) */
  mountingType: string;
  /** Power supply selection */
  powerSupply: string;
  /** Configuration items */
  items: TrackConfigItem[];
  /** Total items in configuration */
  totalItems: number;
  /** Estimated total cost */
  estimatedCost: number;
  /** Configuration notes */
  notes?: string | null;
}

/**
 * Track configuration line item
 */
export interface TrackConfigItem extends BaseEntity {
  /** Configuration ID */
  configurationId: number;
  /** Session ID */
  sessionId: string;
  /** Item sequence number */
  sequence: number;
  /** Component type (fixture, adapter, connector, etc.) */
  componentType: string;
  /** Product ID of component */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Product name */
  productName: string;
  /** Quantity */
  quantity: number;
  /** Component specifications */
  specifications?: Record<string, unknown> | null;
  /** Item price */
  itemPrice: number;
  /** Total price for item (quantity * itemPrice) */
  totalPrice: number;
  /** Notes */
  notes?: string | null;
  /** Compatibility warnings */
  compatibilityWarnings?: string[] | null;
}

/**
 * LED strip configuration details
 */
export interface LEDStripConfiguration {
  /** Configuration ID */
  id: number;
  /** Session ID */
  sessionId: string;
  /** Strip length in millimeters */
  stripLength: number;
  /** LED type (RGB, RGBW, CCT, Single Color) */
  ledType: string;
  /** Color temperature (if CCT or single color) */
  colorTemperature?: string | null;
  /** Strip density (LEDs per meter) */
  ledDensity: number;
  /** IP rating (IP20, IP65, IP67, etc.) */
  ipRating: string;
  /** Mounting profile (e.g., aluminum extrusion profile) */
  mountingProfile: string;
  /** Power consumption in watts */
  powerConsumption: number;
  /** Power supply selection */
  powerSupply: string;
  /** Controller type (WiFi, Bluetooth, Physical, etc.) */
  controllerType: string;
  /** Configuration items */
  items: LEDConfigItem[];
  /** Total items in configuration */
  totalItems: number;
  /** Estimated total cost */
  estimatedCost: number;
  /** Configuration notes */
  notes?: string | null;
}

/**
 * LED strip configuration line item
 */
export interface LEDConfigItem extends BaseEntity {
  /** Configuration ID */
  configurationId: number;
  /** Session ID */
  sessionId: string;
  /** Item sequence number */
  sequence: number;
  /** Component type (strip, connector, power_supply, controller, profile, etc.) */
  componentType: string;
  /** Product ID of component */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Product name */
  productName: string;
  /** Quantity (for strip, in meters) */
  quantity: number;
  /** Unit of measurement (meter, piece, etc.) */
  unit: string;
  /** Component specifications */
  specifications?: Record<string, unknown> | null;
  /** Item unit price */
  itemUnitPrice: number;
  /** Total price for item */
  totalPrice: number;
  /** Notes */
  notes?: string | null;
  /** Compatibility warnings */
  compatibilityWarnings?: string[] | null;
}

/**
 * Compatibility rule between products/components
 */
export interface CompatibilityRule extends BaseEntity {
  /** Primary product ID */
  productId: number;
  /** Primary product SKU */
  sku: string;
  /** Related product ID */
  relatedProductId: number;
  /** Related product SKU */
  relatedSku: string;
  /** Rule type (INCOMPATIBLE, REQUIRES, OPTIONAL) */
  ruleType: CompatibilityRuleType;
  /** Rule condition (e.g., "if voltage is 12V") */
  condition?: string | null;
  /** Error/warning message */
  message: string;
  /** Whether rule is active */
  isActive: boolean;
  /** Configurator types this rule applies to */
  applicableConfigurators: ConfiguratorType[];
  /** Severity level (warning, error) */
  severity: 'warning' | 'error';
  /** Notes about compatibility */
  notes?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Configurator product component (reusable component in configurations)
 */
export interface ConfiguratorComponent extends BaseEntity {
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Component type (fixture, adapter, strip, connector, etc.) */
  componentType: string;
  /** Component category */
  category: string;
  /** Component description */
  description?: string | null;
  /** Applicable to configurator types */
  applicableConfigurators: ConfiguratorType[];
  /** Component specifications */
  specifications?: Record<string, unknown> | null;
  /** Component weight in kg */
  weight?: number | null;
  /** Component dimensions */
  dimensions?: Record<string, number> | null;
  /** Compatible with products (comma-separated SKUs) */
  compatibleWith?: string | null;
  /** Incompatible with products (comma-separated SKUs) */
  incompatibleWith?: string | null;
  /** Is this a required component */
  isRequired: boolean;
  /** Display order in configurator */
  displayOrder: number;
  /** Component image URL */
  imageUrl?: string | null;
  /** Configuration notes */
  configNotes?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * DTO for creating configurator session
 */
export interface CreateConfiguratorSessionDTO {
  configuratorType: ConfiguratorType;
  baseProductId: number;
  customerId?: number;
  configuration?: Record<string, unknown>;
  notes?: string;
}

/**
 * DTO for updating track configuration
 */
export interface UpdateTrackConfigurationDTO {
  trackLength?: number;
  trackProfile?: string;
  colorTemperature?: string;
  mountingType?: string;
  powerSupply?: string;
  items?: {
    sequence: number;
    componentType: string;
    productId: number;
    quantity: number;
    specifications?: Record<string, unknown>;
    notes?: string;
  }[];
  notes?: string;
}

/**
 * DTO for updating LED strip configuration
 */
export interface UpdateLEDStripConfigurationDTO {
  stripLength?: number;
  ledType?: string;
  colorTemperature?: string;
  ledDensity?: number;
  ipRating?: string;
  mountingProfile?: string;
  powerSupply?: string;
  controllerType?: string;
  items?: {
    sequence: number;
    componentType: string;
    productId: number;
    quantity: number;
    unit?: string;
    specifications?: Record<string, unknown>;
    notes?: string;
  }[];
  notes?: string;
}

/**
 * Configuration validation result
 */
export interface ConfigurationValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
    itemIndex?: number;
  }>;
  /** Total estimated cost */
  estimatedCost: number;
  /** Warnings and compatibility issues */
  warnings: string[];
  /** Recommended adjustments */
  recommendations?: string[];
}

/**
 * DTO for converting configuration to quote
 */
export interface ConvertToQuoteDTO {
  customerId: number;
  validityDays?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  internalNotes?: string;
}
