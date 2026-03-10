import { ISupplierRepository } from '../../domain';

export const DEFAULT_SUPPLIER_MARKUP_PERCENTAGE = 60;

export type PricingSource = 'category_rule' | 'fallback_default';

export interface SupplierPricingResolution {
  markupPercentage: number;
  source: PricingSource;
  categoryKey: string | null;
}

export class SupplierPricingService {
  constructor(
    private readonly repository: ISupplierRepository,
    private readonly fallbackMarkupPercentage: number = DEFAULT_SUPPLIER_MARKUP_PERCENTAGE,
  ) {}

  normalizeCategoryKey(category: string | undefined): string | null {
    if (typeof category !== 'string') {
      return null;
    }

    const normalized = category.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  async resolveMarkup(supplierCode: string, category: string | undefined): Promise<SupplierPricingResolution> {
    const categoryKey = this.normalizeCategoryKey(category);
    if (!categoryKey) {
      return {
        markupPercentage: this.fallbackMarkupPercentage,
        source: 'fallback_default',
        categoryKey: null,
      };
    }

    const rule = await this.repository.getSupplierPricingRule(supplierCode, categoryKey);
    if (rule?.active) {
      return {
        markupPercentage: rule.markupPercent,
        source: 'category_rule',
        categoryKey,
      };
    }

    return {
      markupPercentage: this.fallbackMarkupPercentage,
      source: 'fallback_default',
      categoryKey,
    };
  }

  applyMarkup(price: number, markupPercentage: number): number {
    const basePrice = Number(price);
    const markup = Number(markupPercentage);

    if (!Number.isFinite(basePrice) || !Number.isFinite(markup) || basePrice <= 0) {
      return basePrice;
    }

    return Math.round(basePrice * (1 + markup / 100) * 100) / 100;
  }
}
