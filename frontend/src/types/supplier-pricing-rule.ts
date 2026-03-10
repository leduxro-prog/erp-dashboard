export interface SupplierPricingRule {
  supplierCode: string;
  categoryKey: string;
  markupPercent: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSupplierPricingRuleInput {
  supplierCode: string;
  categoryKey: string;
  markupPercent: number;
  active?: boolean;
}
