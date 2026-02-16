export interface CreateChartOfAccountDTO {
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  accountType: string;
  parentAccountId?: string;
  isHeader?: boolean;
  costCenterCode?: string;
  taxApplicable?: boolean;
  accumulatedDepreciation?: boolean;
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface UpdateChartOfAccountDTO {
  name?: string;
  description?: string;
  parentAccountId?: string;
  isHeader?: boolean;
  isActive?: boolean;
  costCenterCode?: string;
  taxApplicable?: boolean;
  accumulatedDepreciation?: boolean;
  metadata?: Record<string, any>;
  updatedBy: string;
}

export interface ChartOfAccountResponseDTO {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  accountType: string;
  parentAccountId?: string;
  isHeader: boolean;
  isActive: boolean;
  costCenterCode?: string;
  taxApplicable: boolean;
  accumulatedDepreciation: boolean;
  balance: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
