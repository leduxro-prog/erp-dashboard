/**
 * Pricing Tiers and Discount Constants
 * Defines customer pricing tiers, volume discounts, and margin configurations
 */

// VAT rate (19% in Romania)
export const VAT_RATE = 0.21;

// Profit margin constants
export const MARGINS = {
  MINIMUM: 0.3, // 30% - minimum acceptable margin
  STANDARD: 0.6, // 60% - standard/medium margin
  PREMIUM: 1.0, // 100% - premium margin
} as const;

// Customer pricing tier definitions
export enum PricingTier {
  STANDARD = 'standard',
  TIER_1 = 'tier_1',
  TIER_2 = 'tier_2',
  TIER_3 = 'tier_3',
}

// Bilingual tier labels
export const PRICING_TIER_LABELS = {
  [PricingTier.STANDARD]: {
    ro: 'Standard',
    en: 'Standard',
  },
  [PricingTier.TIER_1]: {
    ro: 'Nivel 1',
    en: 'Tier 1',
  },
  [PricingTier.TIER_2]: {
    ro: 'Nivel 2',
    en: 'Tier 2',
  },
  [PricingTier.TIER_3]: {
    ro: 'Nivel 3',
    en: 'Tier 3',
  },
} as const;

// Pricing tier configuration
interface PricingTierConfig {
  discount: number; // Discount percentage (0-1)
  minMonthlySpend?: number; // Minimum monthly spend to qualify (in currency units)
  description: {
    ro: string;
    en: string;
  };
}

export const PRICING_TIER_CONFIG: Record<PricingTier, PricingTierConfig> = {
  [PricingTier.STANDARD]: {
    discount: 0.0,
    description: {
      ro: 'Tier standard - fără discount',
      en: 'Standard tier - no discount',
    },
  },
  [PricingTier.TIER_1]: {
    discount: 0.05, // 5% discount
    minMonthlySpend: 5000,
    description: {
      ro: 'Tier 1 - 5% discount (cheltuit lunar > 5000)',
      en: 'Tier 1 - 5% discount (monthly spend > 5000)',
    },
  },
  [PricingTier.TIER_2]: {
    discount: 0.1, // 10% discount
    minMonthlySpend: 15000,
    description: {
      ro: 'Tier 2 - 10% discount (cheltuit lunar > 15000)',
      en: 'Tier 2 - 10% discount (monthly spend > 15000)',
    },
  },
  [PricingTier.TIER_3]: {
    discount: 0.15, // 15% discount
    minMonthlySpend: 30000,
    description: {
      ro: 'Tier 3 - 15% discount (cheltuit lunar > 30000)',
      en: 'Tier 3 - 15% discount (monthly spend > 30000)',
    },
  },
} as const;

// Volume discount breakpoints
interface VolumeDiscountBracket {
  minQuantity: number;
  maxQuantity?: number; // undefined = unlimited
  discountPercent: number;
}

export const VOLUME_DISCOUNT_BRACKETS: VolumeDiscountBracket[] = [
  {
    minQuantity: 0,
    maxQuantity: 9,
    discountPercent: 0, // No volume discount
  },
  {
    minQuantity: 10,
    maxQuantity: 49,
    discountPercent: 2,
  },
  {
    minQuantity: 50,
    maxQuantity: 99,
    discountPercent: 5,
  },
  {
    minQuantity: 100,
    discountPercent: 8,
  },
] as const;

/**
 * Get pricing tier discount percentage
 * @param tier Pricing tier
 * @returns Discount percentage (0-1)
 */
export function getTierDiscountPercent(tier: PricingTier): number {
  return PRICING_TIER_CONFIG[tier]?.discount || 0;
}

/**
 * Get minimum monthly spend required for a tier
 * @param tier Pricing tier
 * @returns Minimum monthly spend in currency units, or undefined if no requirement
 */
export function getTierMinMonthlySpend(tier: PricingTier): number | undefined {
  return PRICING_TIER_CONFIG[tier]?.minMonthlySpend;
}

/**
 * Calculate volume discount for a given quantity
 * @param quantity Order quantity
 * @returns Discount percentage (0-1)
 */
export function getVolumeDiscountPercent(quantity: number): number {
  if (quantity < 0) {
    return 0;
  }

  const bracket = VOLUME_DISCOUNT_BRACKETS.find((b) => {
    if (b.maxQuantity !== undefined) {
      return quantity >= b.minQuantity && quantity <= b.maxQuantity;
    }
    return quantity >= b.minQuantity;
  });

  return bracket ? bracket.discountPercent / 100 : 0;
}

/**
 * Get volume discount bracket info for a quantity
 * @param quantity Order quantity
 * @returns Volume discount bracket info or null
 */
