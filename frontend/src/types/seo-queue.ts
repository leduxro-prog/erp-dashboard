export type SeoQueueStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface SeoQueueItem {
  fieldName: string;
  currentValue: string | null;
  proposedValue: string | null;
  aiConfidence: number | null;
  reason: string | null;
  isSelected: boolean;
}

export interface SeoQueueChangeset {
  id: number;
  productId: number;
  locale: string;
  fingerprint: string;
  status: SeoQueueStatus;
  isActive: boolean;
  items: SeoQueueItem[];
}

export interface SeoQueueFilters {
  productId?: number;
  locale?: string;
  status?: SeoQueueStatus;
  page?: number;
  limit?: number;
}

export interface SeoQueueDecisionInput {
  productId?: number;
  locale?: string;
  status?: SeoQueueStatus;
  applyAll?: boolean;
}

export interface SeoQueueDecisionResult {
  matchedCount: number;
  eligibleCount: number;
  updatedCount: number;
}

export interface SeoQueueApplyInput {
  productId?: number;
  locale?: string;
  applyAll?: boolean;
}

export interface SeoQueueApplyResult {
  appliedCount: number;
}
