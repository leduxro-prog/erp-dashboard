export interface CreateFiscalPeriodDTO {
  organizationId: string;
  periodName: string;
  fiscalYear: string;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface UpdateFiscalPeriodDTO {
  startDate?: Date;
  endDate?: Date;
  isOpen?: boolean;
  isLocked?: boolean;
  metadata?: Record<string, any>;
  updatedBy: string;
}

export interface CloseFiscalPeriodDTO {
  organizationId: string;
  fiscalPeriodId: string;
  userId: string;
}

export interface FiscalPeriodResponseDTO {
  id: string;
  organizationId: string;
  periodName: string;
  fiscalYear: string;
  startDate: Date;
  endDate: Date;
  isOpen: boolean;
  isLocked: boolean;
  closingDate?: Date;
  closedBy?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