export function getVolumeDiscountBracket(quantity: number): VolumeDiscountBracket | null {
  if (quantity < 0) {
    return null;
  }

  return (
    VOLUME_DISCOUNT_BRACKETS.find((b) => {
      if (b.maxQuantity !== undefined) {
        return quantity >= b.minQuantity && quantity <= b.maxQuantity;
      }
      return quantity >= b.minQuantity;
    }) || null
  );
}

/**
 * Determine the best tier for a customer based on monthly spend
 * @param monthlySpend Total monthly spending
 * @returns The highest tier the customer qualifies for
 */
export function determineBestTier(monthlySpend: number): PricingTier {
  // Check tiers in descending order (highest discount first)
  if (monthlySpend >= (getTierMinMonthlySpend(PricingTier.TIER_3) || 0)) {
    return PricingTier.TIER_3;
  }
  if (monthlySpend >= (getTierMinMonthlySpend(PricingTier.TIER_2) || 0)) {
    return PricingTier.TIER_2;
  }
  if (monthlySpend >= (getTierMinMonthlySpend(PricingTier.TIER_1) || 0)) {
    return PricingTier.TIER_1;
  }
  return PricingTier.STANDARD;
}

/**
 * Calculate final price with both tier and volume discounts
 * @param basePrice Base price before discounts
 * @param quantity Order quantity
 * @param tier Pricing tier
 * @returns Final price after all discounts
 */
export function calculateDiscountedPrice(
  basePrice: number,
  quantity: number,
  tier: PricingTier = PricingTier.STANDARD,
): number {
  if (basePrice < 0 || quantity < 0) {
    return 0;
  }

  const tierDiscount = getTierDiscountPercent(tier);
  const volumeDiscount = getVolumeDiscountPercent(quantity);

  // Apply discounts sequentially: tier discount first, then volume discount
  const priceAfterTierDiscount = basePrice * (1 - tierDiscount);
  const finalPrice = priceAfterTierDiscount * (1 - volumeDiscount);

  return finalPrice;
}

/**
 * Calculate total discount percentage applied
 * @param quantity Order quantity
 * @param tier Pricing tier
 * @returns Combined discount percentage (0-1)
 */
export function getTotalDiscountPercent(quantity: number, tier: PricingTier): number {
  const tierDiscount = getTierDiscountPercent(tier);
  const volumeDiscount = getVolumeDiscountPercent(quantity);

  // Combined discount: 1 - (1 - tier) * (1 - volume)
  return 1 - (1 - tierDiscount) * (1 - volumeDiscount);
}

/**
 * Calculate price with VAT
 * @param basePrice Price before VAT
 * @param vatRate VAT rate (default 0.21 for Romania)
 * @returns Price including VAT
 */
export function addVAT(basePrice: number, vatRate: number = VAT_RATE): number {
  return basePrice * (1 + vatRate);
}

/**
 * Calculate price without VAT
 * @param priceWithVAT Price including VAT
 * @param vatRate VAT rate (default 0.21 for Romania)
 * @returns Price before VAT
 */
export function removeVAT(priceWithVAT: number, vatRate: number = VAT_RATE): number {
  return priceWithVAT / (1 + vatRate);
}

/**
 * Calculate profit with applied margin
 * @param costPrice Cost/wholesale price
 * @param margin Margin percentage (0-1)
 * @returns Selling price with applied margin
 */
export function applyMargin(costPrice: number, margin: number): number {
  return costPrice * (1 + margin);
}

/**
 * Check if a margin is acceptable (>= minimum margin)
 * @param margin Margin percentage (0-1)
 * @returns true if margin meets minimum requirement
 */
export function isAcceptableMargin(margin: number): boolean {
  return margin >= MARGINS.MINIMUM;
}

/**
 * Get bilingual label for a pricing tier
 * @param tier Pricing tier
 * @param language Language code ('ro' or 'en')
 * @returns Label in requested language or English as fallback
 */
export function getPricingTierLabel(tier: PricingTier, language: 'ro' | 'en' = 'en'): string {
  const labels = PRICING_TIER_LABELS[tier];
  if (!labels) {
    return tier;
  }

  return labels[language] || labels.en;
}

/**
 * Get description for a pricing tier
 * @param tier Pricing tier
 * @param language Language code ('ro' or 'en')
 * @returns Description in requested language or English as fallback
 */
export function getPricingTierDescription(tier: PricingTier, language: 'ro' | 'en' = 'en'): string {
  const config = PRICING_TIER_CONFIG[tier];
  if (!config) {
    return '';
  }

  return config.description[language] || config.description.en;
}

/**
 * Get all available pricing tiers
 * @returns Array of all pricing tier values
 */
export function getAllPricingTiers(): PricingTier[] {
  return Object.values(PricingTier);
}
